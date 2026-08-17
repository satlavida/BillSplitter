// Tracks live-server pushes that are still in flight, keyed by a
// caller-chosen string (e.g. `item:<id>:fields`). sessionStore.ts's push
// helpers are fire-and-forget — never awaited by their callers — while
// LiveSessionPanel/BillEditorPage independently poll/SSE-refresh a live
// snapshot and merge it back in. Without this, a snapshot that lands before
// a push is acknowledged clobbers the just-made local edit with stale
// remote data. mergeLiveBill (sessionStore.ts) checks isPendingLiveWrite to
// skip overwriting exactly the fields that have an unacknowledged push,
// rather than blocking the UI on every edit.
//
// Refcounted (not a boolean) so two concurrent pushes to the same key (e.g.
// rapid double-toggle) don't have the first one's completion clear the
// guard out from under the second.
const counts = new Map<string, number>();

export function beginPendingLiveWrite(key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

export function endPendingLiveWrite(key: string): void {
  const next = (counts.get(key) ?? 0) - 1;
  if (next <= 0) {
    counts.delete(key);
  } else {
    counts.set(key, next);
  }
}

export function isPendingLiveWrite(key: string): boolean {
  return (counts.get(key) ?? 0) > 0;
}

// 1:1 replacement for a bare fire-and-forget promise: marks `key` pending
// synchronously, clears it once `promise` settles (success or failure),
// and otherwise passes the promise through unchanged so existing
// `.catch(() => {})` call sites keep working as-is.
export function trackPendingLiveWrite<T>(key: string, promise: Promise<T>): Promise<T> {
  beginPendingLiveWrite(key);
  // .finally() returns its own derived promise; if `promise` rejects, that
  // derived promise rejects too, and since nothing else observes it, it
  // becomes an unhandled rejection unless swallowed here. This doesn't
  // affect the original `promise` returned below — callers still see (and
  // can catch) the real rejection.
  promise.finally(() => endPendingLiveWrite(key)).catch(() => {});
  return promise;
}
