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
    

    // new recommendation logic
    const bestTask = getBestTask(inProgress);
    const recText = document.getElementById("recommendationText");

    if (recText) {
      if (bestTask) {
        recText.textContent = `Start: ${bestTask.title}`;
      } else {
        recText.textContent = "No tasks available";
      }
    }
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
    // chrome.storage.local.get(['currentOrganization'], function (result) {
    //   const org = result.currentOrganization || 0;

    //   const algoNames = {
    //     0: "Unprioritized",
    //     1: "Earliest Deadline",
    //     2: "Easiest Difficulty",
    //     3: "Hardest Difficulty",
    //     4: "Fluctuating Times",
    //     5: "Randomly Prioritized"
    //   };

    //   if (algoDisplay) {
    //     algoDisplay.textContent = algoNames[org];
    //   };
    // });
    renderTasks();
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
      renderTasks(); // no algo choices
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


// Reworking core scoring function
function computeUrgency(date) {
  const now = new Date();
  const due = new Date(date);
  const diffDays = (due - now) / (1000 * 60 * 60 * 24);

  return Math.max(0, 1 - diffDays / 7); // closer = higher urgency
}

function computeEffort(time) {
  const map = {
    '15': 0.2,
    '30': 0.4,
    '60': 0.6,
    '120': 0.8,
    '240': 1
  };
  return map[time] || 0.5;
}

function computeEnergy(difficulty) {
  const map = {
    'Easy': 0.2,
    'Medium': 0.5,
    'Hard': 0.9
  };
  return map[difficulty] || 0.5;
}

function scoreTask(task) {
  const urgency = computeUrgency(task.date);
  const effort = computeEffort(task.time);
  const energy = computeEnergy(task.difficulty);

  return (
    urgency * 0.5 +
    (1 - effort) * 0.3 +
    energy * 0.2
  );
}

function getBestTask(tasks) {
  if (!tasks || tasks.length === 0) return null;

  return tasks.reduce((best, current) => {
    return scoreTask(current) > scoreTask(best) ? current : best;
  });
}