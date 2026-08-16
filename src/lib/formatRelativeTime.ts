// Req 12: brief, human-readable timestamps for the activity log instead of
// a raw ISO/SQLite-format string. No date library dependency — this is the
// only place in the app that needs relative time.
//
// The server's `now()` (store.go) writes "YYYY-MM-DD HH:MM:SS" in UTC with
// no timezone marker, so a bare `new Date(...)` would parse it as local
// time — appending "Z" (after swapping the space for "T") makes it parse
// as UTC, matching what the server actually wrote.
export function formatRelativeTime(timestamp: string, now: Date = new Date()): string {
  const parsed = new Date(timestamp.includes('T') ? timestamp : `${timestamp.replace(' ', 'T')}Z`);
  if (Number.isNaN(parsed.getTime())) return timestamp;

  const diffSeconds = Math.round((now.getTime() - parsed.getTime()) / 1000);
  if (diffSeconds < 5) return 'just now';
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
