const PRIORITY_WEIGHT = { low: 1, mid: 2, high: 4 };
const DAY_MS = 86400000;
const pad = (value) => String(value).padStart(2, "0");

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function dateFromOffset(offset, base = new Date()) {
  const date = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset);
  return localDate(date);
}

function daysBetween(first, second) {
  return Math.round((Date.parse(`${second}T12:00:00`) - Date.parse(`${first}T12:00:00`)) / DAY_MS);
}

function distribute(pool, capacity, date, settings) {
  const active = pool.filter((task) => task.remaining > 0);
  if (!active.length || capacity < 5) return [];
  const maxRemaining = Math.max(...active.map((task) => task.remaining));
  const weights = active.map((task) => {
    const priority = PRIORITY_WEIGHT[task.priority] || PRIORITY_WEIGHT.mid;
    const urgency = task.due
      ? 1 + (task.hard ? 12 : 8) / (Math.max(0, daysBetween(date, task.due) - settings.bufferDays) + 1)
      : 1;
    const size = Math.min(1.5, Math.max(0.8, 0.8 + 0.7 * task.remaining / maxRemaining));
    return priority * urgency * size;
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let room = Math.floor(capacity / 5) * 5;
  const raw = active.map((task, index) => Math.min(task.remaining, room * weights[index] / totalWeight));
  const amounts = raw.map((amount) => Math.floor(amount / 5) * 5);
  let used = amounts.reduce((sum, amount) => sum + amount, 0);
  while (room - used >= 5) {
    const eligible = active.map((task, index) => ({ index, fraction: raw[index] - amounts[index] }))
      .filter(({ index }) => taskCanReceive(active[index], amounts[index]))
      .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
    if (!eligible.length) break;
    let progressed = false;
    for (const { index } of eligible) {
      if (room - used < 5) break;
      const increment = Math.min(5, active[index].remaining - amounts[index]);
      if (increment > 0) {
        amounts[index] += increment;
        used += increment;
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  return active.map((task, index) => ({ task, minutes: amounts[index], weight: weights[index], share: totalWeight ? weights[index] / totalWeight : 0 }))
    .filter((entry) => entry.minutes > 0);
}

function taskCanReceive(task, amount) {
  return task.remaining - amount >= 5;
}

export function createPlan(tasks, settings, start = new Date()) {
  const work = tasks.filter((task) => task.status !== "done").map((task) => ({
    ...task,
    remaining: Math.max(0, task.estimateMin - task.doneMin),
  }));
  const schedule = {};
  const warnings = [];
  const startDate = localDate(start);
  for (let offset = 0; offset < settings.horizonDays; offset += 1) {
    const date = dateFromOffset(offset, start);
    const weekday = new Date(`${date}T12:00:00`).getDay();
    let capacity = settings.capacityByWeekday[(weekday + 6) % 7] || 0;
    if (Object.prototype.hasOwnProperty.call(settings.daysOff, date)) capacity = settings.daysOff[date];
    if (!capacity) continue;

    const active = work.filter((task) => task.remaining > 0 && (!task.startAfter || task.startAfter <= date) &&
      (!task.due || task.due >= date || (date === startDate && task.due < date)));
    const deadlineTasks = active.filter((task) => task.due);
    const flexibleTasks = active.filter((task) => !task.due);
    let deadlineCapacity = deadlineTasks.length && flexibleTasks.length
      ? Math.floor(capacity * settings.deadlineShare / 5) * 5
      : deadlineTasks.length ? capacity : 0;
    const flexibleCapacity = capacity - deadlineCapacity;
    const deadlineAllocations = distribute(deadlineTasks, deadlineCapacity, date, settings);
    const flexibleAllocations = distribute(flexibleTasks, flexibleCapacity, date, settings);
    const usedById = (allocations) => new Map(allocations.map((entry) => [entry.task.id, entry.minutes]));
    const deadlineUsed = usedById(deadlineAllocations);
    const flexibleUsed = usedById(flexibleAllocations);
    const deadlineSpare = deadlineCapacity - deadlineAllocations.reduce((sum, entry) => sum + entry.minutes, 0);
    const flexibleSpare = flexibleCapacity - flexibleAllocations.reduce((sum, entry) => sum + entry.minutes, 0);
    const remainingAfter = (pool, used) => pool.map((task) => ({
      ...task,
      remaining: task.remaining - (used.get(task.id) || 0),
    }));
    const transferredToFlexible = deadlineSpare > 0
      ? distribute(remainingAfter(flexibleTasks, flexibleUsed), deadlineSpare, date, settings)
      : [];
    const transferredToDeadlines = flexibleSpare > 0
      ? distribute(remainingAfter(deadlineTasks, deadlineUsed), flexibleSpare, date, settings)
      : [];
    const entries = [...deadlineAllocations, ...flexibleAllocations, ...transferredToFlexible, ...transferredToDeadlines];
    const merged = new Map();
    for (const entry of entries) {
      const previous = merged.get(entry.task.id);
      if (previous) previous.minutes += entry.minutes;
      else merged.set(entry.task.id, { ...entry });
    }
    const blocks = [...merged.values()].map((entry) => {
      const minutes = Math.min(entry.minutes, entry.task.remaining);
      entry.task.remaining -= minutes;
      return {
        id: `${entry.task.id}:${date}`,
        taskId: entry.task.id,
        date,
        minutes,
        pinned: false,
        status: "planned",
        weight: Number(entry.weight.toFixed(2)),
        share: entry.share,
      };
    }).filter((block) => block.minutes > 0);
    if (blocks.length) schedule[date] = blocks;
  }

  for (const task of work.filter((item) => item.due && item.remaining > 0)) {
    const total = task.estimateMin - task.doneMin;
    const days = Math.max(1, daysBetween(startDate, task.due) + 1);
    const capacity = Array.from({ length: Math.min(days, settings.horizonDays) }, (_, index) => {
      const day = dateFromOffset(index, start);
      const weekday = new Date(`${day}T12:00:00`).getDay();
      return Object.prototype.hasOwnProperty.call(settings.daysOff, day)
        ? settings.daysOff[day]
        : settings.capacityByWeekday[(weekday + 6) % 7] || 0;
    }).reduce((sum, value) => sum + value, 0);
    if (total > capacity) warnings.push({ taskId: task.id, shortfall: total - capacity });
  }
  return { schedule, warnings };
}
