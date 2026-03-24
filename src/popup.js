document.addEventListener('DOMContentLoaded', function() {
  const aBtn = document.getElementById('addBtn');
  const pBtn = document.getElementById('prioritizeBtn');
  
  aBtn.addEventListener('click', function() {
    alert("Add a task");
  });

  pBtn.addEventListener('click', function() {
    alert("Prioritize the Tasks")
  });
});