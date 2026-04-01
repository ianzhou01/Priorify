//  Raw score components 

function computeUrgency(date) {
  const now = new Date();
  const due = new Date(date);
  const diffDays = Math.max(0, (due - now) / (1000 * 60 * 60 * 24));

  return Math.exp(-diffDays / 4); // Added exponential decay to increase sensitivity near deadlines
}

function computeLength(time) {
  const map = { '15': 0.2, '30': 0.4, '60': 0.6, '120': 0.8, '240': 1 };
  return map[time] || 0.5;
}

function computeEffort(difficulty) {
  const map = { 'Easy': 0.2, 'Medium': 0.5, 'Hard': 0.9 };
  return map[difficulty] || 0.5;
}

//  Weighted scoring 

const SCORE_WEIGHTS = {
  urgent:   { urgency: 0.8, length: 0.1, effort: 0.1 },
  easy:     { urgency: 0.2, length: 0.6, effort: 0.2 },
  balanced: { urgency: 0.5, length: 0.3, effort: 0.2 },
};

// mode: 'urgent' | 'easy' | 'balanced'
function scoreTask(task, mode) {
  const urgency = computeUrgency(task.date);
  const length  = computeLength(task.time);
  const effort  = computeEffort(task.difficulty);
  const w = SCORE_WEIGHTS[mode] || SCORE_WEIGHTS.balanced;

  return (
    urgency        * w.urgency +
    (1 - length)   * w.length  +
    (1 - effort)   * w.effort
  );
}

function getBestTask(tasks, mode) {
  if (!tasks || tasks.length === 0) return null;
  return tasks.reduce((best, current) =>
    scoreTask(current, mode) > scoreTask(best, mode) ? current : best
  );
}

//  Recommendation display helpers 

function formatDueDate(dateStr) {
  const now = new Date();
  const due = new Date(dateStr);
  const diffDays = Math.round((due - now) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  return `Due in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
}

function getRecMeta(task) {
  const timeLabel = { '15': '15 min', '30': '30 min', '60': '1 hr', '120': '2 hrs', '240': '4+ hrs' }[task.time] || `${task.time} min`;
  const difficultyEmoji = { Hard: '🔴', Medium: '🟡', Easy: '🟢' }[task.difficulty] || '';
  return `${formatDueDate(task.date)} • ${timeLabel} • ${difficultyEmoji} ${task.difficulty}`;
}

function getRecRationale(task) {
  const urgency = computeUrgency(task.date);
  const effort  = computeLength(task.time);
  const energy  = computeEffort(task.difficulty);
  const parts   = [];

  if (urgency > 0.7)       parts.push('High urgency');
  else if (urgency > 0.35) parts.push('Moderate urgency');
  else                     parts.push('Low urgency');

  if (effort < 0.4)        parts.push('quick win');
  else if (effort < 0.7)   parts.push('manageable effort');
  else                     parts.push('heavy lift');

  if (energy > 0.7)        parts.push('high energy needed');
  else if (energy > 0.4)   parts.push('moderate focus');
  else                     parts.push('low energy needed');

  return parts.join(' + ');
}
