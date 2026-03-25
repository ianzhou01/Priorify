// Since we are going to use only one logic JS script
// make sure to use if (exists) for buttons and other things so we don't get errors

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
  algoDisplay.textContent = "Intermittent Times";
} else if (currentOrganization === 5) {
  algoDisplay.textContent = "Random";
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

// Storage helpers (chrome.storage.local)
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

// Render tasks into In Progress / Completed sections
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
        // TODO: Implement task card building
        // inProgressEl.innerHTML += buildTaskCard(task, false);
      });
    }
 
    completedEl.innerHTML = '<h2>Completed</h2>';
    if (completed.length === 0) {
      completedEl.innerHTML += '<p>Completed tasks will appear here.</p>';
    } else {
      completed.forEach(task => {
        // TODO: Implement task card building
        // completedEl.innerHTML += buildTaskCard(task, true);
      });
    }
 
    // Attach mark/unmark listeners after rendering
    document.querySelectorAll('.mark-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const targetTitle = this.dataset.title;
        const isCompleted = this.dataset.completed === 'true';
 
        loadTasks(function (tasks) {
          const task = tasks.find(t => t.title === targetTitle && t.status_completed === isCompleted);
          if (task) {
            isCompleted ? task.unmark() : task.mark();
            saveTasks(tasks, renderTasks);
          }
        });
      });
    });
  });
}

document.addEventListener('DOMContentLoaded', function () {

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
      alert("Prioritize the Tasks");
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

      const tasks = loadTasks();
      tasks.push(task);
      saveTasks(tasks);

      window.location.href = 'src/popup.html';
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', function () {
      window.location.href = 'popup.html';
    });
  }
});