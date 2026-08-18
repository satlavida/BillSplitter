# Scan Receipt

## Summary
Upload or capture a photo of a receipt; a vision-capable LLM extracts line
items, subtotal, and tax, which populate the bill's Items step. The image
itself is stored (locally in IndexedDB, and on the server if the session is
live) so it can be reviewed later. Scanning is async/non-blocking — the
upload modal closes immediately and progress surfaces elsewhere in the UI.

## Frontend
- `src/Components/ScanReceiptButton.tsx` — upload/capture modal; on submit, resizes + stores the image locally, marks the bill `scanStatus: 'processing'`, closes immediately, fires `scanBillReceipt` without awaiting it. Used from `ItemsInput.tsx` ([bill-editing.md](bill-editing.md)).
- `src/lib/receiptScan.ts` — `scanBillReceipt(sessionId, billId)`; calls `POST /api/scan`, writes results straight to `sessionStore` (has its own try/catch — safe if the triggering component unmounts mid-flight).
- `src/lib/imageResize.ts` — resize math + `resizeImageToDataUrl`, used before storing scanned/uploaded images.
- `src/lib/imageStore.ts` — IndexedDB (`idb` package) storage for receipt image blobs, keyed by `refKey`; only `{refKey, width, height}` lives on `Bill.receiptImage` since images are too large for localStorage.
- `src/hooks/useOnlineStatus.ts` — tracks `navigator.onLine`, used by `ScanReceiptButton.tsx` to distinguish offline failures.
- `src/schemas/receiptScan.schema.ts` — response shape from `/api/scan`, normalizes flat vs structured discount formats.
- Progress/failure surfacing: `App.tsx`'s `Header` shows a spinner (counts bills with `scanStatus === 'processing'` in the current session); `SessionHomePage.tsx` shows inline `Alert`s with Retry/Dismiss keyed off `Bill.scanStatus`/`Bill.scanError` (`'offline'` = network-level failure, `'failed'` = reachable-but-unsuccessful scan).

## Backend
- `server/internal/api/scan_handlers.go`
  - `POST /api/scan` — calls OpenRouter (`https://openrouter.ai/api/v1/chat/completions`) with a vision-capable model (`OPENROUTER_MODEL`, default `google/gemini-3.1-flash-lite`) and a fixed extraction prompt (`analysisPrompt`, ported verbatim from the pre-migration Cloudflare Worker's `prompt.js`).
  - `GET /api/scan/usage` — daily/monthly scan usage stats.
- `server/internal/store/store.go` — `RecordScanRequest`, `ScanUsageDaily`, `ScanUsageMonthly`, `ScanAnalyticsSummary`.
- `server/internal/db/migrations/0002_scan_usage.sql` — `scan_requests`, `scan_usage_daily`, `scan_usage_monthly` tables (replaced the Worker's Cloudflare KV storage with atomic `INSERT ... ON CONFLICT` upserts).
- Receipt image upload/serving (used regardless of whether scanning succeeds):
  - `server/internal/api/image_handlers.go` — `POST /api/sessions/{code}/bills/{billId}/images` (store a client-resized image), `GET /api/images/{refKey}` (serve it).
  - `server/internal/store/store.go` — `SaveImageMeta`, `ImageFilePath`.
- Analytics surfaced in the admin panel — see [admin-panel.md](admin-panel.md) (`/admin/bill-processor`).

## Related features
- [bill-editing.md](bill-editing.md) — scan results populate Step 2 items.
- [live-collaboration.md](live-collaboration.md) — image upload endpoint used once a session is live.
- [admin-panel.md](admin-panel.md) — scan usage analytics page.

## Notes
- **Deliberate quirk, preserved from the old Worker for frontend
  compatibility**: if the model's output isn't parseable JSON, `/api/scan`
  still returns `200 OK` with `{"raw_response": "...", "error": "..."}`
  rather than an HTTP error — callers must check for that shape, not just
  `response.ok`.
- Scan is disabled server-side if `OPENROUTER_API_KEY` is unset (see
  [infrastructure.md](infrastructure.md)).
- `VITE_LIVE_SERVER_URL` (frontend env var) must point at wherever `server/`
  is deployed — there's no working production default.
