# Receipt Enhance (client-side crop/boundary detection)

## Summary
A client-side pipeline that, given a receipt photo, lets the user draw the
receipt's 4-point boundary by hand, perspective-corrects and crops to just
the receipt, converts to grayscale with contrast enhancement, and resizes
so neither dimension exceeds 2048px — entirely in the browser, no server
involved. Sends a tighter, cleaner image to `/api/scan` for better OCR
accuracy.

Auto-detection of the boundary is currently disabled — see Notes.

**Wired into the real scan flow**: `ScanReceiptButton.tsx`'s upload modal
uses `ReceiptBoundaryEditor` for its crop-selection step (starting from the
full image, since there's no auto-detection), and
`enhanceReceiptFromImageAndQuad` (grayscale + contrast only — see Notes)
for the final image sent to the server. See
[scan-receipt.md](scan-receipt.md) for that integration; this doc covers
the pipeline module itself, the shared crop-editor component, and the
dev-only test page used to validate/compare pipeline variants in
isolation.

## Frontend
- `src/lib/receiptEnhance.ts` — the core pipeline, framework-agnostic:
  - `detectReceiptBoundary(source)` — **disabled skeleton**: always
    resolves `null`. Used to run `@techstark/opencv-js` (opencv.js wasm,
    ~5MB) client-side (grayscale → Gaussian blur → Canny edges →
    `findContours` → largest 4-point `approxPolyDP` contour), but that
    rarely found a confident boundary in practice and wasn't worth the
    bundle weight, so the dependency was removed. Same signature/call
    sites as before, kept as a deliberate drop-in point for a future
    (likely server-side) detector — see Notes.
  - `orderQuadPoints(points)` — pure; sorts 4 unordered points into the
    `topLeft`/`topRight`/`bottomRight`/`bottomLeft` convention (by x+y
    sum/difference). Currently unused (no detector calls it) but kept for
    a future one to.
  - `computeWarpedDimensions(quad)` — pure; output size from the quad's
    longer opposing edges.
  - `cropToQuad(source, quad)` — pure canvas/JS perspective warp: solves
    the quad→rectangle homography via Gaussian elimination
    (`solveHomography`), then for each output pixel walks the inverse
    mapping back into the source and bilinear-samples it
    (`sampleBilinear`). No native canvas primitive does an arbitrary
    (non-affine) warp, so this is the standard way to do it without a
    library. Replaces the old `opencv`'s `getPerspectiveTransform` +
    `warpPerspective` call.
  - `toGrayscaleImageData(imageData)` / `stretchContrast(imageData)` — pure
    pixel math (luminance grayscale, linear min/max contrast stretch);
    `enhanceForOcr(canvas)` is the thin canvas wrapper around both.
  - `otsuThreshold(imageData)` / `binarize(imageData, threshold)` — pure
    pixel math implementing Otsu's method (histogram-based automatic
    thresholding: picks the intensity that maximizes the variance
    *between* two pixel classes) and applying it to produce pure
    black-and-white output, as an alternative to `enhanceForOcr`'s
    smoother grayscale+contrast-stretch result; `binarizeForOcr(canvas)`
    is the thin canvas wrapper around both (grayscale → Otsu threshold →
    binarize).
  - `resizeToMaxDimension(canvas, maxDimension=2048)` — reuses
    `computeResizedDimensions` from `src/lib/imageResize.ts` rather than
    duplicating the scaling math.
  - `fullImageQuad(source)` — pure; the source's four corners, the
    starting boundary always used now that `detectReceiptBoundary` never
    returns a match (so a caller/UI always has a quad to show and let the
    user drag in from).
  - `enhanceReceiptFromImageAndQuad(img, quad)` /
    `binarizeReceiptFromImageAndQuad(img, quad)` — crop-or-skip → enhance
    (grayscale+contrast, or Otsu binarize, respectively) → resize → JPEG
    data URL, for an already-loaded image and an explicit quad (or `null`
    to skip cropping). Both share a private `cropOrFullImage` first step.
    Split out from `enhanceReceiptImage` so a caller that lets the user
    hand-adjust the boundary can re-run just this part without redoing
    file loading.
  - `enhanceReceiptImage(file)` — top-level orchestrator for a fully
    automatic run: File → detect (currently always null) →
    `enhanceReceiptFromImageAndQuad`. Not currently used by either UI
    consumer (both call `detectReceiptBoundary`/`enhanceReceiptFromImageAndQuad`
    separately so they can show the crop-editor step in between).
  - `loadImageFile(file)` — File → `HTMLImageElement`, exported so both UI
    consumers below share one implementation.
- `src/Components/ReceiptBoundaryEditor.tsx` — the shared, controlled
  draggable-corner-handle canvas overlay: parent owns the `quad` state,
  this renders the image + overlay (labeled TL/TR/BR/BL, pointer-event-
  driven so it works with touch) and reports `onChange` during drags and
  `onDragEnd` when a drag finishes. Also exports `FALLBACK_INSET_RATIO`
  and `computeStartingQuad(detected, img)` (= `detected ??` an
  easy-to-grab inset `fullImageQuad`) — used by both consumers below so
  the "what boundary do we start from" logic lives in one place (`detected`
  is always passed as `null` today, but the signature is unchanged so a
  future detector slots back in without touching this component). Used by
  `ScanReceiptButton.tsx` (real flow) and `DevReceiptScanTestPage.tsx`
  (dev page) — see [scan-receipt.md](scan-receipt.md) for the former.
- `src/Pages/DevReceiptScanTestPage.tsx` — dev-only page (route registered
  in `App.tsx` behind `import.meta.env.DEV`, so it's dead-code-eliminated
  from production builds entirely). Lets you pick a local image and shows
  the full-image starting boundary via `ReceiptBoundaryEditor` for manual
  adjustment. Releasing a drag re-runs both `enhanceReceiptFromImageAndQuad`
  and `binarizeReceiptFromImageAndQuad` (in parallel) with the adjusted
  quad and refreshes **two** side-by-side previews: the grayscale+contrast
  output and the Otsu black-and-white output. A "Reset to full image"
  button jumps back to the starting quad. **Zero network calls, no
  sessionStore/billStore/imageStore writes** — purely local validation.
  Reached by navigating directly to `#/dev/receipt-scan-test` (not linked
  from the sidebar). Unlike the real flow, this page exists specifically
  to show previews/compare pipeline variants — the real flow shows neither
  (see Notes).

## Backend
None — this feature is entirely client-side. No Go changes.

## Related features
- [scan-receipt.md](scan-receipt.md) — the real upload/scan flow this
  pipeline is wired into.

## Notes
- **Auto-detection removed (2026-09)**: `@techstark/opencv-js` (opencv.js
  wasm, ~5MB) was pulled from `package.json` — the client-side
  grayscale→Canny→contour detection pipeline it powered rarely found a
  confident receipt boundary in practice, so the dependency wasn't earning
  its bundle weight even though it was dynamically imported and dev-route-
  gated. `detectReceiptBoundary` is kept as a same-signature stub that
  always returns `null`, and `src/lib/opencvLoader.ts` was deleted
  entirely. The manual boundary-editing flow (`ReceiptBoundaryEditor`,
  drag-to-adjust corners) is unaffected — it never depended on detection
  succeeding, since a missed detection already fell back to a full-image
  starting quad. If auto-detection comes back, the most likely shape is
  server-side (e.g. a `/api/scan`-adjacent endpoint), given the client-side
  wasm approach's poor hit rate and bundle cost.
- **`cropToQuad` reimplemented without opencv**: perspective warp now uses
  a hand-rolled homography solve (`solveHomography`, an 8x8 Gaussian
  elimination for the 4-point quad→rectangle correspondence) plus
  per-pixel bilinear resampling (`sampleBilinear`), both pure JS/Canvas
  2D — no library. This is what still makes the user's manual
  corner-dragging actually deskew the receipt.
- **Testing split**: pure geometry/pixel-math functions
  (`orderQuadPoints`, `computeWarpedDimensions`, `fullImageQuad`,
  `insetQuad`, `toGrayscaleImageData`, `stretchContrast`, `otsuThreshold`,
  `binarize`) are unit-tested in `receiptEnhance.test.ts`. Functions that
  touch real canvas pixel data (`cropToQuad`,
  `enhanceReceiptFromImageAndQuad`/`enhanceReceiptImage`,
  `binarizeReceiptFromImageAndQuad`) are not meaningfully mockable and are
  validated manually via the dev test page instead.
- **Real flow uses grayscale+contrast only, no preview**: `ScanReceiptButton.tsx`
  calls `enhanceReceiptFromImageAndQuad` (never
  `binarizeReceiptFromImageAndQuad`) and never shows the enhanced result to
  the user — only the crop-selection canvas. The Otsu black-and-white
  variant exists purely as a dev-page comparison tool; it wasn't judged a
  clear OCR-quality improvement, and showing the user a preview of the
  final image would slow the flow down for little benefit given the crop
  step already gives them control over what gets sent.
- **jsdom quirk**: jsdom (used by the Jest unit tests) doesn't implement
  the `ImageData` constructor even though every real browser does.
  `toGrayscaleImageData`/`stretchContrast` build their output via a small
  `createImageData` helper in `receiptEnhance.ts` that falls back to a
  plain object of the same shape when `ImageData` is undefined, so the
  pure pixel-math functions stay unit-testable without a real browser.
