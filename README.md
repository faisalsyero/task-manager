# Daymark

A minimalist task manager and smart daily planner built as a static website.

## Open the website

After GitHub Pages finishes its first deployment, open:

**https://faisalsyero.github.io/task-manager/**

The workflow in `.github/workflows/pages.yml` publishes the site whenever changes are pushed to `main` and enables Pages automatically if needed. The workflow run and repository **Deployments** page show when the site is live.

## Save your tasks

Tasks and settings are automatically saved to this browser's local storage as you make changes. They are not uploaded to GitHub or any other server. Your data stays in the browser profile and device where you entered it, so it will not automatically appear on another device or in a different browser. Clearing browser data will remove the saved tasks.

Use **Settings → Export JSON backup** to download a restorable copy. Keep that file somewhere safe, and use **Import backup** to restore it or move your data to another browser. CSV export is also available for task lists.

## Features

- Today, Week, All tasks and Upcoming views
- Quick-add with optional `!high`, `!low`, `#uni`, `#work`, `#admin`, `#personal`, `@fri` or `@YYYY-MM-DD` tags
- Task categories, priority, effort, notes and deadlines
- A deterministic weighted planner that favours deadline work and rebalances remaining effort
- Daily capacity, per-date capacity adjustments, completion and manual time logging
- Undo for task deletion, search, JSON backup/restore and CSV export
- Responsive layout, keyboard navigation, system light/dark theme and offline support after the first visit

## Run locally

No build step, package installation or server is required. Open `index.html` in a browser, or serve this directory with any static file server. Browser storage is scoped to the website origin, so local-file data and the GitHub Pages site's data are separate.

## Structure

- `index.html` — semantic app shell and dialogs
- `styles.css` — responsive light/dark UI
- `src/app.js` — views, task interactions, and data management
- `src/data.js` — local persistence and backup validation
- `src/planner.js` — pure deterministic schedule generation
- `sw.js` and `manifest.webmanifest` — offline app shell and install metadata
- `.github/workflows/pages.yml` — GitHub Pages deployment

The planner divides daily capacity between deadline and flexible tasks, distributes each pool proportionally by priority, deadline urgency, and remaining effort, and transfers unused time between pools. All scheduling runs in the browser.
