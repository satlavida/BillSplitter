# Admin Panel

## Summary
A small, deliberately server-rendered (not React) internal-only panel for
viewing live sessions, aggregate stats, receipt-scan usage analytics,
background-job run history, and admin-configurable settings (currently just
the receipt-scan model), and for manually purging a session. A separate
JSON endpoint, `GET /adminhealth`, exposes the same kind of data
programmatically (e.g. for an external uptime/monitoring check). No
frontend counterpart.

## Frontend
None — server-rendered `html/template` pages, by design (kept small/internal per `planv3.md`).

## Backend
- `server/internal/api/admin_handlers.go`
  - `GET /admin` — sessions list page.
  - `GET /admin/stats` — aggregate stats page.
  - `GET /admin/bill-processor` — scan analytics page (see [scan-receipt.md](scan-receipt.md)).
  - `GET /admin/jobs` — background-job run history (session purge, log retention — see [background-cleanup.md](background-cleanup.md)).
  - `POST /admin/sessions/{code}/purge` — purge a single session (DB rows + image files).
  - `requireAdminToken` — gates HTML admin pages behind a static bearer token (cookie + header/query/form token check, mints the cookie and redirects a `?token=` GET to the clean path); admin auth lives here, not in `internal/middleware/`.
  - `requireAdminTokenAPI` — same static bearer token check for JSON endpoints (`/admin/settings/models`, `/adminhealth`), without the cookie-minting/redirect side effects that would surprise a non-browser caller.
- `server/internal/api/admin_settings_handlers.go`
  - `GET /admin/settings` — settings page (currently: receipt-scan model picker).
  - `GET /admin/settings/models` — proxies OpenRouter's `GET /models` (server-side, so `OPENROUTER_API_KEY` never reaches the browser) for the settings page's dropdown.
  - `POST /admin/settings/model` — sets/clears the `openrouter_model` setting (see [scan-receipt.md](scan-receipt.md)).
- `server/internal/api/adminhealth_handlers.go`
  - `GET /adminhealth` — `ADMIN_TOKEN`-gated JSON: 24h/7d active-session and scan-request counts, 24h/7d/all-time error counts by category, and the latest run of every background job. A detailed companion to the public, minimal `GET /healthz`.
- `server/internal/api/admin_templates.go` — `html/template` definitions (`adminLayoutHTML`, sessions/stats/scan/settings/jobs content templates cloned from a shared base layout).
- `server/internal/store/store.go` — `ListAllSessionsForAdmin`, `AdminStats`, `ScanAnalyticsSummary`, plus the generic settings/job-run/error-event methods documented in [infrastructure.md](infrastructure.md).

## Related features
- [live-collaboration.md](live-collaboration.md) — sessions shown/purged here.
- [scan-receipt.md](scan-receipt.md) — usage analytics + model setting shown here.
- [background-cleanup.md](background-cleanup.md) — automatic purge vs. this manual purge endpoint; job run history shown here.

## Notes
- Disabled entirely if `ADMIN_TOKEN` is unset (see [infrastructure.md](infrastructure.md)) — this also disables `/adminhealth`.
- Manual purge here reuses the same deletion path as `DELETE /api/sessions/{code}` (creator-initiated delete, see [live-collaboration.md](live-collaboration.md)).
- The settings page's model picker is a vanilla-JS searchable combobox (text input + filtered dropdown), not a plain `<select>` — OpenRouter's catalog is 400+ models, too many for a native select to be usable. It's populated client-side via a fetch to `/admin/settings/models`; if that call fails (no `OPENROUTER_API_KEY`, or OpenRouter unreachable), the currently-configured model still shows in the search box so saving isn't blocked.
- The picker defaults to filtering to image-input-capable models only (checkbox, on by default) since receipt scanning needs vision; a text-only filter is also available. Capability comes from each model's `architecture.input_modalities` in OpenRouter's `/models` response — `openRouterModelArchitecture` in `admin_settings_handlers.go`.
- The settings page also shows (read-only) the current idle/settled-session and log retention day counts, for visibility — they're env-configured (`IDLE_SESSION_RETENTION_DAYS`/`SETTLED_SESSION_RETENTION_DAYS`/`LOG_RETENTION_DAYS`, see [infrastructure.md](infrastructure.md)) and not editable from this page.
