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

document.addEventListener('DOMContentLoaded', function() {
  const aBtn = document.getElementById('addBtn');
  const pBtn = document.getElementById('prioritizeBtn');
  
  if (aBtn) { // here
  aBtn.addEventListener('click', function() {
    alert("Add a task");
  });
  }

  if (pBtn) { // here
  pBtn.addEventListener('click', function() {
    alert("Prioritize the Tasks")
  });
  }


});

