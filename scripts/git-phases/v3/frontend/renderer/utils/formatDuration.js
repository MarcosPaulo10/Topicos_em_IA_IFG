export function formatDuration(seconds) {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m > 0) return `${m} min ${s}s`;
  return `${s}s`;
}
