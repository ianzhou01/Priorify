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

function computeImportance(importance) {
  return (Math.max(1, Math.min(5, importance)) - 1) / 4; // 1★ → 0, 5★ → 1
}

//  Weighted scoring 

const SCORE_WEIGHTS = {
  urgent:   { urgency: 0.7, length: 0.05, effort: 0.05, importance: 0.2 },
  easy:     { urgency: 0.15, length: 0.5, effort: 0.15, importance: 0.2 },
  balanced: { urgency: 0.4, length: 0.25, effort: 0.15, importance: 0.2 },
};

// mode: 'urgent' | 'easy' | 'balanced'
function scoreTask(task, mode) {
  const urgency    = computeUrgency(task.date);
  const length     = computeLength(task.time);
  const effort     = computeEffort(task.difficulty);
  const importance = computeImportance(task.importance ?? 3);
  const w = SCORE_WEIGHTS[mode] || SCORE_WEIGHTS.balanced;

  return (
    urgency        * w.urgency +
    (1 - length)   * w.length  +
    (1 - effort)   * w.effort  +
    importance     * w.importance
  );
}

function getBestTask(tasks, mode) {
  if (!tasks || tasks.length === 0) return null;
  return tasks.reduce((best, current) =>
    scoreTask(current, mode) > scoreTask(best, mode) ? current : best
  );
}

function getSecondBestTask(tasks, mode, winner) {
  const rest = tasks.filter(t => t !== winner);
  return getBestTask(rest, mode);
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

// Short inline summary shown beneath the task name by default
function getRecSummary(task) {
  const urgency    = computeUrgency(task.date);
  const length     = computeLength(task.time);
  const importance = task.importance ?? 3;
  const parts      = [];

  if (urgency > 0.7)        parts.push('urgent');
  else if (urgency > 0.35)  parts.push('moderate deadline');
  if (importance >= 4)      parts.push('high importance');
  if (length < 0.4)         parts.push('quick win');

  return parts.length ? parts.join(' · ') : 'top pick';
}

//  Comparative explanation 
const IMPORTANCE_LABELS = { 1: 'minimal', 2: 'low', 3: 'moderate', 4: 'high', 5: 'critical' };
const TIME_LABELS = { '15': '15 min', '30': '30 min', '60': '1 hr', '120': '2 hrs', '240': '4+ hrs' };
const DIFFICULTY_LABELS = { Easy: 'easy', Medium: 'moderate', Hard: 'hard' };

function getRecExplanation(winner, runner, mode) {
  if (!runner) return null;

  const lines = [];

  // Importance
  const wi = winner.importance ?? 3;
  const ri = runner.importance ?? 3;
  if (wi !== ri) {
    lines.push(`Importance: ${IMPORTANCE_LABELS[wi]} vs ${IMPORTANCE_LABELS[ri]}`);
  }

  // Urgency
  const wu = computeUrgency(winner.date);
  const ru = computeUrgency(runner.date);
  const wDays = Math.round(Math.max(0, (new Date(winner.date) - new Date()) / (1000 * 60 * 60 * 24)));
  const rDays = Math.round(Math.max(0, (new Date(runner.date) - new Date()) / (1000 * 60 * 60 * 24)));
  const wDueStr = wDays === 0 ? 'today' : wDays === 1 ? 'tomorrow' : `in ${wDays}d`;
  const rDueStr = rDays === 0 ? 'today' : rDays === 1 ? 'tomorrow' : `in ${rDays}d`;
  if (Math.abs(wu - ru) > 0.05) {
    const dir = wu > ru ? 'More urgent' : 'Less urgent';
    lines.push(`Urgency: ${dir} (due ${wDueStr} vs ${rDueStr})`);
  }

  // Effort (length)
  const wl = computeLength(winner.time);
  const rl = computeLength(runner.time);
  const wLenStr = TIME_LABELS[winner.time] || winner.time;
  const rLenStr = TIME_LABELS[runner.time] || runner.time;
  if (wl !== rl) {
    const w = SCORE_WEIGHTS[mode] || SCORE_WEIGHTS.balanced;
    if (wl < rl) {
      lines.push(`Effort: Shorter task (${wLenStr} vs ${rLenStr})`);
    } else {
      // Longer but still won — explain why
      const importanceJustifies = wi > ri && w.importance > 0.15;
      const urgencyJustifies    = wu > ru + 0.2;
      const qualifier = importanceJustifies ? ', justified by importance'
                      : urgencyJustifies    ? ', justified by urgency'
                      : '';
      lines.push(`Effort: Longer (${wLenStr} vs ${rLenStr})${qualifier}`);
    }
  }

  // Difficulty
  const we = computeEffort(winner.difficulty);
  const re = computeEffort(runner.difficulty);
  if (we !== re) {
    const wDiff = DIFFICULTY_LABELS[winner.difficulty] || winner.difficulty;
    const rDiff = DIFFICULTY_LABELS[runner.difficulty] || runner.difficulty;
    lines.push(`Difficulty: ${wDiff} vs ${rDiff}`);
  }

  if (lines.length === 0) {
    lines.push('Marginally higher overall score');
  }

  return {
    winner: winner.title,
    runner: runner.title,
    lines
  };
}
