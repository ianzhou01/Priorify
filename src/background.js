let currentOrganization = 0;
let algorithmChoice = Math.floor(Math.random() * 6) + 1;

document.addEventListener('DOMContentLoaded', function () {
  const a1Btn = document.getElementById('a1Btn');
  const a2Btn = document.getElementById('a2Btn');
  const a3Btn = document.getElementById('a3Btn');
  const a4Btn = document.getElementById('a4Btn');
  const a5Btn = document.getElementById('a5Btn');
  const a6Btn = document.getElementById('a6Btn');
  const pBtn = document.getElementById('prioritizeBtn');

  if (pBtn) {
    pBtn.addEventListener('click', function () {
      currentOrganization = algorithmChoice;
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
    });
  }

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
});