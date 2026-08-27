export const NAME_EDIT_LOCK_DURATION_MS = 60 * 60 * 1000; // 1 hour

export interface NameEditLockInput {
  /** Has a linked joiner (approved/pending) — see PeopleSection.tsx's usePeoplePresence. */
  linked: boolean;
  /** Currently online per GET /api/sessions/{code}/presence's `online` list. */
  online: boolean;
  /** That endpoint's `activeSince` entry for this person, if online; null otherwise. */
  activeSinceMs: number | null;
  now?: number;
}

/**
 * Whether the creator should be blocked from renaming a person: disabled
 * only while they're claimed (linked) AND currently online AND have been
 * continuously active for less than an hour — unclaimed people, or anyone
 * not currently online, are always editable.
 *
 * Limitation, by design: presence.Tracker (server/internal/presence) is
 * deliberately ephemeral/in-memory and forgets an entry after FlushAfter
 * (10 minutes) — it never retains "last seen N hours ago" for someone who
 * has been offline a while, only whether they're online *right now* plus
 * how long their current streak has run. So "offline for more than an hour"
 * can't be measured directly; going offline at all (even briefly) already
 * unlocks editing here, which is the closest faithful behavior achievable
 * without persisting presence history beyond the tracker's existing
 * ephemeral design (a deliberately out-of-scope change — see
 * UIV3_27_08_2026log.md's decisions log).
 */
export const isNameEditLocked = ({ linked, online, activeSinceMs, now = Date.now() }: NameEditLockInput): boolean => {
  if (!linked || !online || activeSinceMs === null) return false;
  return now - activeSinceMs < NAME_EDIT_LOCK_DURATION_MS;
};
