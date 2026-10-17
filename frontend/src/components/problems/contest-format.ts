/** "3h", "90m" or "12d": a contest that runs for a year should not read as 8761h. */
export function formatDuration(minutes: number): string {
  if (minutes >= 2 * 24 * 60) return `${Math.round(minutes / (24 * 60))}d`;
  if (minutes >= 120) return `${Math.round((minutes / 60) * 10) / 10}h`;
  return `${minutes}m`;
}
