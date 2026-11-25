# Task Manager with Smart Study/Work Planner: Software Requirements Specification

**Version:** 1.0 | **Type:** Minimalist single-user web application | **Status:** Ready for development

---

## 1. Overview

### 1.1 Purpose
A minimalist web task manager that lets one user add, edit, complete and remove tasks across four life areas, and then **automatically plans their time**. The standout feature is the **Smart Planner**, which behaves like an exam-revision planner: it takes each task's due date, priority and estimated effort, and distributes daily work blocks so that urgent and high-priority items get proportionally more time without completely starving everything else.

### 1.2 Design Philosophy
- **Minimal UI, deep logic.** Few screens, no clutter, one accent colour, generous whitespace.
- **Predictable automation.** The planner must be explainable: every scheduled block can show *why* it was given.
- **Local-first.** Works offline, data stays on the device, no account needed for v1.
- **Fast.** Everything the user does should feel instant.

### 1.3 Scope
**In scope (v1):** task CRUD, categories, due dates, priorities, effort estimates, auto-scheduling, daily/weekly plan view, availability settings, local persistence, import/export.

**Out of scope (v1):** multi-user collaboration, cloud sync, native mobile apps, calendar integrations (Google/Outlook), notifications via email/SMS, AI/LLM features.

### 1.4 Glossary
| Term | Meaning |
|---|---|
| Task | A unit of work the user wants to complete |
| Category | One of: Personal Projects, Uni Work, Work, Admin/Government |
| Block | A scheduled slice of time assigned to a task on a specific day |
| Capacity | Minutes available for tasks on a given day |
| Horizon | How many days ahead the planner schedules (default 56) |
| Hard deadline | A due date that cannot slip (exam, government deadline) |
| Pressure | Ratio of work still needed to time still available before a deadline |

---

## 2. Users and Use Cases

**Primary user:** a university student who also works part-time and runs personal projects.

| ID | Use case |
|---|---|
| UC-1 | Quickly capture a task in under 5 seconds |
| UC-2 | See what to work on **today**, already planned |
| UC-3 | Add an exam 4 weeks away and watch revision time ramp up automatically while personal projects keep getting smaller blocks |
| UC-4 | Be warned when the workload is impossible to fit before a deadline |
| UC-5 | Mark things done and have the plan re-balance instantly |
| UC-6 | Back up and restore data |

---

## 3. Functional Requirements

Priority key: **M** = Must, **S** = Should, **C** = Could.

### 3.1 Task Management

| ID | Requirement | Pri |
|---|---|---|
| FR-1.1 | User can create a task with: title (required, max 120 chars), category (required), priority (Low/Mid/High, default Mid), optional due date, optional due time, estimated effort, optional notes (max 2,000 chars) | M |
| FR-1.2 | User can edit any field of an existing task | M |
| FR-1.3 | User can delete a task; deletion requires one-click confirmation or offers a 8-second **Undo** toast | M |
| FR-1.4 | User can mark a task complete and un-complete it | M |
| FR-1.5 | Completed tasks move to a collapsible "Done" section and are excluded from planning | M |
| FR-1.6 | Quick-add bar: typing a title and pressing Enter creates a task with defaults; a smart-parse of `!high`, `!low`, `#uni`, `@fri` or `@2026-12-01` is supported | S |
| FR-1.7 | Estimated effort is entered as hours/minutes (e.g. `2h 30m`); minimum 15 min, step 15 min | M |
| FR-1.8 | Tasks may be split into subtasks (checklist) whose completion updates progress % | C |
| FR-1.9 | Task has `minutes_done` (time logged); user can log time manually or it auto-increments when a scheduled block is marked done | M |
| FR-1.10 | Bulk actions: multi-select to delete, complete, or change category/priority | C |
| FR-1.11 | Recurring tasks (daily/weekly/monthly) | C |

### 3.2 Categories

| ID | Requirement | Pri |
|---|---|---|
| FR-2.1 | Four built-in categories: **Personal Projects**, **Uni Work**, **Work**, **Admin & Gov** | M |
| FR-2.2 | Each task belongs to exactly one category | M |
| FR-2.3 | List can be filtered by category (single or multi-select) and shows counts per category | M |
| FR-2.4 | Each category can have a **time allocation cap** (optional, e.g. "max 90 min/day of Personal Projects") | S |
| FR-2.5 | User-defined custom categories (add, rename, recolour, delete) | C |
| FR-2.6 | Each category has a distinct, subtle colour dot, never relying on colour alone (include label/icon) | M |

### 3.3 Due Dates and Priority

| ID | Requirement | Pri |
|---|---|---|
| FR-3.1 | Due date is optional. Tasks **with** a due date are "deadline tasks"; tasks without are "flexible tasks" | M |
| FR-3.2 | Priority has exactly three levels: **Low, Mid, High**, shown with text and an icon | M |
| FR-3.3 | Tasks can be flagged as **Hard deadline** (default on for Admin & Gov and for tasks titled/tagged "exam") | S |
| FR-3.4 | Overdue tasks are visually flagged and automatically promoted to maximum urgency | M |
| FR-3.5 | Due dates cannot be set in the past on creation (warn, but allow on edit) | S |
| FR-3.6 | Optional "start no earlier than" date so a task is not scheduled before it | C |

### 3.4 Views

| ID | Requirement | Pri |
|---|---|---|
| FR-4.1 | **Today view (default):** ordered list of today's scheduled blocks with total planned time, each with a checkbox, start-timer and "why this?" tooltip | M |
| FR-4.2 | **All Tasks view:** sortable (due date, priority, category, created) and filterable list | M |
| FR-4.3 | **Week view:** 7-day grid showing blocks per day with minutes per category | M |
| FR-4.4 | **Upcoming/Horizon view:** compact month overview with deadlines marked and a daily load bar | S |
| FR-4.5 | Search by title/notes | S |
| FR-4.6 | Light and dark themes, following system preference by default | M |
| FR-4.7 | Keyboard shortcuts: `N` new task, `/` search, `T` today, `W` week, `Esc` close dialog, `Ctrl/Cmd+Z` undo | S |

### 3.5 Smart Planner (core feature)

| ID | Requirement | Pri |
|---|---|---|
| FR-5.1 | The planner automatically generates a schedule of blocks for every incomplete task over the horizon, with no manual scheduling required | M |
| FR-5.2 | **Deadline tasks always outrank flexible tasks.** When any deadline task needs time, the planner reserves a guaranteed share of daily capacity for deadline work (default 75%, configurable) and gives flexible tasks the remainder | M |
| FR-5.3 | Within the same pool, allocation is **proportional to a computed weight** (see §4), not equal splits and not strict "one task per day" | M |
| FR-5.4 | **No starvation:** every incomplete task with remaining effort receives at least a minimum share (at least one block within any rolling 7-day window, when capacity allows) | M |
| FR-5.5 | As a deadline approaches, its weight increases smoothly so its daily time ramps up (the "exam in 4 weeks" behaviour) | M |
| FR-5.6 | Blocks respect min/max block length (default 25 to 90 min) and are rounded to 5-minute multiples | M |
| FR-5.7 | The planner never schedules work after a task's due date and never exceeds a task's remaining effort | M |
| FR-5.8 | **Overload detection:** if total remaining effort before a deadline exceeds available capacity, show a clear warning naming the task and the shortfall in hours, plus suggestions (raise capacity, lower other priorities, move deadline) | M |
| FR-5.9 | In overload, the planner falls back to Earliest Deadline First for hard-deadline tasks and flags the rest as "at risk" | M |
| FR-5.10 | Plan re-computes automatically within 200 ms whenever a task, setting or completion changes | M |
| FR-5.11 | **Explainability:** each block has a "why" popover (e.g. "Exam in 12 days · High priority · weight 7.4 · 38% of today's deadline pool") | S |
| FR-5.12 | User can **pin** a block to a specific day/time; the planner treats pinned blocks as fixed and plans around them | S |
| FR-5.13 | User can **lock** today's plan so it doesn't reshuffle during the day (default: today locks at the start of the first block) | S |
| FR-5.14 | Missed/uncompleted blocks from past days roll forward as remaining effort and are re-planned; they are never silently dropped | M |
| FR-5.15 | Interleaving: adjacent blocks on the same day should alternate between different tasks where possible to reduce fatigue, and a task is not scheduled for more than 2 consecutive blocks | S |
| FR-5.16 | Optional **spaced-spread mode** for exam/learning tasks: prefers spreading effort evenly across days rather than cramming near the deadline | S |
| FR-5.17 | Optional buffer: planner aims to finish deadline tasks N days before the due date (default 1 day for hard deadlines) | S |
| FR-5.18 | A "Re-plan" button forces a full recompute, and a "Plan preview" shows the diff before accepting large changes | C |

### 3.6 Availability and Settings

| ID | Requirement | Pri |
|---|---|---|
| FR-6.1 | User sets **daily capacity per weekday** (minutes available for tasks), e.g. Mon 180, Sat 300, Sun 120 | M |
| FR-6.2 | User can mark specific dates as **days off / reduced capacity** (e.g. shift at the restaurant, a holiday) | M |
| FR-6.3 | Settings: block min/max length, deadline-pool share, horizon, buffer days, week start day, 12/24h time | S |
| FR-6.4 | Priority weights (Low/Mid/High) editable under "Advanced", with a reset-to-defaults button | C |
| FR-6.5 | Optional working window (e.g. 09:00 to 21:00) so blocks can be given clock times | C |

### 3.7 Data Management

| ID | Requirement | Pri |
|---|---|---|
| FR-7.1 | All data persists locally in the browser (IndexedDB, with localStorage fallback) | M |
| FR-7.2 | Export all data to a single JSON file; import from the same format with schema validation | M |
| FR-7.3 | Export tasks to CSV | S |
| FR-7.4 | Export deadlines to an `.ics` file for use in any calendar app | C |
| FR-7.5 | "Delete all data" with typed confirmation | S |
| FR-7.6 | Data schema is versioned and migrations run automatically on load | M |

---

## 4. The Smart Planner Algorithm

### 4.1 Approaches Considered

| Approach | Strength | Weakness | Verdict |
|---|---|---|---|
| Strict priority queue | Simple | Starves low-priority work completely | Rejected |
| Earliest Deadline First (EDF) | Optimal for meeting deadlines when feasible | Ignores priority; no balancing; no handling of undated work | Used only as **overload fallback** |
| Eisenhower matrix | Easy to understand | Only 4 buckets; produces no time quantities | Used as a UI label, not the engine |
| WSJF (weighted shortest job first) | Good value/effort ranking | Favours tiny tasks, ignores deadlines | Partially borrowed (size factor) |
| Round-robin | Fair | Ignores urgency and importance | Rejected |
| **Weighted proportional share with deadline pressure (chosen)** | Gives more time to important/urgent work, never starves anything, smooth ramp-up, explainable | Needs tuning | **Selected** |

The chosen design is a **two-tier, weighted proportional-share scheduler** (conceptually similar to stride or lottery scheduling in operating systems, with an urgency term borrowed from EDF and a feasibility check from the "required daily pace" idea used in revision planners).

### 4.2 Inputs per task
- `priority` ∈ {Low, Mid, High}
- `due` (optional) and `hard` flag
- `remaining = estimate − minutes_done` (minutes)
- `category` (for caps)

### 4.3 Step 1: Tiering
Split incomplete tasks into:
- **Pool D (deadline tasks):** have a due date.
- **Pool F (flexible tasks):** no due date.

Daily capacity `C(day)` is divided:
```
cap_D = C × deadlineShare      (default 0.75)  if Pool D has any work needing time
cap_F = C − cap_D
```
- If Pool D is empty, `cap_F = C`.
- If Pool F is empty, `cap_D = C`.
- Unused capacity in one pool flows to the other (no wasted time).

This is what guarantees *"things with deadlines automatically have priority over those that don't"* while still letting personal projects progress.

### 4.4 Step 2: Weight per task per day
For a given planning day `t` and task `i`:

```
weight(i, t) = P(i) × U(i, t) × S(i)
```

**P: priority factor**

| Priority | P |
|---|---|
| Low | 1 |
| Mid | 2 |
| High | 4 |

(Exponential spacing so High clearly dominates but Low is never zero.)

**U: urgency factor** (only for deadline tasks; flexible tasks use `U = 1`)

Let `d = max(0, daysUntilDue − bufferDays)` measured in *available working days* between `t` and the due date.

```
U = 1 + A / (d + 1)             A = 8 (soft deadline), A = 12 (hard deadline)
```
- 28 days out (hard): `U = 1 + 12/29 ≈ 1.41`
- 7 days out: `U = 2.5`
- 2 days out: `U = 5.0`
- Due today or overdue: `U = 13` (maximum)

This produces a **smooth hyperbolic ramp**: gentle early, steep near the deadline, matching how people actually revise.

**S: size/progress factor** (small WSJF-style nudge, bounded 0.8 to 1.5)
```
S = clamp(0.8, 1.5, 0.8 + 0.7 × (remaining / maxRemainingInPool))
```
Tasks with more work left get slightly more time, so large tasks are not unfairly squeezed.

### 4.5 Step 3: Required-pace floor (feasibility guard)
For every deadline task compute the minimum daily time needed to finish on time:
```
requiredPace(i) = remaining(i) / workingDaysLeft(i)
```
Today's allocation to task *i* is:
```
alloc(i) = max( requiredPace(i) × safety , proportionalShare(i) )
```
where `safety = 1.1` for hard deadlines and `1.0` otherwise, and:
```
proportionalShare(i) = cap_pool × weight(i) / Σ weight(pool)
```
After applying floors, if `Σ alloc > cap_D`, the pool is **overloaded** → go to §4.8.
Otherwise, scale the proportional portions so that the total fits exactly.

### 4.6 Step 4: Anti-starvation floor
Every task with `remaining > 0` is guaranteed at least `minBlock` once per rolling 7 days (if capacity exists). Implementation: track `lastScheduled(i)`; if `> 6 days`, boost its weight by ×3 for that day.

### 4.7 Step 5: Chunking into blocks
1. Convert `alloc(i)` minutes to blocks: choose block length `b` in `[minBlock, maxBlock]` (default 25–90) nearest to `alloc(i)` rounded to 5 min. If `alloc(i) < minBlock`, **carry the fraction forward** as a "deficit" counter and schedule a block on the day the deficit reaches `minBlock` (this is what makes a low-weight task appear every few days rather than as tiny useless slivers).
2. Order the day's blocks using **largest-deficit-first** (stride-style): the task furthest behind its fair share goes first.
3. Interleave: avoid more than 2 consecutive blocks of the same task; avoid back-to-back blocks of the same category when alternatives exist (FR-5.15).
4. Never exceed `remaining(i)` or the day's capacity; respect pinned blocks and category caps (FR-2.4).

### 4.8 Overload handling
If required pace cannot be met:
1. Switch Pool D to **EDF**: sort by due date (hard first) and fill capacity in that order.
2. Mark tasks that cannot finish as **At Risk** with `shortfall = remaining − schedulable` minutes.
3. Surface the warning (FR-5.8) with suggestions ranked by impact.
4. Pool F receives only the minimum anti-starvation time until the overload clears.

### 4.9 Spaced-spread mode (optional, FR-5.16)
For tasks tagged *Study/Exam*, replace `U` with a flatter curve `U = 1 + 4/(d+1)` and enforce a minimum frequency (at least every 2 to 3 days) so effort is spread rather than crammed, supported by spaced-practice research in learning science. The final 3 days before the exam are reserved for revision-only blocks (no new tasks planned against that exam's pool).

### 4.10 Daily loop (pseudocode)
```
function planDay(t, tasks, settings):
    C = capacity(t)                         # weekday capacity, minus days-off
    pools = split(tasks, hasDue)            # D and F
    capD, capF = divide(C, pools, settings.deadlineShare)
    for pool in [D, F]:
        for task in pool: task.w = P(task) * U(task, t) * S(task)
        for task in pool: task.floor = requiredPace(task) * safety   # D only
        alloc = distribute(cap_pool, tasks, by=w, floors=floors)
        if sum(floors) > cap_pool: return overload(pool)
    blocks = chunk(alloc, minBlock, maxBlock, deficits)
    return interleave(sortByDeficit(blocks)) + pinned

function planHorizon(tasks, settings):
    state = copy(tasks)
    for t in today .. today + horizon:
        blocks = planDay(t, state, settings)
        for b in blocks: state[b.task].remaining -= b.minutes
        plan[t] = blocks
    return plan, warnings
```
Complexity is `O(H × n log n)` (H = horizon days, n = tasks), comfortably under 10 ms for 500 tasks over 56 days.

### 4.11 Worked Example (the "exam in 4 weeks" case)

**Setup:** daily capacity 180 min. Tasks: Exam (hard, High, 20 h, due in 28 days), PP1 (Mid, no due date, 10 h), PP2 (Mid, no due date, 10 h).

| | Pool | Weight | Day 1 allocation |
|---|---|---|---|
| Exam | D | 4 × 1.41 × S | **135 min** (the pool gets 75% = 135) |
| PP1 | F | 2 × 1 × 1.0 | 22 min → carried as deficit |
| PP2 | F | 2 × 1 × 1.0 | 22 min → carried as deficit |

PP1 and PP2 each get 45 min of the 45-min flexible pool split; because that is ≥ `minBlock`, they alternate (PP1 one day, PP2 the next) while the exam receives a large block every day. At 7 days out the exam's urgency is 2.5, so its pace floor and weight rise and the flexible pool shrinks toward the minimum, but PP1 and PP2 still appear at least weekly. After the exam date, 100% of capacity returns to the projects. This matches the behaviour requested: the exam dominates proportionally, the projects are neither dropped nor equal.

---

## 5. Non-Functional Requirements

### 5.1 Performance
| ID | Requirement |
|---|---|
| NFR-1.1 | First Contentful Paint under 1.0 s on a mid-range laptop on broadband; under 2.0 s on 4G mobile |
| NFR-1.2 | Time to Interactive under 1.5 s |
| NFR-1.3 | Planner recompute under 200 ms for 500 active tasks and a 56-day horizon (run in a Web Worker if over 50 ms) |
| NFR-1.4 | UI interactions respond within 100 ms |
| NFR-1.5 | Total JS bundle under 100 KB gzipped; no heavy frameworks required |
| NFR-1.6 | Lighthouse Performance score ≥ 95 |

### 5.2 Usability and Design
| ID | Requirement |
|---|---|
| NFR-2.1 | Minimalist: monochrome base, a single accent colour, max two font weights, one typeface (system UI stack or Inter) |
| NFR-2.2 | Core action (add a task) reachable in one click/keystroke |
| NFR-2.3 | Maximum 3 levels of navigation; 4 top-level views |
| NFR-2.4 | Empty states explain what to do next |
| NFR-2.5 | Fully responsive from 360 px to 1920 px; mobile-first |
| NFR-2.6 | Destructive actions are always undoable or confirmed |

### 5.3 Accessibility
| ID | Requirement |
|---|---|
| NFR-3.1 | WCAG 2.2 AA compliance |
| NFR-3.2 | Full keyboard operation with visible focus states |
| NFR-3.3 | Correct semantic HTML and ARIA labels for custom controls; screen-reader tested (NVDA/VoiceOver) |
| NFR-3.4 | Colour contrast ≥ 4.5:1 for text; information never conveyed by colour alone |
| NFR-3.5 | Respects `prefers-reduced-motion` and `prefers-color-scheme` |
| NFR-3.6 | Touch targets at least 44×44 px |

### 5.4 Reliability and Data Integrity
| ID | Requirement |
|---|---|
| NFR-4.1 | No data loss on refresh, crash or tab close (write-through persistence on every change) |
| NFR-4.2 | Import validates schema and rejects malformed files without corrupting existing data |
| NFR-4.3 | Planner is deterministic: the same inputs always yield the same plan |
| NFR-4.4 | Schema versioning with forward migrations; automatic backup snapshot before each migration |
| NFR-4.5 | Handles clock/time-zone changes and DST correctly (store dates as local calendar dates, timestamps in UTC) |

### 5.5 Security and Privacy
| ID | Requirement |
|---|---|
| NFR-5.1 | All data stored locally; no data transmitted to any server in v1 |
| NFR-5.2 | No third-party trackers or analytics; no external CDN dependencies at runtime |
| NFR-5.3 | Strict Content-Security-Policy; all user text rendered as text (never `innerHTML`) to prevent XSS |
| NFR-5.4 | Served over HTTPS only with HSTS if hosted |
| NFR-5.5 | Sensitive notes (e.g. government paperwork reference numbers) are never logged to console or exports without user action |
| NFR-5.6 | Optional passcode lock / encrypted export (Web Crypto, AES-GCM) |

### 5.6 Compatibility
| ID | Requirement |
|---|---|
| NFR-6.1 | Latest two versions of Chrome, Edge, Firefox, Safari (desktop and mobile) |
| NFR-6.2 | Installable as a PWA with offline support via a service worker |
| NFR-6.3 | No server dependency; deployable as static files (GitHub Pages, Netlify, Cloudflare Pages) |

### 5.7 Maintainability and Quality
| ID | Requirement |
|---|---|
| NFR-7.1 | The planner is a **pure function module** (no DOM, no storage access), separately importable and testable |
| NFR-7.2 | ≥ 90% unit-test coverage on the planner; ≥ 70% overall |
| NFR-7.3 | TypeScript strict mode; ESLint and Prettier enforced in CI |
| NFR-7.4 | Modular structure: `core/` (planner, models), `data/` (storage), `ui/` (components) |
| NFR-7.5 | All tunable constants (weights, A values, shares) live in one config file with comments |
| NFR-7.6 | README with setup, architecture diagram, and algorithm summary |

### 5.8 Internationalisation
| ID | Requirement |
|---|---|
| NFR-8.1 | UK English default (dd/mm/yyyy, week starts Monday), configurable |
| NFR-8.2 | All strings in a single resource file for future translation |

---

## 6. Data Model

```ts
type Priority = "low" | "mid" | "high";
type CategoryId = "personal" | "uni" | "work" | "admin" | string;

interface Task {
  id: string;                 // UUID
  title: string;              // ≤120
  notes?: string;             // ≤2000
  category: CategoryId;
  priority: Priority;         // default "mid"
  due?: string;               // ISO date "YYYY-MM-DD"
  dueTime?: string;           // "HH:mm"
  hard: boolean;              // hard deadline
  estimateMin: number;        // multiple of 15
  doneMin: number;            // logged minutes
  startAfter?: string;        // ISO date
  mode: "standard" | "spread";// planner mode
  status: "open" | "done";
  completedAt?: string;       // ISO datetime
  createdAt: string;
  updatedAt: string;
}

interface Block {
  id: string;
  taskId: string;
  date: string;               // ISO date
  minutes: number;            // 5-min multiples
  startTime?: string;
  pinned: boolean;
  status: "planned" | "done" | "skipped";
  reason: { weight: number; urgency: number; share: number }; // for "why?"
}

interface Settings {
  capacityByWeekday: number[];             // 7 values, minutes
  daysOff: Record<string, number>;         // date -> reduced capacity
  deadlineShare: number;                   // 0.5–0.9, default 0.75
  minBlock: number; maxBlock: number;      // 25 / 90
  horizonDays: number;                     // 56
  bufferDays: number;                      // 1
  priorityWeights: { low: number; mid: number; high: number };
  categoryCaps: Record<CategoryId, number | null>;
  theme: "system" | "light" | "dark";
  schemaVersion: number;
}
```

---

## 7. User Interface Specification

### 7.1 Layout
- **Header:** app name (left), quick-add input (centre), settings cog (right).
- **Sidebar (desktop) / bottom tab bar (mobile):** Today · Week · All Tasks · Upcoming.
- **Main panel:** the active view.
- **Task dialog:** a single modal/sheet used for create and edit, with fields in this order: Title → Category → Due date → Priority → Estimate → Notes.

### 7.2 Today View (wireframe)
```
Today · Wed 25 Nov                         Planned 3h 00m
────────────────────────────────────────────────────────
[ ] Maths Exam revision        ● Uni      90 min   ⓘ
[ ] SQA Past paper             ● Uni      45 min   ⓘ
[ ] Project 1: auth module     ● Personal 30 min   ⓘ
[ ] Council tax form           ● Admin    15 min   ⓘ
────────────────────────────────────────────────────────
⚠ Exam revision is 2h behind pace.  [See options]
```

### 7.3 Visual Rules
- Neutral background (`#fafafa` / `#111`), text `#111` / `#eee`, one accent (e.g. `#3b6cff`).
- 4px spacing grid; 8px radius; no shadows beyond one subtle elevation.
- Priority shown as a small icon plus text (▲ High, ● Mid, ▽ Low).
- Overdue shown with a red text label "Overdue", not colour alone.

---

## 8. Technical Recommendations

| Concern | Recommendation |
|---|---|
| Stack | TypeScript + Vite; **Svelte** or **vanilla Web Components** (minimal bundle). React is acceptable if preferred |
| Storage | IndexedDB via `idb` (or Dexie); localStorage fallback |
| Planner execution | Pure TS module; run in a Web Worker if >50 ms |
| Dates | `Temporal` polyfill or `date-fns`; use local calendar dates for due dates |
| Testing | Vitest (unit), Playwright (end-to-end), axe-core (accessibility) |
| PWA | Workbox or hand-rolled service worker, with a manifest |
| Hosting | Static host with HTTPS |
| CI | GitHub Actions: lint, typecheck, test, Lighthouse CI |

---

## 9. Acceptance Criteria (key scenarios)

| ID | Scenario | Expected result |
|---|---|---|
| AC-1 | Add task with title only | Task appears under chosen category with Mid priority, no due date, in under 1 s |
| AC-2 | Delete task | Task removed; Undo restores it within 8 s |
| AC-3 | Add exam (hard, High, 20 h, 28 days away) plus two undated Mid projects | Exam gets the largest share daily; each project appears at least once in any 7-day window; projects alternate |
| AC-4 | Move the exam to 7 days away | Exam's daily minutes increase; flexible pool shrinks; no project removed |
| AC-5 | Deadline task (Low) vs undated task (High) | The deadline pool still receives ≥ 75% of capacity |
| AC-6 | Total required work exceeds capacity before a deadline | Overload warning names the task and the shortfall; EDF fallback applied |
| AC-7 | Mark a block done | `doneMin` increases; plan recalculates in under 200 ms |
| AC-8 | Skip a block yesterday | Its minutes reappear in the future plan |
| AC-9 | Set a day off | Capacity for that date drops; planner redistributes before and after |
| AC-10 | Export then import on a clean browser | Identical tasks, settings and plan |
| AC-11 | Go offline and reload | App loads and works fully |
| AC-12 | Same inputs run twice | Identical plans (determinism) |

### 9.1 Planner Unit-Test Checklist
- Empty task list → empty plan, no errors
- Single task fills capacity up to its remaining effort, never beyond
- Capacity 0 day → no blocks that day
- All tasks undated → capacity split by priority weight only
- All tasks dated → deadline pool uses 100% capacity
- Overdue task → maximum urgency and scheduled first
- Task due today with remaining > capacity → flagged At Risk
- Block lengths always within [min, max] and multiples of 5
- No task scheduled past its due date
- Starvation guard triggers after 6 idle days
- Pinned blocks are untouched by recompute

---

## 10. Milestones

| Phase | Deliverable | Est. effort |
|---|---|---|
| 1 | Project setup, data model, storage, task CRUD, categories, filters | 1 week |
| 2 | Priority, due dates, All Tasks view, quick-add, undo, themes | 1 week |
| 3 | **Planner core** (weights, tiers, chunking) with full unit tests | 1.5 weeks |
| 4 | Today and Week views, capacity settings, days off, explainability | 1 week |
| 5 | Overload handling, pinning, spread mode, roll-forward of missed blocks | 1 week |
| 6 | Import/export, PWA/offline, accessibility pass, performance tuning | 1 week |
| 7 | Testing, bug fixing, documentation, deploy | 0.5 week |

---

## 11. Risks and Assumptions

| Risk / Assumption | Mitigation |
|---|---|
| Effort estimates are often wrong | Show "behind pace" warnings; allow quick re-estimates; learn typical overrun in v2 |
| Constant replanning may feel unstable | Lock today's plan (FR-5.13); show diff on large changes |
| Constants (A = 8/12, P = 1/2/4, 75% share) may feel off | Centralise in config; expose in Advanced settings; tune from real use |
| Browser storage can be cleared | Prominent export/backup reminder every 30 days |
| Assumes one user on one device | Cloud sync noted as a v2 feature |

## 12. Future Enhancements (v2+)
Cloud sync and accounts, calendar integration, recurring tasks, learned effort estimates, energy-level scheduling (hard tasks at peak hours), Pomodoro timer with auto-logging, widgets and notifications, and a statistics dashboard (hours per category, on-time rate).
