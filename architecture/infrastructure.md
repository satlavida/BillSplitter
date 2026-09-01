# Infrastructure

## Summary
Cross-cutting platform concerns that don't belong to a single feature:
server bootstrapping, configuration, CORS/logging middleware, deployment,
and the frontend's shared UI kit.

## Frontend
- `src/ui/components.tsx` — shared UI kit: `Button`, `Card`, `Disclosure`,
  `Modal`, `FileUpload`, `Spinner`, `Alert`, `ProgressBar`, `ToggleButton`,
  `SelectAllButton`, `PrintButton`, `PrintWrapper`, `Dropdown`,
  `SearchSelect`, `Checkbox`. `Disclosure` is a native
  `<details>/<summary>`-based collapsible section (accessible/keyboard-
  operable by default, no extra open/close state).
  **Check here before adding a new one-off styled element** — there is no
  toast/notification system; errors are surfaced via local `useState` +
  `Alert`. See [ui-design-system.md](ui-design-system.md) for page-
  composition conventions and a Creator-vs-Joiner UI-consistency audit.
- `src/Components/ErrorBoundary.tsx` — class-component error boundary
  (React error boundaries can't be hooks). Mounted twice: `main.tsx` around
  the whole `<App>` (last-resort, unrecoverable short of reload), and
  `App.tsx`'s `AppShell` around `<Outlet>`, keyed by `location.pathname` so
  it remounts (clearing the error) on navigation — a crash on one routed
  page doesn't take down the sidebar/header. Doesn't catch event-handler or
  async errors (a React limitation, not a bug here) — those still need
  their own try/catch.
- `src/lib/generateId.ts` — 5-char alphanumeric ID generator (session/bill codes, etc.).
- `src/lib/formatRelativeTime.ts` — human-readable relative timestamps (used by the activity log, [live-collaboration.md](live-collaboration.md)).
- `src/lib/errorMessages.ts` — maps raw server error strings to user-facing copy.

## Backend
- `server/cmd/server/main.go` — entrypoint: loads config, initializes `internal/logging` (stdout + daily-rotating log file), opens SQLite (runs migrations on open), constructs `store.Store`/`sse.Hub`/`logging.Reporter`/`api.API`, starts the session-purge ticker, the log/error-retention ticker, and the presence sweeper goroutines, wraps the router in `middleware.Logging(middleware.Allowlist(...))`, graceful shutdown on SIGINT/SIGTERM, exposes build `version` via `GET /healthz`.
- `server/internal/config/config.go` — env vars: `PORT` (8080), `DB_PATH` (`./data/billsplitter.db`), `IMAGE_DIR` (`./data/images`), `ALLOWED_ORIGINS` (CSV, empty by default), `ADMIN_TOKEN` (empty → admin panel + `/adminhealth` disabled), `CLEANUP_INTERVAL_MINUTES` (30), `OPENROUTER_API_KEY` (empty → scan disabled), `OPENROUTER_MODEL` (default `google/gemini-3.1-flash-lite`, overridable at runtime via the admin settings page — see [scan-receipt.md](scan-receipt.md)), `LOG_DIR` (`./data/logs`), `LOG_RETENTION_DAYS` (30), `IDLE_SESSION_RETENTION_DAYS` (14), `SETTLED_SESSION_RETENTION_DAYS` (21). Also loads `server/.env` (gitignored) from `.env`/`../.env`/`../../.env` relative to cwd; real env vars always take precedence.
- `server/internal/middleware/allowlist.go` — `Allowlist(allowedOrigins, next)`; always allows localhost/127.0.0.1, exact-matches configured origins otherwise; implements CORS headers and `OPTIONS` preflight.
- `server/internal/middleware/logging.go` — `Logging(next)`; logs method/path/status/duration; `statusWriter` forwards `Flush()` so SSE streaming isn't broken by the wrapper.
- `server/internal/logging/logging.go` — `Init(dir)` points the standard `log` package at stdout + a daily-rotating `<dir>/billsplitter-YYYY-MM-DD.log` file; `PruneOldLogs(dir, retentionDays)` deletes files past retention; `Reporter.Warn`/`Reporter.Error` log a line **and** durably record it via `store.RecordErrorEvent` (a timestamped `error_events` row plus a simple lifetime counter in `settings`), so failures surface in the log file, the admin panel, and `GET /adminhealth`.
- `server/internal/db/` — SQLite connection (`modernc.org/sqlite`, pure Go, no CGO) + embedded migrations in `internal/db/migrations/`, applied in filename order on every startup (`CREATE TABLE IF NOT EXISTS`, idempotent).
- `server/internal/store/store.go` — beyond per-feature methods: a generic `settings` key/value store (`GetSetting`/`SetSetting`), `job_runs` tracking (`StartJobRun`/`FinishJobRun`/`LatestJobRuns`/`ListRecentJobRuns`), and `error_events` (`RecordErrorEvent`/`ErrorCountsSince`/`ErrorCounters`/`PruneErrorEvents`) — shared infrastructure used by [background-cleanup.md](background-cleanup.md), [scan-receipt.md](scan-receipt.md), and [admin-panel.md](admin-panel.md).
- `server/internal/api/api.go` — `API` struct + constructor (`api.Config` bundles image dir/admin token/OpenRouter key+model/retention days so the constructor's argument list doesn't grow with every new setting), `RunPresenceSweeper`, shared JSON helpers (`writeJSON`, `writeError`, `decodeJSON`).
- `server/internal/api/ids.go` — `newID()` ID generation helper.
- `server/DEPLOYMENT.md` — systemd unit example, Docker (`CGO_ENABLED=0`), reverse proxy/TLS (Caddy/nginx, SSE needs `proxy_buffering off`), `/healthz` health check, data/cleanup notes.

## Related features
Every backend feature doc depends on this one for bootstrapping/config/middleware.

## Notes
- `VITE_LIVE_SERVER_URL` (frontend) has no working production default — `.env.production` must point it at wherever `server/` is actually deployed.
- `VITE_WORKER_URL` no longer exists — that was the pre-migration external Cloudflare Worker endpoint for receipt scanning.
- **Zustand: always wrap a multi-field object-literal selector in
  `useShallow`** (`import { useShallow } from 'zustand/shallow'`), e.g.
  `useBillStore(useShallow((s) => ({ a: s.a, b: s.b })))`, never
  `useBillStore((s) => ({ a: s.a, b: s.b }))` bare. Without it, the selector
  returns a brand-new object reference on every call, so
  `useSyncExternalStore` (which Zustand's hook is built on) never sees two
  consecutive snapshots as equal — this manifests as `"The result of
  getSnapshot should be cached to avoid an infinite loop"` followed by
  `"Maximum update depth exceeded"`, crashing the component (a real
  incident: `BillSettingsModal.tsx`'s first version selected an object from
  `useBillStore` without `useShallow` and infinite-looped as soon as it
  rendered). A selector returning a single primitive field (a string,
  number, or an existing array/object reference from the store) doesn't
  need `useShallow` — this only matters when the selector itself
  constructs a new object/array. Grep the codebase for
  `useShallow((state) => ({` before adding a new multi-field selector to
  see the existing pattern.
