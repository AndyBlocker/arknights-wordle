// A question's deadline follows elapsed wall time, independent of timer throttling.
export function getQuestionDeadline(startTime, seconds) {
  return seconds >= 300 ? Infinity : startTime + seconds * 1000;
}

export function getRemainingSeconds(deadline, now) {
  return deadline === Infinity ? Infinity : Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function getElapsedSeconds(startTime, now) {
  return Math.max(0, (now - startTime) / 1000);
}

export function formatElapsedTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '未知';
  const wholeSeconds = Math.round(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = wholeSeconds % 60;
  return minutes > 0 ? `${minutes}:${String(remainder).padStart(2, '0')}` : `${wholeSeconds}秒`;
}
