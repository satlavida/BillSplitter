/**
 * Lazy loader for opencv.js (wasm). Never imported statically from an
 * eagerly-loaded module — only from code paths that actually run the
 * receipt boundary-detection pipeline, so the wasm binary is fetched on
 * demand rather than bloating the main app bundle.
 */

// The package's generated types are enormous and cover the entire OpenCV
// API surface; treating the loaded module as `any` here (isolated to this
// one file) keeps callers' code readable without hand-maintaining a partial
// type surface.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OpenCv = any;

let cvPromise: Promise<OpenCv> | null = null;

/**
 * Resolves once opencv.js's wasm runtime has finished initializing.
 * Memoized: repeat calls (e.g. re-running the dev test page) reuse the same
 * already-loaded module instead of re-fetching/re-initializing the wasm.
 */
export const loadOpenCv = (): Promise<OpenCv> => {
  if (!cvPromise) {
    cvPromise = import('@techstark/opencv-js').then(async (mod) => {
      // The package's default export is the emscripten module factory's
      // return value, which is itself a Promise that resolves once the
      // wasm runtime is ready (unless it happened to already be ready
      // synchronously, in which case it's the module object directly).
      const cvModule = await (mod.default ?? mod);
      if (cvModule.Mat) {
        return cvModule;
      }
      return new Promise<OpenCv>((resolve) => {
        cvModule.onRuntimeInitialized = () => resolve(cvModule);
      });
    });
  }
  return cvPromise;
};
