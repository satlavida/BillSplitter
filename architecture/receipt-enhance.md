# Receipt Enhance (client-side crop/boundary detection)

## Summary
A client-side pipeline that, given a receipt photo, detects the receipt's
4-point boundary, lets the user fine-tune it, perspective-corrects and
crops to just the receipt, converts to grayscale with contrast
enhancement, and resizes so neither dimension exceeds 2048px — entirely in
the browser, no server involved. Sends a tighter, cleaner image to
`/api/scan` for better OCR accuracy.

**Wired into the real scan flow**: `ScanReceiptButton.tsx`'s upload modal
uses this pipeline's boundary detection + `ReceiptBoundaryEditor` for its
crop-selection step, and `enhanceReceiptFromImageAndQuad` (grayscale +
contrast only — see Notes) for the final image sent to the server. See
[scan-receipt.md](scan-receipt.md) for that integration; this doc covers
the pipeline module itself, the shared crop-editor component, and the
dev-only test page used to validate/compare pipeline variants in
isolation.

## Frontend
- `src/lib/opencvLoader.ts` — `loadOpenCv()`, a memoized lazy loader for
  `@techstark/opencv-js` (an npm-distributed wasm build of OpenCV.js).
  Dynamically `import()`ed only when the pipeline actually runs, so the
  wasm binary is never fetched (and doesn't appear in the production
  bundle at all) unless this code path executes. The package's default
  export is the emscripten module factory's return value — itself a
  Promise that resolves once the wasm runtime is ready — which the loader
  awaits before checking for `cv.Mat` readiness.
- `src/lib/receiptEnhance.ts` — the core pipeline, framework-agnostic:
  - `detectReceiptBoundary(source)` — grayscale → Gaussian blur → Canny
    edge detection → `findContours` → largest 4-point `approxPolyDP`
    contour. Returns `Quad | null` (`null`, not a throw, when no confident
    boundary is found — an expected outcome on busy backgrounds/poor
    lighting).
  - `orderQuadPoints(points)` — pure; sorts 4 unordered points into the
    `topLeft`/`topRight`/`bottomRight`/`bottomLeft` convention (by x+y
    sum/difference).
  - `computeWarpedDimensions(quad)` — pure; output size from the quad's
    longer opposing edges.
  - `cropToQuad(source, quad)` — `getPerspectiveTransform` +
    `warpPerspective`, deskewing a receipt photographed at an angle.
  - `toGrayscaleImageData(imageData)` / `stretchContrast(imageData)` — pure
    pixel math (luminance grayscale, linear min/max contrast stretch), no
    opencv dependency; `enhanceForOcr(canvas)` is the thin canvas wrapper
    around both.
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
  - `fullImageQuad(source)` — pure; the source's four corners, used as the
    starting boundary when `detectReceiptBoundary` finds nothing (so a
    caller/UI always has a quad to show and let the user drag in from).
  - `enhanceReceiptFromImageAndQuad(img, quad)` /
    `binarizeReceiptFromImageAndQuad(img, quad)` — crop-or-skip → enhance
    (grayscale+contrast, or Otsu binarize, respectively) → resize → JPEG
    data URL, for an already-loaded image and an explicit quad (or `null`
    to skip cropping). Both share a private `cropOrFullImage` first step.
    Split out from `enhanceReceiptImage` so a caller that lets the user
    hand-adjust the detected boundary can re-run just this part without
    redoing file loading/detection.
  - `enhanceReceiptImage(file)` — top-level orchestrator for a fully
    automatic run: File → detect → `enhanceReceiptFromImageAndQuad`. This
    is the function a future real-flow integration would call when no
    manual adjustment step is wanted.
  - `loadImageFile(file)` — File → `HTMLImageElement`, exported so
    `enhanceReceiptImage` and both UI consumers below share one
    implementation.
- `src/Components/ReceiptBoundaryEditor.tsx` — the shared, controlled
  draggable-corner-handle canvas overlay: parent owns the `quad` state,
  this renders the image + overlay (labeled TL/TR/BR/BL, pointer-event-
  driven so it works with touch) and reports `onChange` during drags and
  `onDragEnd` when a drag finishes. Also exports `FALLBACK_INSET_RATIO`
  and `computeStartingQuad(detected, img)` (= `detected ??` an
  easy-to-grab inset `fullImageQuad`) — used by both consumers below so
  the "what boundary do we start from" logic lives in one place. Used by
  `ScanReceiptButton.tsx` (real flow) and `DevReceiptScanTestPage.tsx`
  (dev page) — see [scan-receipt.md](scan-receipt.md) for the former.
- `src/Pages/DevReceiptScanTestPage.tsx` — dev-only page (route registered
  in `App.tsx` behind `import.meta.env.DEV`, so it's dead-code-eliminated
  from production builds entirely — verified via `npm run build`, no
  `opencv` string appears anywhere in the output bundle). Lets you pick a
  local image, runs `detectReceiptBoundary`, and shows the result via
  `ReceiptBoundaryEditor`. Releasing a drag re-runs both
  `enhanceReceiptFromImageAndQuad` and `binarizeReceiptFromImageAndQuad`
  (in parallel) with the adjusted quad and refreshes **two** side-by-side
  previews: the grayscale+contrast output and the Otsu black-and-white
  output. "Reset to detected" and "Use full image" buttons jump back to
  either starting quad. **Zero network calls, no
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
- **Library choice**: `@techstark/opencv-js` (opencv.js wasm) is the only
  realistic option for boundary/contour detection — grayscale/contrast
  enhancement needs no library and is plain Canvas 2D pixel math. Server-side
  options (sharp/libvips/ImageMagick) were ruled out: this must be
  client-only, and a wasm ImageMagick build would be heavier with no
  built-in quadrilateral/contour finder. `jscanify` (a thin OpenCV.js
  wrapper for exactly this use case) was considered but not taken as a
  dependency — the pipeline is a small, self-owned wrapper directly against
  opencv.js primitives instead, since enhancement already needs direct
  opencv.js access and one coherent API surface is easier to maintain than
  mixing two.
- **Bundle impact**: the wasm payload (~8-10MB) is irrelevant to the main
  bundle since it's dynamically imported and, in production, the entire
  `import.meta.env.DEV`-gated route (and everything it pulls in) is
  tree-shaken out — confirmed by inspecting the built `docs/assets/*.js`
  for any `opencv` reference after `npm run build`.
- **Testing split**: pure geometry/pixel-math functions
  (`orderQuadPoints`, `computeWarpedDimensions`, `fullImageQuad`,
  `insetQuad`, `toGrayscaleImageData`, `stretchContrast`, `otsuThreshold`,
  `binarize`) are unit-tested in `receiptEnhance.test.ts`. Functions that
  depend on opencv's wasm runtime or real canvas pixel data
  (`detectReceiptBoundary`, `cropToQuad`,
  `enhanceReceiptFromImageAndQuad`/`enhanceReceiptImage`,
  `binarizeReceiptFromImageAndQuad`) are not
  meaningfully mockable and are validated manually via the dev test page
  instead — verified during development against the synthetic photos in
  [test/images/](../test/images/) (`angled-receipt.jpg`, `no-boundary.jpg`
  — generated, not real receipts; see that folder's README), Playwright-
  driven with screenshots inspected, confirming: a
  correct boundary overlay, a properly deskewed crop, the no-boundary-found
  fallback (uses the full image, unmodified dimensions), and the drag
  interaction itself (dragging a corner outward on the canvas visibly
  enlarges the output and changes its dimensions; "Reset to detected" and
  "Use full image" each reproduce their respective quad's output exactly).
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
