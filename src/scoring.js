function score(task) {
  return (
    task.urgency * 0.5 +
    (1 - task.effort) * 0.3 +
    task.energyMatch * 0.2
  );
}