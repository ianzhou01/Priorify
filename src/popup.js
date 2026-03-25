// Since we are going to use only one logic JS script
// make sure to use if (exists) for buttons and other things so we don't get errors

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

