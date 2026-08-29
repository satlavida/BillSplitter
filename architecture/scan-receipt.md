# Scan Receipt

## Summary
Upload or capture a photo of a receipt; the client detects the receipt's
boundary, lets the user fine-tune it, perspective-crops and
grayscale/contrast-enhances the image, and a vision-capable LLM extracts
line items, subtotal, and tax from the enhanced image, populating the
bill's Items step. The (cropped/enhanced) image itself is stored (locally
in IndexedDB, and on the server if the session is live) so it can be
reviewed later. Scanning is async/non-blocking — the upload modal closes
immediately and progress surfaces elsewhere in the UI.

## Frontend
- `src/Components/ScanReceiptButton.tsx` — two-step upload/capture modal. **Step 1** (`ReceiptFilePicker`): pick/capture a photo; selecting a file immediately loads it and runs `detectReceiptBoundary` (`src/lib/receiptEnhance.ts`) rather than requiring a separate submit click. **Step 2** ("Crop Receipt"): shows the detected boundary (or, if none was found, the full image's corners) as draggable handles via `ReceiptBoundaryEditor` (`src/Components/ReceiptBoundaryEditor.tsx`), with "Redetect edges" (re-runs detection) and "Reset boundary" (reverts manual drags back to the last detected/fallback quad) buttons. No enhancement preview is shown at this step — only the crop selection. Confirming ("Use This Crop") runs `enhanceReceiptFromImageAndQuad` (perspective crop → grayscale+contrast enhance → resize to ≤2048px), stores the result, marks the bill `scanStatus: 'processing'`, closes immediately, fires `scanBillReceipt` without awaiting it. Used from `ItemsInput.tsx` ([bill-editing.md](bill-editing.md)). Also self-opens on mount if it receives router nav-state `{ autoOpenScan: true }` (immediately replaced with no state, so back/forward doesn't re-trigger it) — used by `SessionHomePage.tsx`'s "Scan New Bill" action, which creates an empty bill then navigates straight into its Items step with the scan modal already open. That action also defaults the new bill's `paidByPersonId` to whichever session person `settingsStore`'s `autoAddSelf`/`selfName` matches (`src/lib/selfPerson.ts`'s `resolveSelfPersonId`) — i.e. if the app knows who "you" are, you become the default payer for a bill you scan.
- `src/Components/joiner/JoinerScanReceiptButton.tsx` — the joiner-side equivalent, reusing the same `ReceiptBoundaryEditor`/`receiptEnhance.ts` pipeline (both framework/store-agnostic) but pushing results straight to the live server via `src/lib/joinerReceiptScan.ts` instead of `sessionStore` (a joiner has no local persisted store for this session). Not fire-and-forget — stays modal-open with its own spinner/error state until the scan resolves, since there's no per-bill `scanStatus` on `LiveBill` to surface a background indicator elsewhere. Defaults the bill's `paidByPersonId` to the joiner's own `personId` if the bill has none yet — their identity is always known, unlike the creator-side name-matching above. Used from `JoinerBillEditorPage.tsx` ([bill-editing.md](bill-editing.md), [live-collaboration.md](live-collaboration.md)); also self-opens via the same `autoOpenScan` nav-state pattern, set by `JoinerSessionView.tsx`'s "Scan New Bill" action (which first creates the bill via `addLiveBill`, since a joiner has no local store to create it in before navigating).
- `src/Components/ReceiptBoundaryEditor.tsx` — the shared draggable-corner-handle canvas overlay (pointer-event-driven, touch-friendly), controlled by the parent (`quad`/`onChange`/`onDragEnd`). Also exports `FALLBACK_INSET_RATIO` and `computeStartingQuad(detected, img)` — the "detected boundary, or an easy-to-grab inset full-image quad if nothing was detected" logic shared by `ScanReceiptButton.tsx`/`JoinerScanReceiptButton.tsx` and the dev test page. See [receipt-enhance.md](receipt-enhance.md) for the underlying detection/crop/enhance pipeline.
- `src/lib/receiptScan.ts` — `scanBillReceipt(sessionId, billId)`; calls `POST /api/scan`, writes results straight to `sessionStore` (has its own try/catch — safe if the triggering component unmounts mid-flight). New items with quantity > 1 default to Quantity Split instead of Equal Split when `settingsStore.autoQuantitySplit` is on (default) — see `src/lib/defaultSplitType.ts`, shared with `billStore.addItem` and the joiner equivalents below.
- `src/lib/joinerReceiptScan.ts` — `scanLiveBillReceipt(code, bill, imageBlob, myPersonId, joinerToken)`; same `POST /api/scan` call (stateless — no session context needed), but applies results via `addLiveItem`/`updateLiveBill` (`liveApi.ts`) instead of a local store. Awaited by its caller rather than fire-and-forget.
- `src/lib/imageResize.ts` — `computeResizedDimensions`, the pure resize math reused by `receiptEnhance.ts`'s `resizeToMaxDimension`.
- `src/lib/imageStore.ts` — IndexedDB (`idb` package) storage for receipt image blobs, keyed by `refKey`; only `{refKey, width, height}` lives on `Bill.receiptImage` since images are too large for localStorage.
- `src/hooks/useOnlineStatus.ts` — tracks `navigator.onLine`, used by `ScanReceiptButton.tsx` to distinguish offline failures.
- `src/schemas/receiptScan.schema.ts` — response shape from `/api/scan`, normalizes flat vs structured discount formats.
- Progress/failure surfacing: `App.tsx`'s `Header` shows a spinner (counts bills with `scanStatus === 'processing'` in the current session); `SessionHomePage.tsx` shows inline `Alert`s with Retry/Dismiss keyed off `Bill.scanStatus`/`Bill.scanError` (`'offline'` = network-level failure, `'failed'` = reachable-but-unsuccessful scan).

## Backend
- `server/internal/api/scan_handlers.go`
  - `POST /api/scan` — calls OpenRouter (`https://openrouter.ai/api/v1/chat/completions`) with a vision-capable model and a fixed extraction prompt (`analysisPrompt`, ported verbatim from the pre-migration Cloudflare Worker's `prompt.js`). On failure, logs an `openrouter_request`-category error via `logging.Reporter` (see [infrastructure.md](infrastructure.md)) in addition to recording the failed scan usage row.
  - `GET /api/scan/usage` — daily/monthly scan usage stats.
  - `api.resolveOpenRouterModel()` — the model actually sent to OpenRouter: the `openrouter_model` row in the `settings` table if set, otherwise falls back to the `OPENROUTER_MODEL` env var/default (`google/gemini-3.1-flash-lite`). Checked fresh on every scan request (no restart needed to pick up an admin change).
- `server/internal/api/admin_settings_handlers.go` — admin-only model management, surfaced at `/admin/settings` (see [admin-panel.md](admin-panel.md)):
  - `GET /admin/settings/models` — proxies OpenRouter's `GET /models` catalog for the settings page's dropdown (keeps `OPENROUTER_API_KEY` server-side).
  - `POST /admin/settings/model` — sets (or, with an empty value, clears) the `openrouter_model` setting.
- `server/internal/store/store.go` — `RecordScanRequest`, `ScanUsageDaily`, `ScanUsageMonthly`, `ScanAnalyticsSummary`, `GetSetting`/`SetSetting` (generic settings KV, used here for `openrouter_model`).
- `server/internal/db/migrations/0002_scan_usage.sql` — `scan_requests`, `scan_usage_daily`, `scan_usage_monthly` tables (replaced the Worker's Cloudflare KV storage with atomic `INSERT ... ON CONFLICT` upserts).
- `server/internal/db/migrations/0008_settings_and_jobs.sql` — `settings` table backing the model override (also used by unrelated features — see [infrastructure.md](infrastructure.md)).
- Receipt image upload/serving (used regardless of whether scanning succeeds):
  - `server/internal/api/image_handlers.go` — `POST /api/sessions/{code}/bills/{billId}/images` (store a client-resized image; now gated by `requireNotSettled`/`requireEditPermission`, same as the item/bill write endpoints — previously ungated entirely, harmless while only the creator's token-free UI called it, but needed once the joiner UI (`JoinerScanReceiptButton.tsx`) started calling it too, with an optional `joinerToken` for the gate to actually apply), `GET /api/images/{refKey}` (serve it, unauthenticated).
  - `server/internal/store/store.go` — `SaveImageMeta`, `ImageFilePath`.
- Analytics surfaced in the admin panel — see [admin-panel.md](admin-panel.md) (`/admin/bill-processor`).

## Related features
- [bill-editing.md](bill-editing.md) — scan results populate Step 2 items.
- [live-collaboration.md](live-collaboration.md) — image upload endpoint (now permission-gated, see its Notes) used once a session is live, and by the joiner's own scan flow.
- [settings.md](settings.md) — `autoQuantitySplit` (multi-quantity items default to Quantity Split).
- [admin-panel.md](admin-panel.md) — scan usage analytics page.
- [receipt-enhance.md](receipt-enhance.md) — the client-side boundary-detection/crop/enhancement pipeline this feature now uses (the pipeline module itself, its dev-only test page, and the library/testing rationale).

## Notes
- **Deliberate quirk, preserved from the old Worker for frontend
  compatibility**: if the model's output isn't parseable JSON, `/api/scan`
  still returns `200 OK` with `{"raw_response": "...", "error": "..."}`
  rather than an HTTP error — callers must check for that shape, not just
  `response.ok`.
- `analysisPrompt` also asks the model for best-effort `restaurant_name`/
  `date` fields (omitted entirely, not guessed, if illegible) —
  `ReceiptScanResponseSchema` accepts them as optional. `receiptScan.ts`'s
  `applyScanResults` uses them (via `src/lib/receiptTitle.ts`'s
  `scannedTitle`/`isUnsetTitle`, split into their own module so they're
  unit-testable — `receiptScan.ts` itself can't be statically imported into
  a Jest test at all, since it references `import.meta.env`) to set the
  bill's title to `"{restaurant_name} - {date}"` (or just the name if no
  date), but only when the bill's title is still unset (empty, or the
  schema default `'Untitled Bill'`) — a rescan never clobbers a
  manually-entered title.
- Scan is disabled server-side if `OPENROUTER_API_KEY` is unset (see
  [infrastructure.md](infrastructure.md)).
- `VITE_LIVE_SERVER_URL` (frontend env var) must point at wherever `server/`
  is deployed — there's no working production default.
- The real scan flow only ever sends the **grayscale + contrast-stretch**
  enhanced image (`enhanceReceiptFromImageAndQuad`) — `receiptEnhance.ts`
  also has an Otsu-threshold black-and-white binarization variant
  (`binarizeReceiptFromImageAndQuad`), but that's deliberately not used
  here, only shown as a comparison preview on the dev test page. No
  enhancement/crop preview is shown to the user in the real flow either —
  step 2 shows only the boundary-selection canvas; the enhanced result is
  computed and sent directly on "Use This Crop".
- The crop-step modal has no privacy-notice `Alert` (removed 2026-08-29 —
  it was flagged as noise users didn't need to see on every scan) and is
  capped at `max-h-[85vh] overflow-y-auto` so a tall receipt image's modal
  scrolls instead of overflowing the viewport with no way to reach the
  action buttons.
- **`autoOpenScan` nav-state must be read/cleared by the component that
  actually opens the modal, not a data-loading parent.** An earlier version
  of `JoinerScanReceiptButton.tsx` had `JoinerBillEditorPage.tsx` clear the
  flag in its own top-level effect (which runs on that page's first render,
  before the joiner's session/bill fetch resolves), then passed a derived
  `autoOpen` boolean prop down. Since `JoinerBillEditorPage` re-renders as
  soon as that clearing `navigate()` call lands — well before `bill` is
  loaded and `JoinerScanReceiptButton` actually mounts — the prop was
  already `false` by the time the button existed to read it, so the modal
  silently never opened. Fixed by having `JoinerScanReceiptButton` read
  `location.state` and clear it itself in its own mount effect (exactly
  like `ScanReceiptButton.tsx`'s pattern on the creator side, where this
  never bit anyone because that component's parent has no comparable async
  loading gate in front of it).
