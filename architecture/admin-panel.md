# Admin Panel

## Summary
A small, deliberately server-rendered (not React) internal-only panel for
viewing live sessions, aggregate stats, and receipt-scan usage analytics,
and for manually purging a session. No frontend counterpart.

## Frontend
None — server-rendered `html/template` pages, by design (kept small/internal per `planv3.md`).

## Backend
- `server/internal/api/admin_handlers.go`
  - `GET /admin` — sessions list page.
  - `GET /admin/stats` — aggregate stats page.
  - `GET /admin/bill-processor` — scan analytics page (see [scan-receipt.md](scan-receipt.md)).
  - `POST /admin/sessions/{code}/purge` — purge a single session (DB rows + image files).
  - `requireAdminToken` — gates all admin routes behind a static bearer token (cookie + header/query/form token check); admin auth lives here, not in `internal/middleware/`.
- `server/internal/api/admin_templates.go` — `html/template` definitions (`adminLayoutHTML`, sessions/stats/scan content templates cloned from a shared base layout).
- `server/internal/store/store.go` — `ListAllSessionsForAdmin`, `AdminStats`, `ScanAnalyticsSummary`.

## Related features
- [live-collaboration.md](live-collaboration.md) — sessions shown/purged here.
- [scan-receipt.md](scan-receipt.md) — usage analytics shown here.
- [background-cleanup.md](background-cleanup.md) — automatic purge vs. this manual purge endpoint.

## Notes
- Disabled entirely if `ADMIN_TOKEN` is unset (see [infrastructure.md](infrastructure.md)).
- Manual purge here reuses the same deletion path as `DELETE /api/sessions/{code}` (creator-initiated delete, see [live-collaboration.md](live-collaboration.md)).
