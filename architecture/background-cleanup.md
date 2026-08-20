# Background Cleanup

## Summary
Three background loops keep server-side state from growing unbounded and
keep presence accurate: a periodic purge of stale/settled live sessions, a
periodic prune of old log files + `error_events` rows, and a sweep of the
in-memory presence tracker. Every purge/retention run is recorded in
`job_runs` (started/success/failed) — see [admin-panel.md](admin-panel.md)'s
`/admin/jobs` page and `GET /adminhealth`.

## Frontend
None.

## Backend
- `server/internal/cleanup/job.go`
  - `Run(st, reporter, idleRetentionDays, settledRetentionDays, interval, stop)` — ticker loop calling `PurgeOnce`; `PurgeOnce` deletes image files from disk **before** the cascading SQL delete (crash-safety: better to orphan a file than lose it), records a `session_purge` job run, and logs a `job_session_purge`-category warning/error via `reporter` for any image-removal or DB failure. Interval via `CLEANUP_INTERVAL_MINUTES` (default 30 min).
  - `RunLogRetention(st, reporter, logDir, retentionDays, interval, stop)` — ticker loop calling `LogRetentionOnce`, which prunes log files (`logging.PruneOldLogs`) and `error_events` rows (`store.PruneErrorEvents`) past `retentionDays`, recording a `log_retention` job run. Runs daily from `main.go`.
- `server/internal/store/store.go` — `PurgeStaleSessions(idleRetentionDays, settledRetentionDays)` (two independent thresholds — see Notes), `PurgeSessionByID`, `imagePathsForSession`, `StartJobRun`/`FinishJobRun`/`LatestJobRuns`/`ListRecentJobRuns`, `PruneErrorEvents`.
- `server/internal/logging/logging.go` — `PruneOldLogs(dir, retentionDays)`.
- `server/internal/presence/presence.go` — in-memory online/offline tracker; its own sweep loop is `RunPresenceSweeper` in `server/internal/api/api.go` (started from `main.go`, not from the `cleanup` package).

## Related features
- [live-collaboration.md](live-collaboration.md) — sessions/presence being cleaned up.
- [admin-panel.md](admin-panel.md) — manual single-session purge (same underlying delete path), job run history, `/adminhealth`.

## Notes
- Presence sweeping and session purging are separate loops with different
  owners (`cleanup` package vs. `api.RunPresenceSweeper`) — don't assume
  they're the same job.
- Idle (unsettled, inactive) and settled sessions use **independent**
  retention thresholds, not a single shared one: `IDLE_SESSION_RETENTION_DAYS`
  (default 14) for unsettled sessions past `last_access_at`,
  `SETTLED_SESSION_RETENTION_DAYS` (default 21) for settled sessions past
  `settled_at`. A settled session gets the longer 21-day window deliberately
  (review time after settling), even though it's also idle by definition.
- Log files and `error_events` share one retention knob, `LOG_RETENTION_DAYS`
  (default 30) — kept separate from the session-retention knobs since it
  governs an unrelated resource (server logs vs. user data).
