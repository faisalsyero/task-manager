export const STORAGE_KEY = "daymark.data.v1";
export const CATEGORIES = [
  { id: "personal", label: "Personal projects", color: "lavender", icon: "✳" },
  { id: "uni", label: "Uni work", color: "blue", icon: "▣" },
  { id: "work", label: "Work", color: "green", icon: "◈" },
  { id: "admin", label: "Admin & Gov", color: "orange", icon: "⌂" },
];

const defaultState = () => ({
  schemaVersion: 1,
  tasks: [],
  settings: {
    capacityByWeekday: [180, 180, 180, 180, 180, 180, 120],
    daysOff: {},
    deadlineShare: 0.75,
    minBlock: 25,
    maxBlock: 90,
    horizonDays: 56,
    bufferDays: 1,
    theme: "system",
  },
  completedBlocks: [],
});

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return validateImport(JSON.parse(raw));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("Saved data could not be read. Your browser storage may be damaged.");
    throw error;
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    throw new Error(`Could not save your changes in this browser. ${error.message}`);
  }
}

export function validateImport(value) {
  if (!value || value.schemaVersion !== 1 || !Array.isArray(value.tasks) || !value.settings) {
    throw new Error("This file is not a supported Daymark backup.");
  }
  const validCategories = new Set(CATEGORIES.map((category) => category.id));
  const validPriorities = new Set(["low", "mid", "high"]);
  const ids = new Set();
  const validDate = (date) => !date || (/^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(`${date}T12:00:00Z`)) &&
    new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date);
  for (const task of value.tasks) {
    if (!task || typeof task.id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(task.id) || ids.has(task.id) ||
      typeof task.title !== "string" || !task.title.trim() || task.title.length > 120 ||
      !validCategories.has(task.category) || !validPriorities.has(task.priority) ||
      !Number.isInteger(task.estimateMin) || task.estimateMin < 15 ||
      !Number.isInteger(task.doneMin) || task.doneMin < 0 || task.doneMin > task.estimateMin ||
      !["open", "done"].includes(task.status) || !validDate(task.due) || !validDate(task.startAfter) ||
      typeof (task.notes || "") !== "string" || (task.notes || "").length > 2000 ||
      typeof (task.dueTime || "") !== "string" ||
      (task.dueTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(task.dueTime)) ||
      typeof task.hard !== "boolean" || !["standard", "spread"].includes(task.mode || "standard")) {
      throw new Error("The backup contains an invalid task. Nothing has been changed.");
    }
    ids.add(task.id);
  }
  if (!Array.isArray(value.settings.capacityByWeekday) || value.settings.capacityByWeekday.length !== 7 ||
      value.settings.capacityByWeekday.some((minutes) => !Number.isInteger(minutes) || minutes < 0 || minutes > 1440) ||
      !Number.isFinite(value.settings.deadlineShare) || value.settings.deadlineShare < 0.5 || value.settings.deadlineShare > 0.9 ||
      !Number.isInteger(value.settings.horizonDays) || value.settings.horizonDays < 1 || value.settings.horizonDays > 365 ||
      !Number.isInteger(value.settings.minBlock) || value.settings.minBlock < 5 || value.settings.minBlock > 240 ||
      !Number.isInteger(value.settings.maxBlock) || value.settings.maxBlock < value.settings.minBlock || value.settings.maxBlock > 240 ||
      !Number.isInteger(value.settings.bufferDays) || value.settings.bufferDays < 0 || value.settings.bufferDays > 30 ||
      !["system", "light", "dark"].includes(value.settings.theme)) {
    throw new Error("The backup contains invalid settings. Nothing has been changed.");
  }
  if (value.settings.daysOff && (typeof value.settings.daysOff !== "object" || Array.isArray(value.settings.daysOff) ||
      Object.entries(value.settings.daysOff).some(([date, minutes]) => !validDate(date) || !date ||
        !Number.isInteger(minutes) || minutes < 0 || minutes > 1440))) {
    throw new Error("The backup contains invalid date availability. Nothing has been changed.");
  }
  return {
    ...defaultState(),
    ...value,
    settings: { ...defaultState().settings, ...value.settings },
    completedBlocks: Array.isArray(value.completedBlocks) ? value.completedBlocks : [],
  };
}
