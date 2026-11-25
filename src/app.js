import { CATEGORIES, loadState, saveState, validateImport } from "./data.js";
import { createPlan, dateFromOffset, localDate } from "./planner.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const elements = {
  panel: $("#view-panel"),
  categoryNav: $("#category-nav"),
  taskDialog: $("#task-dialog"),
  taskForm: $("#task-form"),
  settingsDialog: $("#settings-dialog"),
  settingsForm: $("#settings-form"),
  toast: $("#toast"),
};
let state;
let currentView = "today";
let categoryFilter = "";
let undoTimer;
let undoAction;
let toastTimer;
let editingId = null;
let draftDaysOff = {};

const today = () => localDate();
const category = (id) => CATEGORIES.find((item) => item.id === id) || CATEGORIES[0];
const taskById = (id) => state.tasks.find((task) => task.id === id);
const safeText = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));
const formatDate = (date, options = { weekday: "short", day: "numeric", month: "short" }) =>
  new Intl.DateTimeFormat("en-GB", options).format(new Date(`${date}T12:00:00`));
const formatTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours ? `${hours}h${mins ? ` ${mins}m` : ""}` : `${mins}m`;
};
const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function persist() {
  try {
    saveState(state);
    return true;
  } catch (error) {
    notify(error.message, "error");
    return false;
  }
}

function notify(message, type = "") {
  clearTimeout(toastTimer);
  elements.toast.className = `toast visible ${type}`;
  elements.toast.textContent = message;
  toastTimer = setTimeout(() => elements.toast.classList.remove("visible"), 4200);
}

function getPlan() {
  return createPlan(state.tasks, state.settings);
}

function categoryMark(id) {
  const item = category(id);
  return `<span class="category-mark ${item.color}" aria-hidden="true">${item.icon}</span>`;
}

function priorityLabel(priority) {
  const values = { low: ["▽", "Low"], mid: ["●", "Mid"], high: ["▲", "High"] };
  const [icon, label] = values[priority] || values.mid;
  return `<span class="priority ${priority}">${icon} ${label}</span>`;
}

function init() {
  try {
    state = loadState();
  } catch (error) {
    state = {
      schemaVersion: 1,
      tasks: [],
      settings: {
        capacityByWeekday: [180, 180, 180, 180, 180, 180, 120],
        daysOff: {}, deadlineShare: 0.75, minBlock: 25, maxBlock: 90, horizonDays: 56, bufferDays: 1, theme: "system",
      },
      completedBlocks: [],
    };
    notify(error.message, "error");
  }
  populateCategorySelect();
  render();
  bindEvents();
}

function populateCategorySelect() {
  $("#task-category").innerHTML = CATEGORIES.map((item) =>
    `<option value="${item.id}">${item.icon} ${item.label}</option>`).join("");
}

function bindEvents() {
  $("#navigation").addEventListener("click", (event) => {
    const button = event.target.closest("[data-view]");
    if (!button) return;
    currentView = button.dataset.view;
    categoryFilter = "";
    render();
  });
  elements.categoryNav.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    categoryFilter = categoryFilter === button.dataset.category ? "" : button.dataset.category;
    currentView = "tasks";
    render();
  });
  $("#quick-add").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = $("#quick-title");
    const value = input.value.trim();
    if (!value) {
      openTaskDialog();
      return;
    }
    const parsed = parseQuickAdd(value);
    if (!parsed.title) {
      openTaskDialog();
      return;
    }
    createTask({ title: parsed.title, category: parsed.category, priority: parsed.priority, due: parsed.due });
    input.value = "";
  });
  $("#task-category").addEventListener("change", () => {
    if ($("#task-category").value === "admin") $("#task-hard").checked = true;
  });
  $("#task-title").addEventListener("input", () => {
    if (/\bexam\b/i.test($("#task-title").value)) $("#task-hard").checked = true;
  });
  $("#settings-button").addEventListener("click", openSettings);
  $("#export-sidebar").addEventListener("click", exportBackup);
  $("#download-backup").addEventListener("click", exportBackup);
  $("#export-csv").addEventListener("click", exportCsv);
  $("#task-form").addEventListener("submit", saveTaskForm);
  $("#settings-form").addEventListener("submit", saveSettingsForm);
  $("#deadline-share").addEventListener("input", (event) => {
    $("#share-label").textContent = `${event.target.value}%`;
  });
  $("#import-backup").addEventListener("change", importBackup);
  $("#delete-all").addEventListener("click", deleteAllData);
  $("#add-day-off").addEventListener("click", addDayOff);
  $("#days-off-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-date]");
    if (!button) return;
    delete draftDaysOff[button.dataset.removeDate];
    renderDaysOff();
  });
  elements.panel.addEventListener("click", handlePanelClick);
  document.addEventListener("click", (event) => {
    const close = event.target.closest("[data-close]");
    if (close) $(`#${close.dataset.close}`).close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.target.matches("input, textarea, select") || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key.toLowerCase() === "n") openTaskDialog();
    if (event.key === "/") {
      event.preventDefault();
      $("#task-search")?.focus();
    }
    if (event.key.toLowerCase() === "t") navigate("today");
    if (event.key.toLowerCase() === "w") navigate("week");
    if (event.key === "Escape") {
      elements.taskDialog.close();
      elements.settingsDialog.close();
    }
  });
}

function parseQuickAdd(value) {
  let title = value;
  let priority = "mid";
  let categoryId = "personal";
  let due;
  title = title.replace(/!high\b/i, () => { priority = "high"; return ""; });
  title = title.replace(/!low\b/i, () => { priority = "low"; return ""; });
  title = title.replace(/#(uni|work|admin|personal)\b/i, (_, match) => { categoryId = match.toLowerCase(); return ""; });
  title = title.replace(/@(\d{4}-\d{2}-\d{2})\b/, (_, match) => { due = match; return ""; });
  title = title.replace(/@([a-z]{3})\b/i, (_, match) => {
    const days = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
    const target = days[match.toLowerCase()];
    if (target === undefined) return _;
    const next = new Date();
    let delta = (target - ((next.getDay() + 6) % 7) + 7) % 7;
    if (delta === 0) delta = 7;
    due = dateFromOffset(delta);
    return "";
  });
  return { title: title.replace(/\s{2,}/g, " ").trim(), priority, category: categoryId, due };
}

function createTask(values) {
  const task = {
    id: uid(), title: values.title.slice(0, 120), notes: values.notes || "", category: values.category || "personal",
    priority: values.priority || "mid", due: values.due || "", dueTime: values.dueTime || "",
    hard: Boolean(values.hard || (values.category === "admin") || /\bexam\b/i.test(values.title)),
    estimateMin: Math.max(15, Math.round((Number(values.estimateMin) || 60) / 15) * 15),
    doneMin: Math.max(0, Number(values.doneMin) || 0), status: "open", mode: "standard",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  state.tasks.unshift(task);
  if (!persist()) {
    state.tasks = state.tasks.filter((item) => item.id !== task.id);
    return;
  }
  render();
  notify("Task added");
}

function openTaskDialog(task = null) {
  editingId = task?.id || null;
  $("#task-dialog-title").textContent = task ? "Edit task" : "New task";
  $("#task-save").textContent = task ? "Save changes" : "Save task";
  $("#task-form-error").textContent = "";
  $("#task-title").value = task?.title || "";
  $("#task-category").value = task?.category || (categoryFilter || "personal");
  $("#task-priority").value = task?.priority || "mid";
  $("#task-due").value = task?.due || "";
  $("#task-due-time").value = task?.dueTime || "";
  $("#task-estimate").value = task?.estimateMin || 60;
  $("#task-hard").checked = task?.hard ?? ($("#task-category").value === "admin" || /\bexam\b/i.test(task?.title || ""));
  $("#task-notes").value = task?.notes || "";
  elements.taskDialog.showModal();
  $("#task-title").focus();
}

function saveTaskForm(event) {
  event.preventDefault();
  const form = new FormData(elements.taskForm);
  const title = String(form.get("title") || "").trim();
  if (!title) {
    $("#task-form-error").textContent = "Please enter a task title.";
    return;
  }
  const estimateMin = Number(form.get("estimateMin"));
  if (!Number.isInteger(estimateMin) || estimateMin < 15) {
    $("#task-form-error").textContent = "Estimated effort must be at least 15 minutes.";
    return;
  }
  const values = {
    title, notes: String(form.get("notes") || "").trim(), category: String(form.get("category")),
    priority: String(form.get("priority")), due: String(form.get("due") || ""), dueTime: String(form.get("dueTime") || ""),
    estimateMin, hard: $("#task-hard").checked,
  };
  if (editingId) {
    const task = taskById(editingId);
    const original = { ...task };
    Object.assign(task, values, { updatedAt: new Date().toISOString() });
    if (!persist()) Object.assign(task, original);
  } else {
    createTask(values);
  }
  elements.taskDialog.close();
  render();
}

function navigate(view) {
  currentView = view;
  categoryFilter = "";
  render();
}

function handlePanelClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action, id, date } = button.dataset;
  if (action === "new") openTaskDialog();
  if (action === "edit") openTaskDialog(taskById(id));
  if (action === "complete") toggleComplete(id);
  if (action === "delete") deleteTask(id);
  if (action === "block-done") completeBlock(id, date);
  if (action === "log-time") logTime(id);
  if (action === "search") render();
}

function toggleComplete(id) {
  const task = taskById(id);
  if (!task) return;
  const original = { ...task };
  const completing = task.status !== "done";
  task.status = completing ? "done" : "open";
  task.doneMin = completing ? task.estimateMin : Math.min(task.doneMin, task.estimateMin - 15);
  task.completedAt = completing ? new Date().toISOString() : "";
  task.updatedAt = new Date().toISOString();
  if (!persist()) Object.assign(task, original);
  else render();
}

function deleteTask(id) {
  const index = state.tasks.findIndex((task) => task.id === id);
  if (index < 0) return;
  const [removed] = state.tasks.splice(index, 1);
  if (!persist()) {
    state.tasks.splice(index, 0, removed);
    render();
    return;
  }
  undoAction = () => {
    state.tasks.splice(Math.min(index, state.tasks.length), 0, removed);
    if (persist()) render();
  };
  notifyUndo(`“${removed.title}” deleted`);
  render();
}

function notifyUndo(message) {
  clearTimeout(undoTimer);
  elements.toast.className = "toast visible";
  elements.toast.replaceChildren();
  const text = document.createElement("span");
  text.textContent = message;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "toast-undo";
  button.textContent = "Undo";
  button.addEventListener("click", () => {
    clearTimeout(undoTimer);
    undoAction?.();
    undoAction = null;
    elements.toast.classList.remove("visible");
  }, { once: true });
  elements.toast.append(text, button);
  undoTimer = setTimeout(() => { undoAction = null; elements.toast.classList.remove("visible"); }, 8000);
}

function completeBlock(id, date) {
  const blockKey = `${id}:${date}`;
  if (state.completedBlocks.includes(blockKey)) return;
  const task = taskById(id);
  const block = getPlan().schedule[date]?.find((entry) => entry.taskId === id);
  if (!task || !block) return;
  const original = task.doneMin;
  task.doneMin = Math.min(task.estimateMin, task.doneMin + block.minutes);
  if (task.doneMin >= task.estimateMin) {
    task.status = "done";
    task.completedAt = new Date().toISOString();
  }
  state.completedBlocks.push(blockKey);
  if (!persist()) {
    task.doneMin = original;
    state.completedBlocks = state.completedBlocks.filter((key) => key !== blockKey);
    return;
  }
  render();
  notify(`${formatTime(block.minutes)} logged for ${task.title}`);
}

function logTime(id) {
  const task = taskById(id);
  if (!task) return;
  const value = prompt(`How many minutes did you spend on “${task.title}”?`, "25");
  if (value === null) return;
  const minutes = Number(value);
  if (!Number.isInteger(minutes) || minutes < 1) {
    notify("Enter a whole number of minutes.", "error");
    return;
  }
  const old = task.doneMin;
  task.doneMin = Math.min(task.estimateMin, task.doneMin + minutes);
  if (task.doneMin >= task.estimateMin) {
    task.status = "done";
    task.completedAt = new Date().toISOString();
  }
  if (!persist()) task.doneMin = old;
  else render();
}

function deleteAllData() {
  if (prompt('Type DELETE to permanently clear all saved tasks and settings.') !== "DELETE") return;
  const previous = state;
  state = {
    schemaVersion: 1, tasks: [], completedBlocks: [],
    settings: { ...previous.settings, daysOff: {}, capacityByWeekday: [...previous.settings.capacityByWeekday] },
  };
  if (!persist()) state = previous;
  else {
    render();
    $("#settings-message").textContent = "All task data has been deleted.";
  }
}

function render() {
  const openTasks = state.tasks.filter((task) => task.status !== "done");
  $("#today-count").textContent = openTasks.length || "";
  $("#open-count").textContent = openTasks.length || "";
  $$("#navigation [data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === currentView));
  renderCategoryNav();
  const { schedule, warnings } = getPlan();
  if (currentView === "today") renderToday(schedule, warnings);
  else if (currentView === "week") renderWeek(schedule);
  else if (currentView === "upcoming") renderUpcoming(schedule, warnings);
  else renderTasks();
}

function renderCategoryNav() {
  elements.categoryNav.innerHTML = CATEGORIES.map((item) => {
    const count = state.tasks.filter((task) => task.status !== "done" && task.category === item.id).length;
    return `<button type="button" class="category-link ${categoryFilter === item.id ? "selected" : ""}" data-category="${item.id}">
      ${categoryMark(item.id)}<span>${item.label}</span><small>${count}</small></button>`;
  }).join("");
}

function renderToday(schedule, warnings) {
  const date = today();
  const blocks = schedule[date] || [];
  const planned = blocks.reduce((sum, block) => sum + block.minutes, 0);
  const doneBlocks = new Set(state.completedBlocks);
  const warningHtml = warnings.filter((item) => blocks.some((block) => block.taskId === item.taskId))
    .map((item) => `<div class="warning-banner"><span aria-hidden="true">!</span><p><strong>${safeText(taskById(item.taskId)?.title || "A task")} may be at risk.</strong> The planner estimates a shortfall of ${formatTime(item.shortfall)} before its deadline.</p></div>`).join("");
  const rows = blocks.map((block) => {
    const task = taskById(block.taskId);
    if (!task) return "";
    const done = doneBlocks.has(`${task.id}:${date}`);
    return `<article class="plan-row ${done ? "block-complete" : ""}">
      <button type="button" class="block-check" data-action="block-done" data-id="${task.id}" data-date="${date}" aria-label="${done ? "Completed" : "Mark"} ${safeText(task.title)} block done" ${done ? "disabled" : ""}>${done ? "✓" : ""}</button>
      <div class="plan-task">${categoryMark(task.category)}<div><button class="task-title-button" type="button" data-action="edit" data-id="${task.id}">${safeText(task.title)}</button><div class="task-meta">${safeText(category(task.category).label)} · ${priorityLabel(task.priority)}${task.due ? ` · Due ${formatDate(task.due, { day: "numeric", month: "short" })}` : ""}</div></div></div>
      <div class="block-info"><strong>${formatTime(block.minutes)}</strong><button class="why-button" type="button" title="Priority, urgency and remaining effort influence this block" aria-label="Why this block?">i</button><span class="why-popover">Weighted by ${task.priority} priority${task.due ? ` and deadline pressure (${block.weight})` : ""}. ${Math.round(block.share * 100)}% of its pool.</span></div>
    </article>`;
  }).join("");
  const noTasks = !state.tasks.some((task) => task.status === "open");
  elements.panel.innerHTML = `<div class="page-heading"><div><p class="eyebrow">${formatDate(date, { weekday: "long", day: "numeric", month: "long" }).toUpperCase()}</p><h1>Today <span class="date-dot">·</span> <span class="heading-date">${formatDate(date, { day: "numeric", month: "short" })}</span></h1><p class="subheading">A clear plan for the things that matter.</p></div><button class="button primary" data-action="new">＋ New task</button></div>
    <div class="summary-card"><div><span class="summary-label">PLANNED FOR TODAY</span><strong>${formatTime(planned)}</strong></div><div class="summary-detail">${blocks.length ? `${blocks.length} planned ${blocks.length === 1 ? "block" : "blocks"}` : "Nothing scheduled yet"}</div><div class="summary-accent" aria-hidden="true">✳</div></div>
    ${warningHtml}
    <section class="content-section"><div class="section-heading"><h2>Today's plan</h2><span>${formatDate(date, { weekday: "long" })}</span></div>
      ${rows || `<div class="empty-state"><div class="empty-illustration">✳</div><h3>${noTasks ? "A little space to breathe." : "Your plan is clear."}</h3><p>${noTasks ? "Add a task and Daymark will help you find time for it." : "Try adding more daily capacity in settings, or enjoy the breathing room."}</p><button class="button secondary" data-action="new">Add a task</button></div>`}
    </section>
    ${renderDoneSection()}`;
}

function renderDoneSection() {
  const done = state.tasks.filter((task) => task.status === "done");
  return `<details class="done-section"><summary>Completed <span>${done.length}</span></summary>${done.length ? done.map(taskRow).join("") : `<p class="muted small">Completed tasks will appear here.</p>`}</details>`;
}

function renderTasks() {
  const search = $("#task-search")?.value.toLowerCase().trim() || "";
  const all = state.tasks.filter((task) => (!categoryFilter || task.category === categoryFilter) &&
    (!search || `${task.title} ${task.notes}`.toLowerCase().includes(search)));
  const open = all.filter((task) => task.status !== "done");
  const done = all.filter((task) => task.status === "done");
  elements.panel.innerHTML = `<div class="page-heading"><div><p class="eyebrow">YOUR TASKS</p><h1>${categoryFilter ? safeText(category(categoryFilter).label) : "All tasks"}</h1><p class="subheading">${open.length} open task${open.length === 1 ? "" : "s"} · ${done.length} completed</p></div><button class="button primary" data-action="new">＋ New task</button></div>
    <div class="task-toolbar"><label class="search-box"><span aria-hidden="true">⌕</span><input id="task-search" type="search" placeholder="Search tasks or notes…" value="${safeText(search)}" aria-label="Search tasks"></label><label class="sort-label">Sort by <select id="task-sort"><option value="due">Due date</option><option value="priority">Priority</option><option value="created">Recently added</option></select></label></div>
    <section class="content-section task-list">${open.length ? open.map(taskRow).join("") : `<div class="empty-state compact"><h3>No tasks found</h3><p>Add a task or try a different search.</p><button class="button secondary" data-action="new">Add a task</button></div>`}</section>
    <details class="done-section"><summary>Completed <span>${done.length}</span></summary>${done.length ? done.map(taskRow).join("") : `<p class="muted small">Completed tasks will appear here.</p>`}</details>`;
  $("#task-search").addEventListener("input", () => {
    const input = $("#task-search");
    const start = input.selectionStart;
    renderTasks();
    $("#task-search").focus();
    $("#task-search").setSelectionRange(start, start);
  });
  $("#task-sort").addEventListener("change", (event) => {
    const sort = event.target.value;
    const priority = { high: 0, mid: 1, low: 2 };
    state.tasks.sort((a, b) => sort === "priority" ? priority[a.priority] - priority[b.priority]
      : sort === "created" ? b.createdAt.localeCompare(a.createdAt)
        : (a.due || "9999").localeCompare(b.due || "9999"));
    persist();
    renderTasks();
  });
}

function taskRow(task) {
  const isDone = task.status === "done";
  const overdue = task.due && task.due < today() && !isDone;
  const percent = Math.min(100, Math.round(task.doneMin / task.estimateMin * 100));
  return `<article class="task-row ${isDone ? "task-done" : ""}">
    <button class="block-check ${isDone ? "checked" : ""}" type="button" data-action="complete" data-id="${task.id}" aria-label="${isDone ? "Reopen" : "Complete"} ${safeText(task.title)}">${isDone ? "✓" : ""}</button>
    <div class="task-main">${categoryMark(task.category)}<div class="task-copy"><button class="task-title-button" type="button" data-action="edit" data-id="${task.id}">${safeText(task.title)}</button>
      <div class="task-meta">${safeText(category(task.category).label)} · ${priorityLabel(task.priority)} · ${formatTime(task.doneMin)} / ${formatTime(task.estimateMin)}${task.due ? ` · <span class="${overdue ? "overdue" : ""}">${overdue ? "Overdue · " : "Due "}${formatDate(task.due, { day: "numeric", month: "short" })}</span>` : ""}${task.hard ? " · Hard deadline" : ""}</div>
      <div class="progress-track" role="progressbar" aria-label="Task progress" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"><span style="width:${percent}%"></span></div></div></div>
    <div class="task-actions"><button type="button" class="subtle-action" data-action="log-time" data-id="${task.id}" aria-label="Log time for ${safeText(task.title)}">＋ time</button><button type="button" class="subtle-action" data-action="edit" data-id="${task.id}" aria-label="Edit ${safeText(task.title)}">Edit</button><button type="button" class="subtle-action delete-action" data-action="delete" data-id="${task.id}" aria-label="Delete ${safeText(task.title)}">×</button></div>
  </article>`;
}

function renderWeek(schedule) {
  const dates = Array.from({ length: 7 }, (_, index) => dateFromOffset(index, new Date()));
  elements.panel.innerHTML = `<div class="page-heading"><div><p class="eyebrow">YOUR WEEK</p><h1>This week</h1><p class="subheading">${formatDate(dates[0], { day: "numeric", month: "short" })} — ${formatDate(dates[6], { day: "numeric", month: "short" })}</p></div><button class="button primary" data-action="new">＋ New task</button></div>
    <div class="week-grid">${dates.map((date) => {
      const blocks = schedule[date] || [];
      const minutes = blocks.reduce((sum, block) => sum + block.minutes, 0);
      return `<section class="day-column ${date === today() ? "is-today" : ""}"><div class="day-heading"><span>${formatDate(date, { weekday: "short" })}</span><strong>${formatDate(date, { day: "numeric" })}</strong><small>${minutes ? formatTime(minutes) : "No plan"}</small></div>
        <div class="day-blocks">${blocks.map((block) => {
          const task = taskById(block.taskId);
          return task ? `<button type="button" class="week-block ${category(task.category).color}" data-action="edit" data-id="${task.id}"><strong>${safeText(task.title)}</strong><span>${formatTime(block.minutes)} · ${safeText(category(task.category).label)}</span></button>` : "";
        }).join("") || `<p class="muted tiny">Free</p>`}</div></section>`;
    }).join("")}</div>`;
}

function renderUpcoming(schedule, warnings) {
  const deadlines = state.tasks.filter((task) => task.status !== "done" && task.due)
    .sort((a, b) => a.due.localeCompare(b.due));
  const byDate = new Map();
  Object.entries(schedule).forEach(([date, blocks]) => {
    byDate.set(date, blocks.reduce((sum, block) => sum + block.minutes, 0));
  });
  elements.panel.innerHTML = `<div class="page-heading"><div><p class="eyebrow">LOOK AHEAD</p><h1>Upcoming</h1><p class="subheading">Your deadlines and the time planned around them.</p></div><button class="button primary" data-action="new">＋ New task</button></div>
    <section class="content-section"><div class="section-heading"><h2>Deadlines</h2><span>${deadlines.length} upcoming</span></div>
    ${deadlines.length ? `<div class="deadline-list">${deadlines.map((task) => {
      const warning = warnings.find((item) => item.taskId === task.id);
      const daysLeft = Math.ceil((Date.parse(`${task.due}T12:00:00`) - Date.parse(`${today()}T12:00:00`)) / 86400000);
      return `<article class="deadline-row"><div class="deadline-date"><strong>${formatDate(task.due, { day: "numeric" })}</strong><span>${formatDate(task.due, { month: "short" })}</span></div><div class="deadline-copy">${categoryMark(task.category)}<div><button class="task-title-button" type="button" data-action="edit" data-id="${task.id}">${safeText(task.title)}</button><p>${daysLeft < 0 ? `${Math.abs(daysLeft)} days overdue` : daysLeft === 0 ? "Due today" : `${daysLeft} days left`} · ${formatTime(Math.max(0, task.estimateMin - task.doneMin))} remaining</p></div></div>${warning ? `<span class="risk-pill">At risk · ${formatTime(warning.shortfall)} short</span>` : priorityLabel(task.priority)}</article>`;
    }).join("")}</div>` : `<div class="empty-state compact"><h3>No deadlines on the horizon</h3><p>Tasks with due dates will show up here.</p><button class="button secondary" data-action="new">Add a task</button></div>`}</section>
    <section class="content-section load-section"><div class="section-heading"><h2>Daily plan</h2><span>Next 14 days</span></div><div class="load-grid">${Array.from({ length: 14 }, (_, index) => {
      const date = dateFromOffset(index);
      const minutes = byDate.get(date) || 0;
      const weekday = new Date(`${date}T12:00:00`).getDay();
      const capacity = state.settings.capacityByWeekday[(weekday + 6) % 7] || 0;
      return `<div class="load-day" title="${formatDate(date)} · ${formatTime(minutes)} planned"><span>${formatDate(date, { weekday: "narrow" })}</span><i><b style="height:${capacity ? Math.min(100, minutes / capacity * 100) : 0}%"></b></i><small>${formatDate(date, { day: "numeric" })}</small></div>`;
    }).join("")}</div></section>`;
}

function openSettings() {
  $("#settings-message").textContent = "";
  draftDaysOff = { ...state.settings.daysOff };
  const labels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  $("#capacity-grid").innerHTML = labels.map((label, index) => `<label>${label}<span><input type="number" min="0" max="1440" step="15" data-day="${index}" value="${state.settings.capacityByWeekday[index]}"><small>min</small></span></label>`).join("");
  $("#deadline-share").value = Math.round(state.settings.deadlineShare * 100);
  $("#share-label").textContent = `${Math.round(state.settings.deadlineShare * 100)}%`;
  $("#off-date").value = "";
  renderDaysOff();
  elements.settingsDialog.showModal();
}

function addDayOff() {
  const date = $("#off-date").value;
  const capacity = Number($("#off-capacity").value);
  if (!date || date < today() || !Number.isInteger(capacity) || capacity < 0 || capacity > 1440) {
    $("#settings-message").textContent = "Choose today or a future date and a capacity between 0 and 1,440 minutes.";
    return;
  }
  draftDaysOff[date] = capacity;
  $("#settings-message").textContent = "";
  $("#off-date").value = "";
  renderDaysOff();
}

function renderDaysOff() {
  const entries = Object.entries(draftDaysOff).sort(([first], [second]) => first.localeCompare(second));
  $("#days-off-list").innerHTML = entries.map(([date, capacity]) => `<div class="days-off-item"><span>${formatDate(date)} · ${capacity ? `${formatTime(capacity)} available` : "Day off"}</span><button type="button" class="subtle-action" data-remove-date="${date}" aria-label="Remove ${formatDate(date)}">Remove</button></div>`).join("") ||
    `<p class="muted small">No specific dates set.</p>`;
}

function saveSettingsForm(event) {
  event.preventDefault();
  const previous = structuredClone(state.settings);
  const capacities = $$("#capacity-grid input").map((input) => Number(input.value));
  if (capacities.some((value) => !Number.isInteger(value) || value < 0 || value > 1440)) {
    $("#settings-message").textContent = "Daily capacity must be between 0 and 1,440 minutes.";
    return;
  }
  state.settings.capacityByWeekday = capacities;
  state.settings.deadlineShare = Number($("#deadline-share").value) / 100;
  state.settings.daysOff = { ...draftDaysOff };
  if (!persist()) state.settings = previous;
  else {
    elements.settingsDialog.close();
    render();
    notify("Settings saved");
  }
}

function exportBackup() {
  download(`daymark-backup-${today()}.json`, JSON.stringify(state, null, 2), "application/json");
  notify("Backup downloaded");
}

function exportCsv() {
  const columns = ["title", "category", "priority", "due", "estimateMin", "doneMin", "status", "hard", "notes"];
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [columns.join(","), ...state.tasks.map((task) => columns.map((column) => escape(task[column])).join(","))].join("\r\n");
  download(`daymark-tasks-${today()}.csv`, `\uFEFF${csv}`, "text/csv;charset=utf-8");
  notify("Tasks exported as CSV");
}

function download(filename, contents, type) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function importBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const contents = JSON.parse(await file.text());
    const imported = validateImport(contents);
    if (!confirm(`Import ${imported.tasks.length} tasks? This replaces the data saved in this browser.`)) return;
    const previous = state;
    state = imported;
    if (!persist()) state = previous;
    else {
      render();
      $("#settings-message").textContent = "Backup imported successfully.";
      notify("Backup imported");
    }
  } catch (error) {
    $("#settings-message").textContent = error.message || "Could not read this backup file.";
  } finally {
    event.target.value = "";
  }
}

function renderOnSearch() {
  renderTasks();
}

init();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register(new URL("../sw.js", import.meta.url))
    .catch((error) => console.warn("Offline support could not be enabled.", error));
}
