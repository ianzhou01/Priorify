// Since we are going to use only one logic JS script
// Make sure to use if (exists) for buttons and other things so we don't get errors

// Algorithm choices:
let currentOrganization = 0;
let algorithmChoice = Math.floor(Math.random() * 6) + 1;

const algoDisplay = document.getElementById('algoText');

if (currentOrganization === 0) {
  algoDisplay.textContent = "Unprioritized";
} else if (currentOrganization === 1) {
  algoDisplay.textContent = "Earliest Deadline";
} else if (currentOrganization === 2) {
  algoDisplay.textContent = "Easiest Difficulty";
} else if (currentOrganization === 3) {
  algoDisplay.textContent = "Hardest Difficulty";
} else if (currentOrganization === 4) {
  algoDisplay.textContent = "Fluctuating Times";
} else if (currentOrganization === 5) {
  algoDisplay.textContent = "Randomly Prioritized";
}

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
      currentOrganization = algorithmChoice;
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
      algorithmChoice = 1;
    });
  }

  if (a2Btn) {
    a2Btn.addEventListener('click', function () {
      algorithmChoice = 2;
    });
  }

  if (a3Btn) {
    a3Btn.addEventListener('click', function () {
      algorithmChoice = 3;
    });
  }

  if (a4Btn) {
    a4Btn.addEventListener('click', function () {
      algorithmChoice = 5;
    });
  }

  if (a5Btn) {
    a5Btn.addEventListener('click', function () {
      algorithmChoice = 6;
    });
  }

  if (a6Btn) {
    a6Btn.addEventListener('click', function () {
      algorithmChoice = Math.floor(Math.random() * 6) + 1;
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