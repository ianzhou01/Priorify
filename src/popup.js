// Since we are going to use only one logic JS script
// Make sure to use if (exists) for buttons and other things so we don't get errors

const algoDisplay = document.getElementById('algoText');

// Task class definition
class Task {
  constructor(_title, _date, _time, _difficulty) {
    this.title = _title;
    this.date = _date; //    ->    MM/DD/YYYY
    this.time = _time;
    this.difficulty = _difficulty;
    this.status_completed = false;
  }

  mark() {
    this.status_completed = true;
  }

  unmark() {
    this.status_completed = false;
  }
}

// Storage helpers
function saveTasks(tasks, callback) {
  chrome.storage.local.set({ priorify_tasks: tasks }, callback);
}

function loadTasks(callback) {
  chrome.storage.local.get('priorify_tasks', function (result) {
    const raw = result.priorify_tasks || [];
    const tasks = raw.map(t => {
      const task = new Task(t.title, t.date, t.time, t.difficulty);
      task.status_completed = t.status_completed;
      return task;
    });
    callback(tasks);
  });
}

// Task Card (fetches template from taskcard.html)
let cardTemplateCache = null;

function getCardTemplate() {
  if (cardTemplateCache) return Promise.resolve(cardTemplateCache);
  return fetch(chrome.runtime.getURL('src/taskcard.html'))
    .then(res => res.text())
    .then(html => {
      cardTemplateCache = html;
      return html;
    });
}

// Build a task card element from a Task object
function buildTaskCard(task, isCompleted) {
  const difficultyEmoji = { Hard: '🔴', Medium: '🟡', Easy: '🟢' }[task.difficulty] || '';
  const timeLabel = { '15': '15 min', '30': '30 min', '60': '1 hr', '120': '2 hrs', '240': '4+ hrs' }[task.time] || `${task.time} min`;

  return getCardTemplate().then(html => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    const card = wrapper.firstElementChild;

    card.querySelector('.task-title').textContent = task.title;
    card.querySelector('.task-meta').innerHTML = `📅 ${task.date} &nbsp;|&nbsp; ⏱ ${timeLabel} &nbsp;|&nbsp; ${difficultyEmoji} ${task.difficulty}`;
    card.querySelector('.mark-btn').textContent = isCompleted ? '↩ Unmark' : '✔ Mark Complete';

    card.querySelector('.mark-btn').addEventListener('click', function () {
      // Act immediately for responsive UI
      loadTasks(function (tasks) {
        const match = tasks.find(t => t.title === task.title && t.status_completed === isCompleted);
        if (!match) return;
        isCompleted ? match.unmark() : match.mark();
        saveTasks(tasks, renderTasks);

        const label = isCompleted ? 'Task unmarked ↩' : 'Task completed ✓';
        showUndoToast(label, function doUndo() {
          loadTasks(function (tasks) {
            const revert = tasks.find(t => t.title === task.title && t.status_completed !== isCompleted);
            if (revert) {
              isCompleted ? revert.mark() : revert.unmark();
              saveTasks(tasks, renderTasks);
            }
          });
        });
      });
    });

    card.querySelector('.delete-btn').addEventListener('click', function () {
      if (!confirm(`Delete "${task.title}"?`)) return;
      loadTasks(function (tasks) {
        const updated = tasks.filter(t => !(t.title === task.title && t.status_completed === isCompleted));
        saveTasks(updated, renderTasks);
      });
    });

    card.querySelector('.edit-btn').addEventListener('click', function () {
      chrome.storage.local.set({ editingTask: { title: task.title, wasCompleted: isCompleted } }, () => {
        window.location.href = 'taskform.html';
      });
    });

    return card;
  });
}

// Render tasks on popup.html
function renderTasks() {
  loadTasks(function (tasks) {
    const inProgressEl = document.getElementById('inProgress');
    const completedEl = document.getElementById('completed');

    if (!inProgressEl || !completedEl) return;

    const inProgress = tasks.filter(t => !t.status_completed);
    const completed = tasks.filter(t => t.status_completed);

    const pBtn = document.getElementById('prioritizeBtn');
    if (pBtn) pBtn.disabled = inProgress.length === 0;

    inProgressEl.innerHTML = '<h2>In Progress</h2>';
    if (inProgress.length === 0) {
      inProgressEl.innerHTML += '<p>Tasks in progress will appear here.</p>';
    } else {
      inProgress.forEach(task => {
        buildTaskCard(task, false).then(card => inProgressEl.appendChild(card));
      });
    }

    completedEl.innerHTML = '<h2>Completed</h2>';
    if (completed.length === 0) {
      completedEl.innerHTML += '<p>Completed tasks will appear here.</p>';
    } else {
      completed.forEach(task => {
        buildTaskCard(task, true).then(card => completedEl.appendChild(card));
      });
    }
  });
}

function applySorting(org) {
  const algoNames = {
    0: "Unprioritized",
    1: "Earliest Deadline",
    2: "Easiest Difficulty",
    3: "Hardest Difficulty",
    4: "Fluctuating Times",
    5: "Randomly Prioritized"
  };

  if (algoDisplay) {
    algoDisplay.textContent = algoNames[org] || "Unprioritized";
  }

  switch (org) {
    case 1: loadTasks(tasks => sortByDate(tasks, renderTasks)); break;
    case 2: loadTasks(tasks => sortByDifficulty(tasks, renderTasks)); break;
    case 3: loadTasks(tasks => sortByInverseDifficulty(tasks, renderTasks)); break;
    case 4: loadTasks(tasks => sortByFluctuatingTimes(tasks, renderTasks)); break;
    case 5: loadTasks(tasks => sortByRandom(tasks, renderTasks)); break;
    default: renderTasks(); break;
  }
}

document.addEventListener('DOMContentLoaded', function () {
  if (window.location.pathname.includes('popup.html')) {
    loadSettings(_applySettingsCache);

    // Sync timer state from background before rendering anything else
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, function (state) {
      if (state && state.running) {
        renderTimerView(state.taskName, state.secondsLeft, state.paused);
        if (!state.paused) startTick();
      } else {
        // Check if the timer expired while popup was closed
        chrome.storage.local.get('priorify_timer', function (result) {
          if (result.priorify_timer && result.priorify_timer.expired) {
            chrome.storage.local.set({ priorify_timer: { running: false } });
            showOnly('checkInView');
          } else {
            renderTasks();
          }
        });
      }
    });
  }


  // Settings panel
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsPanel = document.getElementById('settingsPanel');

  function closeSettings() {
    settingsPanel.classList.remove('open');
    settingsBtn.classList.remove('open');
  }

  if (settingsBtn && settingsPanel) {
    settingsBtn.addEventListener('click', function () {
      const isOpen = settingsPanel.classList.toggle('open');
      settingsBtn.classList.toggle('open', isOpen);
    });

    const settingsCloseBtn = document.getElementById('settingsCloseBtn');
    if (settingsCloseBtn) {
      settingsCloseBtn.addEventListener('click', closeSettings);
    }

    settingsPanel.addEventListener('change', function () {
      const priority = settingsPanel.querySelector('input[name="priority"]:checked').value;
      const duration = parseInt(settingsPanel.querySelector('input[name="duration"]:checked').value, 10);
      saveSettings({ priority, duration }, function () {
        _applySettingsCache({ priority, duration });
      });
    });
  }

  // popup.html logic
  const aBtn = document.getElementById('addBtn');
  const pBtn = document.getElementById('prioritizeBtn');


  if (aBtn) {
    aBtn.addEventListener('click', function () {
      window.location.href = 'taskform.html';
    });
  }

  if (pBtn) {
    pBtn.addEventListener('click', function (e) {
      fireRipple(pBtn, e);

      // Spring bounce
      pBtn.classList.remove('pressed');
      void pBtn.offsetWidth; // force reflow so re-clicking restarts animation
      pBtn.classList.add('pressed');
      pBtn.addEventListener('animationend', () => pBtn.classList.remove('pressed'), { once: true });

      renderTasks();

      // Update recommendation box
      loadTasks(function (tasks) {
        const inProgress = tasks.filter(t => !t.status_completed);
        const bestTask = getBestTask(inProgress, _currentPriorityMode);
        const box = document.getElementById('recommendationBox');
        const recText = document.getElementById('recommendationText');
        const recMeta = document.getElementById('recommendationMeta');
        const recRationale = document.getElementById('recommendationRationale');

        if (!box || !recText) return;

        if (bestTask) {
          recText.textContent = bestTask.title;
          if (recMeta)      recMeta.textContent      = getRecMeta(bestTask);
          if (recRationale) recRationale.textContent = getRecRationale(bestTask);
        } else {
          recText.textContent = 'No tasks available';
          if (recMeta)      recMeta.textContent      = '';
          if (recRationale) recRationale.textContent = '';
        }

        // Reveal with fade on first click; just update content on subsequent clicks
        if (!box.classList.contains('visible')) {
          box.classList.add('visible');
          requestAnimationFrame(() => box.classList.add('faded-in'));
        }
      });
    });
  }

  const sBtn = document.getElementById('startBtn');
  if (sBtn) {
    sBtn.addEventListener('click', function (e) {
      fireRipple(sBtn, e);
      const taskName = document.getElementById('recommendationText').textContent;
      startTimer(taskName, _currentDuration);
    });
  }

  const pauseBtn = document.getElementById('pauseBtn');
  if (pauseBtn) {
    pauseBtn.addEventListener('click', function (e) {
      fireRipple(pauseBtn, e);
      togglePause();
    });
  }

  const giveUpBtn = document.getElementById('giveUpBtn');
  if (giveUpBtn) {
    giveUpBtn.addEventListener('click', function (e) {
      fireRipple(giveUpBtn, e);
      stopTimer();
    });
  }

  // Check-in screen buttons
  function rippleWire(id, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', function (e) { fireRipple(el, e); fn(); });
  }

  rippleWire('checkInYes',      () => showOnly('checkInYesView'));
  rippleWire('checkInNo',       () => showOnly('checkInNoView'));
  rippleWire('continueBtn',     () => startTimer(currentTaskTitle, _currentDuration));
  rippleWire('newRecBtn',       () => showNewRecommendation(currentTaskTitle));
  rippleWire('tryShortBtn',     () => startTimer(currentTaskTitle, TIMER_SHORT));
  rippleWire('suggestOtherBtn', () => showNewRecommendation(currentTaskTitle));

  // algo.html logic
  const a1Btn = document.getElementById('a1Btn');
  const a2Btn = document.getElementById('a2Btn');
  const a3Btn = document.getElementById('a3Btn');
  const a4Btn = document.getElementById('a4Btn');
  const a5Btn = document.getElementById('a5Btn');
  const a6Btn = document.getElementById('a6Btn');

  if (a1Btn) {
    a1Btn.addEventListener('click', function () {
      chrome.storage.local.set({ currentOrganization: 1 });
      chrome.storage.local.set({ algorithmChoice: 1 });
      window.location.href = 'popup.html';
    });
  }

  if (a2Btn) {
    a2Btn.addEventListener('click', function () {
      chrome.storage.local.set({ currentOrganization: 2 });
      chrome.storage.local.set({ algorithmChoice: 2 });
      window.location.href = 'popup.html';
    });
  }

  if (a3Btn) {
    a3Btn.addEventListener('click', function () {
      chrome.storage.local.set({ currentOrganization: 3 });
      chrome.storage.local.set({ algorithmChoice: 3 });
      window.location.href = 'popup.html';
    });
  }

  if (a4Btn) {
    a4Btn.addEventListener('click', function () {
      chrome.storage.local.set({ currentOrganization: 4 });
      chrome.storage.local.set({ algorithmChoice: 4 });
      window.location.href = 'popup.html';
    });
  }

  if (a5Btn) {
    a5Btn.addEventListener('click', function () {
      chrome.storage.local.set({ currentOrganization: 5 });
      chrome.storage.local.set({ algorithmChoice: 5 });
      window.location.href = 'popup.html';
    });
  }

  if (a6Btn) {
    a6Btn.addEventListener('click', function () {
      let r = Math.floor(Math.random() * 6) + 1;
      chrome.storage.local.set({ currentOrganization: r });
      chrome.storage.local.set({ algorithmChoice: r });
      window.location.href = 'popup.html';
    });
  }

  // taskform.html logic
  const taskForm = document.getElementById('taskForm');
  const cancelBtn = document.getElementById('cancelBtn');

  if (taskForm) {
    chrome.storage.local.get(['editingTask'], function (result) {
      if (result.editingTask) {
        const { title, wasCompleted } = result.editingTask;
        document.getElementById('formHeading').textContent = 'Edit Task';
        loadTasks(function (tasks) {
          const match = tasks.find(t => t.title === title && t.status_completed === wasCompleted);
          if (match) {
            document.getElementById('title').value = match.title;
            document.getElementById('date').value = match.date;
            document.getElementById('time').value = match.time;
            document.getElementById('difficulty').value = match.difficulty;
          }
        });
      }
    });

    taskForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const newTitle = document.getElementById('title').value;
      const newDate = document.getElementById('date').value;
      const newTime = document.getElementById('time').value;
      const newDifficulty = document.getElementById('difficulty').value;

      chrome.storage.local.get(['editingTask'], function (result) {
        loadTasks(function (tasks) {
          if (result.editingTask) {
            const { title, wasCompleted } = result.editingTask;
            const match = tasks.find(t => t.title === title && t.status_completed === wasCompleted);
            if (match) {
              match.title = newTitle;
              match.date = newDate;
              match.time = newTime;
              match.difficulty = newDifficulty;
            }
            chrome.storage.local.remove('editingTask');
          } else {
            tasks.push(new Task(newTitle, newDate, newTime, newDifficulty));
          }
          saveTasks(tasks, () => {
            chrome.storage.local.set({ currentOrganization: 0 });
            window.location.href = 'popup.html';
          });
        });
      });
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', function () {
      window.location.href = 'popup.html';
    });
  }
});

function sortByDate(tasks, callback) {
  tasks.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateA - dateB;
  });

  saveTasks(tasks, callback);
}

function sortByDifficulty(tasks, callback) {
  const difficultyOrder = { 'Easy': 1, 'Medium': 2, 'Hard': 3 };
  tasks.sort((a, b) => difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty]);

  saveTasks(tasks, callback);
}

function sortByInverseDifficulty(tasks, callback) {
  const difficultyOrder = { 'Easy': 1, 'Medium': 2, 'Hard': 3 };
  tasks.sort((a, b) => difficultyOrder[b.difficulty] - difficultyOrder[a.difficulty]);

  saveTasks(tasks, callback);
}

function sortByTime(tasks, callback) {
  const timeOrder = { '15': 1, '30': 2, '60': 3, '120': 4, '240': 5 };
  tasks.sort((a, b) => timeOrder[a.time] - timeOrder[b.time]);

  saveTasks(tasks, callback);
}

function sortByFluctuatingTimes(tasks, callback) {
  const timeOrder = { '15': 1, '30': 2, '60': 3, '120': 4, '240': 5 };
  tasks.sort((a, b) => timeOrder[a.time] - timeOrder[b.time]);
  let result = [];
  while (tasks.length > 0) {
    result.push(tasks.shift());
    if (tasks.length > 0) {
      result.push(tasks.pop());
    }
  }
  saveTasks(result, callback);
}

function sortByRandom(tasks, callback) {
  tasks.sort(() => Math.random() - 0.5);

  saveTasks(tasks, callback);
}


// ── Settings ──────────────────────────────────────────────
const DEFAULT_SETTINGS = { priority: 'balanced', duration: 1500 };

function loadSettings(callback) {
  chrome.storage.local.get('priorify_settings', function (result) {
    callback(Object.assign({}, DEFAULT_SETTINGS, result.priorify_settings));
  });
}

function saveSettings(settings, callback) {
  chrome.storage.local.set({ priorify_settings: settings }, callback);
}

function applySettingsToUI(settings) {
  // Sync radio buttons
  const panel = document.getElementById('settingsPanel');
  if (panel) {
    const pRadio = panel.querySelector(`input[name="priority"][value="${settings.priority}"]`);
    const dRadio = panel.querySelector(`input[name="duration"][value="${settings.duration}"]`);
    if (pRadio) pRadio.checked = true;
    if (dRadio) dRadio.checked = true;
  }

  // Update start button label
  const mins = Math.round(settings.duration / 60);
  const sBtn = document.getElementById('startBtn');
  if (sBtn) sBtn.textContent = `▶ Start ${mins} min`;

  // Update continue button label in check-in yes view
  const cBtn = document.getElementById('continueBtn');
  if (cBtn) cBtn.textContent = `Continue (${mins} min)`;
}

let _currentPriorityMode = 'balanced';
let _currentDuration = 1500;

// Keep module-level cache in sync whenever settings are loaded/saved
function _applySettingsCache(settings) {
  _currentPriorityMode = settings.priority;
  _currentDuration = settings.duration;
  applySettingsToUI(settings);
}

// Undo Toast
let toastTimer = null;
let pendingUndo = null;

function showUndoToast(label, doUndo) {
  const toast = document.getElementById('undoToast');
  const undoBtn = document.getElementById('undoBtn');
  const msgEl = document.getElementById('undoToastMsg');
  if (!toast) return;

  // Dismiss any existing toast without reversing the previous action
  if (toastTimer) {
    clearTimeout(toastTimer);
    dismissToast();
  }

  msgEl.textContent = label;
  toast.classList.add('visible');

  pendingUndo = doUndo;

  undoBtn.onclick = function () {
    clearTimeout(toastTimer);
    dismissToast();
    doUndo();
  };

  toastTimer = setTimeout(dismissToast, 4000);
}

function dismissToast() {
  const toast = document.getElementById('undoToast');
  if (toast) toast.classList.remove('visible');
  toastTimer = null;
  pendingUndo = null;
}

// Ripple helper 
function fireRipple(btn, e) {
  const ripple = document.createElement('span');
  ripple.classList.add('ripple');
  const rect = btn.getBoundingClientRect();
  ripple.style.left = (e.clientX - rect.left) + 'px';
  ripple.style.top  = (e.clientY - rect.top)  + 'px';
  btn.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
}

// ── Timer ─────────────────────────────────────────────────
const TIMER_SHORT = 10 * 60;
let currentTaskTitle = '';
let tickInterval = null;

const MAIN_IDS = ['.container', '#recommendationBox', '#tasksContainer'];
const FLOW_IDS = ['#timerView', '#checkInView', '#checkInYesView', '#checkInNoView'];

function showOnly(activeId) {
  FLOW_IDS.forEach(id => {
    const el = document.getElementById(id.replace('#', ''));
    if (el) el.classList.remove('active');
  });
  MAIN_IDS.forEach(sel => {
    const el = sel.startsWith('#')
      ? document.getElementById(sel.replace('#', ''))
      : document.querySelector(sel);
    if (el) el.style.display = 'none';
  });
  if (activeId) {
    const el = document.getElementById(activeId);
    if (el) el.classList.add('active');
  }
}

function showMain() {
  FLOW_IDS.forEach(id => {
    const el = document.getElementById(id.replace('#', ''));
    if (el) el.classList.remove('active');
  });
  document.querySelector('.container').style.display = '';
  document.getElementById('tasksContainer').style.display = '';
  const box = document.getElementById('recommendationBox');
  if (box.classList.contains('visible')) box.style.display = '';
}

function renderTimerView(taskName, secondsLeft, paused) {
  currentTaskTitle = taskName;
  document.getElementById('timerTaskName').textContent = taskName;
  document.getElementById('pauseBtn').textContent = paused ? '▶ Resume' : '⏸ Pause';
  document.getElementById('timerDisplay').classList.toggle('paused', paused);
  setTimerDisplay(secondsLeft);
  showOnly('timerView');
}

function setTimerDisplay(secondsLeft) {
  const m = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const s = String(secondsLeft % 60).padStart(2, '0');
  document.getElementById('timerDisplay').textContent = `${m}:${s}`;
}

// Start a local tick that re-reads state from background each second
function startTick() {
  clearInterval(tickInterval);
  tickInterval = setInterval(function () {
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, function (state) {
      if (!state || !state.running) {
        clearInterval(tickInterval);
        showOnly('checkInView');
        return;
      }
      if (!state.paused) setTimerDisplay(state.secondsLeft);
    });
  }, 1000);
}

function startTimer(taskName, duration) {
  chrome.runtime.sendMessage({ type: 'START_TIMER', taskName, duration });
  renderTimerView(taskName, duration, false);
  startTick();
}

function togglePause() {
  chrome.runtime.sendMessage({ type: 'PAUSE_TIMER' });
  // Optimistically flip the UI; next tick will confirm
  const display = document.getElementById('timerDisplay');
  const pauseBtn = document.getElementById('pauseBtn');
  const nowPaused = !display.classList.contains('paused');
  display.classList.toggle('paused', nowPaused);
  pauseBtn.textContent = nowPaused ? '▶ Resume' : '⏸ Pause';
  if (nowPaused) clearInterval(tickInterval);
  else startTick();
}

function stopTimer() {
  chrome.runtime.sendMessage({ type: 'STOP_TIMER' });
  clearInterval(tickInterval);
  showOnly('checkInView');
}

function showNewRecommendation(excludeTitle) {
  loadTasks(function (tasks) {
    const inProgress = tasks.filter(t => !t.status_completed && t.title !== excludeTitle);
    const bestTask = getBestTask(inProgress, _currentPriorityMode);
    const box = document.getElementById('recommendationBox');
    const recText = document.getElementById('recommendationText');
    const recMeta = document.getElementById('recommendationMeta');
    const recRationale = document.getElementById('recommendationRationale');

    showMain();
    renderTasks();

    if (bestTask) {
      recText.textContent = bestTask.title;
      if (recMeta)      recMeta.textContent      = getRecMeta(bestTask);
      if (recRationale) recRationale.textContent = getRecRationale(bestTask);
      box.classList.add('visible');
      box.style.display = '';
      requestAnimationFrame(() => box.classList.add('faded-in'));
    }
  });
}

