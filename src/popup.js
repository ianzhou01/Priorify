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
      loadTasks(function (tasks) {
        const match = tasks.find(t => t.title === task.title && t.status_completed === isCompleted);
        if (match) {
          isCompleted ? match.unmark() : match.mark();
          saveTasks(tasks, renderTasks);
        }
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

document.addEventListener('DOMContentLoaded', function () {
  renderTasks();

  if (window.location.pathname.includes('popup.html')) {
    chrome.storage.local.get(['currentOrganization'], function (result) {
      const org = result.currentOrganization || 0;

      const algoNames = {
        0: "Unprioritized",
        1: "Earliest Deadline",
        2: "Easiest Difficulty",
        3: "Hardest Difficulty",
        4: "Fluctuating Times",
        5: "Randomly Prioritized"
      };

      if (algoDisplay) {
        algoDisplay.textContent = algoNames[org];
      };
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
    pBtn.addEventListener('click', function () {
      chrome.storage.local.get(['currentOrganization'], function (result) {
        const org = result.currentOrganization || 0;

        const algoNames = {
          0: "Unprioritized",
          1: "Earliest Deadline",
          2: "Easiest Difficulty",
          3: "Hardest Difficulty",
          4: "Fluctuating Times",
          5: "Randomly Prioritized"
        };

        if (algoDisplay) {
          algoDisplay.textContent = algoNames[org];
        }

        renderTasks();
      });
    });
  }

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
      window.location.href = 'popup.html';
    });
  }

  if (a2Btn) {
    a2Btn.addEventListener('click', function () {
      chrome.storage.local.set({ currentOrganization: 2 });
      window.location.href = 'popup.html';
    });
  }

  if (a3Btn) {
    a3Btn.addEventListener('click', function () {
      chrome.storage.local.set({ currentOrganization: 3 });
      window.location.href = 'popup.html';
    });
  }

  if (a4Btn) {
    a4Btn.addEventListener('click', function () {
      chrome.storage.local.set({ currentOrganization: 4 });
      window.location.href = 'popup.html';
    });
  }

  if (a5Btn) {
    a5Btn.addEventListener('click', function () {
      chrome.storage.local.set({ currentOrganization: 5 });
      window.location.href = 'popup.html';
    });
  }

  if (a6Btn) {
    a6Btn.addEventListener('click', function () {
      chrome.storage.local.set({ currentOrganization: Math.floor(Math.random() * 6) + 1 });
      window.location.href = 'popup.html';
    });
  }

  // taskform.html logic
  const taskForm = document.getElementById('taskForm');
  const cancelBtn = document.getElementById('cancelBtn');

  if (taskForm) {
    taskForm.addEventListener('submit', function (e) {
      e.preventDefault();

      const task = new Task(
        document.getElementById('title').value,
        document.getElementById('date').value,
        document.getElementById('time').value,
        document.getElementById('difficulty').value
      );

      loadTasks(function (tasks) {
        tasks.push(task);
        saveTasks(tasks, function () {
          window.location.href = 'popup.html'; // only navigates after save completes
        });
      });

      window.location.href = 'popup.html';
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', function () {
      window.location.href = 'popup.html';
    });
  }
});

function sortByDate(tasks, callback) {
  return tasks.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateA - dateB;
  });

  saveTasks(tasks, callback);
}

function sortByDifficulty(tasks, callback) {
  const difficultyOrder = { 'Easy': 1, 'Medium': 2, 'Hard': 3 };
  return tasks.sort((a, b) => difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty]);

  saveTasks(tasks, callback);
}

function sortByInverseDifficulty(tasks, callback) {
  const difficultyOrder = { 'Easy': 1, 'Medium': 2, 'Hard': 3 };
  return tasks.sort((a, b) => difficultyOrder[b.difficulty] - difficultyOrder[a.difficulty]);

  saveTasks(tasks, callback);
}

function sortByTime(tasks, callback) {
  const timeOrder = { '15': 1, '30': 2, '60': 3, '120': 4, '240': 5 };
  return tasks.sort((a, b) => timeOrder[a.time] - timeOrder[b.time]);

  saveTasks(tasks, callback);
}

function sortByFluctuatingTimes(tasks, callback) {
  while (tasks.length > 0) {
    result.push(tasks.shift());
    if (sortedArray.length > 0) {
      result.push(tasks.pop());
    }
  }
  saveTasks(result, callback); //saving the new order of tasks now instead of the tasks instance
}

function sortByRandom(tasks, callback) {
  return tasks.sort(() => Math.random() - 0.5);

  saveTasks(tasks, callback);
}
