# Background Cleanup

## Summary
Two background loops keep server-side state from growing unbounded and keep
presence accurate: a periodic purge of stale/settled live sessions (48h,
per `planv3.md` 3.8), and a sweep of the in-memory presence tracker.

## Frontend
None.

## Backend
- `server/internal/cleanup/job.go` — `Run(st, interval, stop)` ticker loop calling `PurgeOnce`; `PurgeOnce` deletes image files from disk **before** the cascading SQL delete (crash-safety: better to orphan a file than lose it), then logs purged session IDs. Interval via `CLEANUP_INTERVAL_MINUTES` (default 30 min).
- `server/internal/store/store.go` — `PurgeStaleSessions` (enforces the actual staleness threshold), `PurgeSessionByID`, `imagePathsForSession`.
- `server/internal/presence/presence.go` — in-memory online/offline tracker; its own sweep loop is `RunPresenceSweeper` in `server/internal/api/api.go` (started from `main.go`, not from the `cleanup` package).

## Related features
- [live-collaboration.md](live-collaboration.md) — sessions/presence being cleaned up.
- [admin-panel.md](admin-panel.md) — manual single-session purge, same underlying delete path.

## Notes
- Presence sweeping and session purging are two separate loops with
  different owners (`cleanup` package vs. `api.RunPresenceSweeper`) — don't
  assume they're the same job.
