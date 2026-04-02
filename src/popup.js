// Since we are going to use only one logic JS script
// Make sure to use if (exists) for buttons and other things so we don't get errors

// Task class definition
class Task {
  constructor(_title, _date, _time, _difficulty, _importance = 3) {
    this.title = _title;
    this.date = _date; //    ->    MM/DD/YYYY
    this.time = _time;
    this.difficulty = _difficulty;
    this.importance = _importance;
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
      const task = new Task(t.title, t.date, t.time, t.difficulty, t.importance ?? 3);
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

function resetRecommendationIfMatches(taskTitle) {
  const recText = document.getElementById('recommendationText');
  const box = document.getElementById('recommendationBox');
  if (recText && recText.textContent === taskTitle) {
    recText.textContent = 'Click Prioritize to get a recommendation';
    document.getElementById('recommendationMeta').textContent = '';
    document.getElementById('recommendationRationale').textContent = '';
    clearRecExplanation();
    if (box) {
      box.classList.remove('visible', 'faded-in');
      box.style.display = 'none';
    }
  }
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
    const stars = '★'.repeat(task.importance) + '☆'.repeat(5 - task.importance);
    card.querySelector('.task-meta').innerHTML = `📅 ${task.date} &nbsp;|&nbsp; ⏱ ${timeLabel} &nbsp;|&nbsp; ${difficultyEmoji} ${task.difficulty} &nbsp;|&nbsp; <span class="task-stars">${stars}</span>`;
    card.querySelector('.mark-btn').textContent = isCompleted ? '↩ Unmark' : '✔ Mark Complete';

    card.querySelector('.mark-btn').addEventListener('click', function () {
      // Act immediately for responsive UI
      loadTasks(function (tasks) {
        const match = tasks.find(t => t.title === task.title && t.status_completed === isCompleted);
        if (!match) return;

        isCompleted ? match.unmark() : match.mark();
        saveTasks(tasks, renderTasks);

        // Show toast for undo
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
        saveTasks(updated, function () { renderTasks(); resetRecommendationIfMatches(task.title); });
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
  return new Promise(resolve => {
    loadTasks(function (tasks) {
      const inProgressEl = document.getElementById('inProgress');
      const completedEl = document.getElementById('completed');
      if (!inProgressEl || !completedEl) return resolve();

      inProgressEl.innerHTML = '<h2>In Progress</h2>';
      completedEl.innerHTML = '<h2>Completed</h2>';
      
      const inProgress = tasks.filter(t => !t.status_completed);
      const completed = tasks.filter(t => t.status_completed);

      const pBtn = document.getElementById('prioritizeBtn');
      if (pBtn) {
        pBtn.disabled = inProgress.length === 0;
        pBtn.classList.toggle('disabled', inProgress.length === 0);
      }

      const allCards = [
        ...inProgress.map(task => buildTaskCard(task, false)),
        ...completed.map(task => buildTaskCard(task, true))
      ];

      Promise.all(allCards).then(cards => {
        inProgress.forEach((t, i) => inProgressEl.appendChild(cards[i]));
        completed.forEach((t, i) => completedEl.appendChild(cards[i + inProgress.length]));
        resolve();
      });    
    });
  });
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
            switchView('checkInView');
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

  // (?) explanation toggle
  const explainBtn = document.getElementById('explainBtn');
  const recExplanation = document.getElementById('recExplanation');
  if (explainBtn && recExplanation) {
    explainBtn.addEventListener('click', function () {
      recExplanation.classList.toggle('visible');
      explainBtn.textContent = recExplanation.classList.contains('visible') ? '✕' : '?';
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
        const bestTask   = getBestTask(inProgress, _currentPriorityMode);
        const runnerUp   = getSecondBestTask(inProgress, _currentPriorityMode, bestTask);
        const box        = document.getElementById('recommendationBox');
        if (!box) return;

        if (bestTask) {
          renderRecBox(bestTask, runnerUp);
        } else {
          document.getElementById('recommendationText').textContent = 'No tasks available';
          document.getElementById('recommendationMeta').textContent = '';
          document.getElementById('recommendationRationale').textContent = '';
          clearRecExplanation();
        }

        // Reveal with fade on first click; just update content on subsequent clicks
        if (!box.classList.contains('visible')) {
          box.style.display = '';
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

  rippleWire('checkInYes',      () => switchView('checkInYesView'));
  rippleWire('checkInNo',       () => switchView('checkInNoView'));
  rippleWire('markDoneBtn',     () => {
    loadTasks(function (tasks) {
      const match = tasks.find(t => t.title === currentTaskTitle && !t.status_completed);
      if (match) match.mark();
      saveTasks(tasks, renderTasks);
      const box = document.getElementById('recommendationBox');
      document.getElementById('recommendationText').textContent = 'Click Prioritize to get a recommendation';
      document.getElementById('recommendationMeta').textContent = '';
      document.getElementById('recommendationRationale').textContent = '';
      clearRecExplanation();
      if (box) { box.classList.remove('visible', 'faded-in'); box.style.display = 'none'; }
      switchView('main');
    });
  });
  rippleWire('continueBtn',     () => startTimer(currentTaskTitle, _currentDuration));
  rippleWire('newRecBtn',       () => showNewRecommendation(currentTaskTitle));
  rippleWire('tryShortBtn',     () => startTimer(currentTaskTitle, TIMER_SHORT));
  rippleWire('suggestOtherBtn', () => showNewRecommendation(currentTaskTitle));

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
            setStarRating(match.importance ?? 3);
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
      const newImportance = parseInt(document.getElementById('importance').value, 10);

      chrome.storage.local.get(['editingTask'], function (result) {
        loadTasks(function (tasks) {
          // Guardrail: prevent duplicate task titles
          const isDuplicate = tasks.some(t =>
            t.title === newTitle && (!result.editingTask || t.title !== result.editingTask.title)
          );
          if (isDuplicate) {
            alert('Task title must be unique. Choose a different name.');
            return;
          }

          if (result.editingTask) {
            const { title, wasCompleted } = result.editingTask;
            const match = tasks.find(t => t.title === title && t.status_completed === wasCompleted);
            if (match) {
              match.title = newTitle;
              match.date = newDate;
              match.time = newTime;
              match.difficulty = newDifficulty;
              match.importance = newImportance;
            }
            chrome.storage.local.remove('editingTask');
          } else {
            tasks.push(new Task(newTitle, newDate, newTime, newDifficulty, newImportance));
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

  // Star picker (taskform.html)
  const starPicker = document.getElementById('starPicker');
  if (starPicker) {
    setStarRating(3);
    starPicker.querySelectorAll('.star').forEach(function (star) {
      star.addEventListener('click', function () {
        setStarRating(parseInt(star.dataset.value, 10));
      });
      star.addEventListener('mouseover', function () {
        highlightStars(starPicker, parseInt(star.dataset.value, 10));
      });
      star.addEventListener('mouseleave', function () {
        highlightStars(starPicker, parseInt(document.getElementById('importance').value, 10));
      });
    });
  }
});

function setStarRating(value) {
  const starPicker = document.getElementById('starPicker');
  if (!starPicker) return;
  document.getElementById('importance').value = value;
  highlightStars(starPicker, value);
}

function highlightStars(picker, value) {
  picker.querySelectorAll('.star').forEach(function (star) {
    star.classList.toggle('active', parseInt(star.dataset.value, 10) <= value);
  });
}


//  Settings 
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

//  Timer 
const TIMER_SHORT = 10 * 60; // Used for "Try Shorter" option on check-in screen
let currentTaskTitle = '';
let tickInterval = null;

const MAIN_IDS = ['.container', '#recommendationBox', '#tasksContainer'];
const FLOW_IDS = ['#timerView', '#checkInView', '#checkInYesView', '#checkInNoView'];

function switchView(id) {
  FLOW_IDS.forEach(flowId => {
    const el = document.getElementById(flowId.replace('#', ''));
    if (el) el.classList.remove('active');
  });

  if (id === 'main') {
    document.querySelector('.container').style.display = '';
    document.getElementById('tasksContainer').style.display = '';
    const box = document.getElementById('recommendationBox');
    if (box && box.classList.contains('visible')) box.style.display = '';
  } else {
    MAIN_IDS.forEach(sel => {
      const el = sel.startsWith('#')
        ? document.getElementById(sel.replace('#', ''))
        : document.querySelector(sel);
      if (el) el.style.display = 'none';
    });
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  }
}

function renderTimerView(taskName, secondsLeft, paused) {
  currentTaskTitle = taskName;
  document.getElementById('timerTaskName').textContent = taskName;
  document.getElementById('pauseBtn').textContent = paused ? '▶ Resume' : '⏸ Pause';
  document.getElementById('timerDisplay').classList.toggle('paused', paused);
  setTimerDisplay(secondsLeft);
  switchView('timerView');
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
        switchView('checkInView');
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
  switchView('checkInView');
}

function showNewRecommendation(excludeTitle) {
  loadTasks(function (tasks) {
    const inProgress = tasks.filter(t => !t.status_completed && t.title !== excludeTitle);
    const bestTask   = getBestTask(inProgress, _currentPriorityMode);
    const runnerUp   = getSecondBestTask(inProgress, _currentPriorityMode, bestTask);
    const box        = document.getElementById('recommendationBox');

    switchView('main');
    renderTasks();

    if (bestTask) {
      renderRecBox(bestTask, runnerUp);
      box.classList.add('visible');
      box.style.display = '';
      requestAnimationFrame(() => box.classList.add('faded-in'));
    }
  });
}

function renderRecBox(best, runner) {
  document.getElementById('recommendationText').textContent = best.title;
  document.getElementById('recommendationMeta').textContent = getRecMeta(best);
  document.getElementById('recommendationRationale').textContent = getRecSummary(best);

  const explanation = getRecExplanation(best, runner, _currentPriorityMode);
  if (explanation) {
    const panel = document.getElementById('recExplanation');
    panel.innerHTML = `<div class="explain-header">${explanation.winner} chosen over ${explanation.runner}</div>`
      + '<ul>' + explanation.lines.map(l => `<li>${l}</li>`).join('') + '</ul>';
    // Keep panel open/closed state but refresh content; reset to closed on new recommendation
    panel.classList.remove('visible');
    const btn = document.getElementById('explainBtn');
    if (btn) btn.textContent = '?';
  } else {
    clearRecExplanation();
  }
}

function clearRecExplanation() {
  const panel = document.getElementById('recExplanation');
  if (panel) { panel.innerHTML = ''; panel.classList.remove('visible'); }
  const btn = document.getElementById('explainBtn');
  if (btn) btn.textContent = '?';
}

