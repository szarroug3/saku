/** "2 hours ago". Coarse on purpose — every caller uses this for a nudge, not
 * a stopwatch: minutes under an hour, whole hours under a day, whole days
 * beyond that. Originally local to PracticeResume; pulled out here so the
 * Current sessions list (SAK-67) can print the same "started …" phrasing
 * instead of growing its own copy that could drift from this one. */
export function relativeTime(ts: number, now: number): string {
  const mins = Math.round((now - ts) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
