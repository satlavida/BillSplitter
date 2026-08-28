# Receipt Enhance (client-side crop/boundary detection experiment)

## Summary
An experiment (branch `feature/v3Major-ScannerUpgrade`) building a
client-side pipeline that, given a receipt photo, detects the receipt's
4-point boundary, perspective-corrects and crops to just the receipt,
converts to grayscale with contrast enhancement, and resizes so neither
dimension exceeds 2048px — entirely in the browser, no server involved. The
intent is to send a tighter, cleaner image to `/api/scan` for better OCR
accuracy (see [scan-receipt.md](scan-receipt.md)).

**Not yet wired into the real scan flow.** `ScanReceiptButton.tsx` and
`src/lib/receiptScan.ts` are untouched — this module is validated in
isolation via a dev-only test page first. If the experiment works out,
integrating it into `ScanReceiptButton.tsx` (replacing/wrapping today's
plain `resizeImageToDataUrl` call) is a follow-up piece of work, at which
point this doc and `scan-receipt.md` both need updating.

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
  - `resizeToMaxDimension(canvas, maxDimension=2048)` — reuses
    `computeResizedDimensions` from `src/lib/imageResize.ts` rather than
    duplicating the scaling math.
  - `enhanceReceiptImage(file)` — top-level orchestrator tying the above
    into one entry point (File → detect → crop-or-skip → enhance → resize
    → JPEG data URL). This is the function a future real-flow integration
    would call.
- `src/Pages/DevReceiptScanTestPage.tsx` — dev-only page (route registered
  in `App.tsx` behind `import.meta.env.DEV`, so it's dead-code-eliminated
  from production builds entirely — verified via `npm run build`, no
  `opencv` string appears anywhere in the output bundle). Lets you pick a
  local image, runs `detectReceiptBoundary` standalone to draw a green
  boundary overlay on a canvas (labeled TL/TR/BR/BL corners), and runs
  `enhanceReceiptImage` to show the final cropped/enhanced result
  side-by-side. **Zero network calls, no sessionStore/billStore/imageStore
  writes** — purely local validation. Reached by navigating directly to
  `#/dev/receipt-scan-test` (not linked from the sidebar).

## Backend
None — this feature is entirely client-side. No Go changes.

## Related features
- [scan-receipt.md](scan-receipt.md) — the real upload/scan flow this is
  meant to eventually feed into.

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
  (`orderQuadPoints`, `computeWarpedDimensions`, `toGrayscaleImageData`,
  `stretchContrast`) are unit-tested in `receiptEnhance.test.ts`. Functions
  that depend on opencv's wasm runtime or real canvas pixel data
  (`detectReceiptBoundary`, `cropToQuad`, `enhanceReceiptImage`) are not
  meaningfully mockable and are validated manually via the dev test page
  instead — verified during development against synthetic angled/plain
  test photos (Playwright-driven, screenshots inspected) confirming: a
  correct boundary overlay, a properly deskewed crop, and the
  no-boundary-found fallback (uses the full image, unmodified dimensions).
- **jsdom quirk**: jsdom (used by the Jest unit tests) doesn't implement
  the `ImageData` constructor even though every real browser does.
  `toGrayscaleImageData`/`stretchContrast` build their output via a small
  `createImageData` helper in `receiptEnhance.ts` that falls back to a
  plain object of the same shape when `ImageData` is undefined, so the
  pure pixel-math functions stay unit-testable without a real browser.
