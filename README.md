# Priorify

**Priorify** is a browser extension that helps you stop guessing which task to work on next. It scores your task list using a configurable prioritization algorithm, recommends the single best task to tackle right now, and pairs that recommendation with a focused work session timer so you can act on it immediately.

---

## Vision

Most task lists are just anxiety lists. Priorify turns your backlog into a clear, ranked queue by factoring in deadlines, effort, difficulty, and importance together rather than letting one dimension dominate. You choose how you want to work (urgency-first, quick wins, or balanced) and Priorify does the rest.

---

## Features

### Task Management

Create tasks with four dimensions of metadata:

| Field | Options |
|-------|---------|
| **Due date** | MM/DD/YYYY |
| **Time commitment** | 15 min, 30 min, 1 hr, 2 hrs, 4+ hrs |
| **Difficulty** | Easy, Medium, Hard |
| **Importance** | 1 to 5 stars |

Tasks live in two sections: **In Progress** and **Completed**. You can edit, delete, or mark tasks complete at any time, with a 4-second undo window on completions.

### Prioritization

Click **Prioritize** and Priorify scores every in-progress task, selects the best one, and surfaces a recommendation card with:

- The recommended task and its key metadata
- A runner-up task for comparison
- A "Why this task?" explanation that calls out the specific differences in urgency, effort, importance, and difficulty that put the winner ahead

### Focused Work Sessions

Start a timed session directly from the recommendation card. Three session lengths are available: **10 min**, **25 min** (default), and **45 min**. The timer runs in the background via Chrome alarms so it survives popup closes. When time is up, a system notification fires and the extension opens a check-in flow.

### Check-in Flow

After a session expires, Priorify asks a simple question: **Did you make progress?**

- **Yes** -> Continue with the same task or get a fresh recommendation
- **No** -> Try a 10-minute sprint or switch to a different task

From either path you can also mark the task as done directly.

### Settings

| Setting | Options | Default |
|---------|---------|---------|
| Priority mode | Urgent, Easy Wins, Balanced | Balanced |
| Session duration | 10 min, 25 min, 45 min | 25 min |

Settings persist locally and apply immediately on the next prioritization.

---

## Scoring Mechanism

Priorify scores tasks across four normalized components, each on a 0 to 1 scale.

### Score Components

**Urgency**

Uses exponential decay based on days until the due date:

```
urgency = e^(-daysDue / 4)
```

This tracks human mental models of tasks, with greatly heightened urgency as tasks approach deadlines. For instance, a task due today scores roughly 0.78, and a task due in four days scores roughly 0.37. Overdue tasks are clamped to 0 days remaining so they stay at full urgency.

**Task Length** (inverted in the final score)

Maps time commitment to a discrete score:

| Duration | Raw Score |
|----------|-----------|
| 15 min | 0.20 |
| 30 min | 0.40 |
| 1 hr | 0.60 |
| 2 hrs | 0.80 |
| 4+ hrs | 1.00 |

Shorter tasks score higher in the final weighted sum because the raw value is inverted: `(1 - length)`.

**Effort/Difficulty** (inverted in the final score)

| Difficulty | Raw Score |
|------------|-----------|
| Easy | 0.20 |
| Medium | 0.50 |
| Hard | 0.90 |

Easier tasks score higher for the same reason: `(1 - effort)`.

**Importance**

Linear mapping from your star rating for each task:

```
importance = (stars - 1) / 4
```

1 star = 0.0, 3 stars = 0.5, 5 stars = 1.0.

### Weighted Sum

```
score = (urgency * w.urgency)
      + ((1 - length) * w.length)
      + ((1 - effort) * w.effort)
      + (importance * w.importance)
```

The weights come from whichever priority mode is active:

| Weight | Urgent | Easy Wins | Balanced |
|--------|--------|-----------|----------|
| Urgency | 0.70 | 0.15 | 0.40 |
| Length | 0.05 | 0.50 | 0.25 |
| Effort | 0.05 | 0.15 | 0.15 |
| Importance | 0.20 | 0.20 | 0.20 |

**Urgent mode** is deadline-driven. Use it when you have hard deadlines bearing down.

**Easy Wins mode** rewards short, simple tasks. Use it when you need momentum or are clearing a backlog.

**Balanced mode** gives a fair weighting to all four factors. This is the default and works well for most day-to-day planning.

---

## Technical Architecture

Priorify is a Manifest V3 Chrome extension built with vanilla JavaScript and the Chrome extension APIs.

```
/manifest.json         Extension manifest (V3)
/src/
  popup.html           Main UI shell
  popup.js             All UI logic and state management
  popup.css            Styling
  taskform.html        Task creation and edit form
  taskcard.html        Task card template (cached on first load)
  background.js        Service worker: timer alarms and notifications
  scoring.js           Scoring algorithm
```

**Storage** is handled entirely through `chrome.storage.local` with three keys:

- `priorify_tasks` - the task array
- `priorify_settings` - priority mode and session duration
- `priorify_timer` - live timer state (task name, end timestamp, pause state)

**Timer state** is authoritative in the background service worker and polled by the popup UI every second via message passing. This means the timer survives popup closes and browser restarts within the same session.

---

## Installation
### Official Release
Priorify will shortly be available on the Chrome Web Store and Mozilla Firefox, pending review.

### Local Download
#### Chrome
1. Clone or download this repository.
2. Open `chrome://extensions` in your browser.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the project folder.
5. Pin the Priorify icon to your toolbar and start adding tasks.

#### Firefox
1. Clone or download this repository.
2. Inside the project directory, select all files, right-click, and compress to ZIP.
3. In Firefox, enter "about:debugging" in the URL bar.
4. Click "This Firefox."
5. Click "Load Temporary Add-on."
6. Upload the .zip file containing the project contents.
