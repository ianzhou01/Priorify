// Since we are going to use only one logic JS script
// make sure to use if (exists) for buttons and other things so we don't get errors

class Task {
  constructor(_title, _date, _time, _difficulty) {
    this.title = _title
    this.date = _date
    this.time = _time
    this.difficulty = _difficulty
    this.status_completed = false
  }

  mark() {
    this.status_completed = true
  }

  unmark() {
    this.status_completed = false
  }
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

      const task = {
        name: document.getElementById('taskName').value,
        dueDate: document.getElementById('dueDate').value,
        priority: document.getElementById('priority').value,
        timeCommitment: document.getElementById('timeCommitment').value,
      };

      const tasks = JSON.parse(localStorage.getItem('priorify_tasks') || '[]');
      tasks.push(task);
      localStorage.setItem('priorify_tasks', JSON.stringify(tasks));

      window.location.href = 'popup.html';
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', function () {
      window.location.href = 'popup.html';
    });
  }

});