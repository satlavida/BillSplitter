import { computeResizedDimensions } from './imageResize';

export interface Point {
  x: number;
  y: number;
}

// Corner order matters: this is the order cropToQuad's perspective
// transform maps onto an axis-aligned output rectangle (top-left,
// top-right, bottom-right, bottom-left, clockwise from top-left).
export interface Quad {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

/**
 * Sorts 4 unordered points (arbitrary winding order — e.g. from a contour
 * detector) into the TL/TR/BR/BL convention used by Quad. Currently unused
 * by detectReceiptBoundary (see its skeleton comment) but kept for that
 * future detector to call.
 *
 * Standard technique: top-left has the smallest x+y sum, bottom-right the
 * largest; top-right has the smallest y-x difference, bottom-left the
 * largest.
 */
export const orderQuadPoints = (points: Point[]): Quad => {
  if (points.length !== 4) {
    throw new Error(`orderQuadPoints requires exactly 4 points, got ${points.length}`);
  }

  const bySum = [...points].sort((a, b) => a.x + a.y - (b.x + b.y));
  const byDiff = [...points].sort((a, b) => a.y - a.x - (b.y - b.x));

  return {
    topLeft: bySum[0],
    bottomRight: bySum[3],
    topRight: byDiff[0],
    bottomLeft: byDiff[3],
  };
};

/**
 * Auto-detection is disabled: it used to run opencv.js's (wasm, ~5MB)
 * document-scanner pipeline client-side, but that pipeline rarely found a
 * confident boundary in practice and wasn't worth the bundle weight. This
 * stub is a deliberate skeleton — same signature/call sites as before — so
 * a future (likely server-side) detector can be dropped back in without
 * touching callers. Until then this always returns null and callers fall
 * back to letting the user draw the boundary manually
 * (see computeStartingQuad/fullImageQuad).
 */
export const detectReceiptBoundary = async (_source: HTMLImageElement | HTMLCanvasElement): Promise<Quad | null> => {
  return null;
};

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Output size for a perspective-corrected crop: the longer of the quad's
 * two opposing edges on each axis, so the warp doesn't compress detail on
 * the far side of a tilted receipt.
 */
export const computeWarpedDimensions = (quad: Quad): { width: number; height: number } => {
  const { topLeft, topRight, bottomRight, bottomLeft } = quad;
  const width = Math.round(Math.max(distance(topLeft, topRight), distance(bottomLeft, bottomRight)));
  const height = Math.round(Math.max(distance(topLeft, bottomLeft), distance(topRight, bottomRight)));
  return { width, height };
};

// A 3x3 homography as a flat row-major 9-element array.
type Homography = number[];

/**
 * Solves for the 3x3 homography mapping each of 4 destination points to
 * its corresponding source point (i.e. dst->src, which is what warping
 * actually needs: for each output pixel, where in the source does it come
 * from). Standard direct linear transform for a 4-point correspondence,
 * solved as an 8x8 linear system via Gaussian elimination with partial
 * pivoting (h33 fixed to 1, homogeneous scale is free).
 */
const solveHomography = (from: Point[], to: Point[]): Homography => {
  // Each point pair contributes 2 rows to A·h = b, where h is the 8
  // unknown entries of the homography (h33 = 1 fixed).
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const { x: sx, y: sy } = from[i];
    const { x: dx, y: dy } = to[i];
    A.push([sx, sy, 1, 0, 0, 0, -sx * dx, -sy * dx]);
    b.push(dx);
    A.push([0, 0, 0, sx, sy, 1, -sx * dy, -sy * dy]);
    b.push(dy);
  }

  // Gaussian elimination with partial pivoting on the augmented [A|b].
  const n = 8;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[pivotRow][col])) pivotRow = row;
    }
    [M[col], M[pivotRow]] = [M[pivotRow], M[col]];

    const pivot = M[col][col];
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = M[row][col] / pivot;
      for (let k = col; k <= n; k++) {
        M[row][k] -= factor * M[col][k];
      }
    }
  }

  const h = M.map((row, i) => row[n] / row[i]);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
};

const applyHomography = (h: Homography, x: number, y: number): Point => {
  const w = h[6] * x + h[7] * y + h[8];
  return {
    x: (h[0] * x + h[1] * y + h[2]) / w,
    y: (h[3] * x + h[4] * y + h[5]) / w,
  };
};

/**
 * Bilinear-samples source at fractional (x, y); returns transparent black
 * for coordinates outside the source bounds.
 */
const sampleBilinear = (data: Uint8ClampedArray, width: number, height: number, x: number, y: number, out: [number, number, number, number]) => {
  if (x < 0 || y < 0 || x > width - 1 || y > height - 1) {
    out[0] = out[1] = out[2] = out[3] = 0;
    return;
  }

  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const fx = x - x0;
  const fy = y - y0;

  for (let c = 0; c < 4; c++) {
    const p00 = data[(y0 * width + x0) * 4 + c];
    const p10 = data[(y0 * width + x1) * 4 + c];
    const p01 = data[(y1 * width + x0) * 4 + c];
    const p11 = data[(y1 * width + x1) * 4 + c];
    const top = p00 + (p10 - p00) * fx;
    const bottom = p01 + (p11 - p01) * fx;
    out[c] = top + (bottom - top) * fy;
  }
};

/**
 * Perspective-corrects and crops the source image down to just the
 * given quad, mapped onto an axis-aligned output rectangle (deskewing a
 * receipt photographed at an angle). Pure canvas/JS: computes the
 * quad->rectangle homography, then for each output pixel walks the
 * inverse mapping back into the source and bilinear-samples it — the
 * standard way to do an arbitrary (non-affine) warp without a native
 * canvas primitive for it.
 */
export const cropToQuad = async (source: HTMLImageElement | HTMLCanvasElement, quad: Quad): Promise<HTMLCanvasElement> => {
  const { width, height } = computeWarpedDimensions(quad);

  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = 'naturalWidth' in source ? source.naturalWidth : source.width;
  srcCanvas.height = 'naturalHeight' in source ? source.naturalHeight : source.height;
  const srcCtx = srcCanvas.getContext('2d');
  if (!srcCtx) {
    throw new Error('Could not get canvas 2d context');
  }
  srcCtx.drawImage(source, 0, 0);
  const srcImageData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);

  const dstRect = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  const srcPoints = [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft];
  // dst->src homography, so each output pixel maps directly to a source
  // sample coordinate (avoids inverting the matrix separately).
  const homography = solveHomography(dstRect, srcPoints);

  const outputData = new Uint8ClampedArray(width * height * 4);
  const sample: [number, number, number, number] = [0, 0, 0, 0];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const { x: sx, y: sy } = applyHomography(homography, x, y);
      sampleBilinear(srcImageData.data, srcCanvas.width, srcCanvas.height, sx, sy, sample);
      const i = (y * width + x) * 4;
      outputData[i] = sample[0];
      outputData[i + 1] = sample[1];
      outputData[i + 2] = sample[2];
      outputData[i + 3] = sample[3];
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas 2d context');
  }
  ctx.putImageData(createImageData(outputData, width, height), 0, 0);
  return canvas;
};

// jsdom (used by the Jest unit tests) doesn't implement the ImageData
// constructor, even though it exists in every real browser. Falling back to
// a plain object of the same shape keeps toGrayscaleImageData/
// stretchContrast unit-testable without a real canvas/browser environment.
const createImageData = (data: Uint8ClampedArray<ArrayBuffer>, width: number, height: number): ImageData =>
  typeof ImageData !== 'undefined' ? new ImageData(data, width, height) : ({ data, width, height, colorSpace: 'srgb' } as ImageData);

/**
 * Converts to grayscale using standard luminance weights. Pure pixel math,
 * no canvas/opencv dependency, so it's directly unit-testable.
 */
export const toGrayscaleImageData = (imageData: ImageData): ImageData => {
  const { data, width, height } = imageData;
  const output = createImageData(new Uint8ClampedArray(data.length), width, height);

  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    output.data[i] = gray;
    output.data[i + 1] = gray;
    output.data[i + 2] = gray;
    output.data[i + 3] = data[i + 3];
  }

  return output;
};

/**
 * Linear min/max contrast stretch: remaps each channel's observed
 * [min, max] range to the full [0, 255] range. Pure pixel math, no
 * canvas/opencv dependency.
 */
export const stretchContrast = (imageData: ImageData): ImageData => {
  const { data, width, height } = imageData;
  const output = createImageData(new Uint8ClampedArray(data), width, height);

  let min = 255;
  let max = 0;
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const v = data[i + c];
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }

  const range = max - min;
  if (range === 0) {
    return output;
  }

  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      output.data[i + c] = Math.round(((data[i + c] - min) / range) * 255);
    }
    output.data[i + 3] = data[i + 3];
  }

  return output;
};

/**
 * Otsu's method: picks the grayscale intensity threshold that best splits
 * an image's pixel histogram into two classes (background/foreground) by
 * maximizing the variance *between* the two classes' means. Standard
 * histogram-based technique for turning a scanned document into clean
 * black text on white paper, rather than a smoothed grayscale image.
 * Expects (near-)grayscale input — reads intensity from the red channel.
 */
export const otsuThreshold = (imageData: ImageData): number => {
  const { data } = imageData;
  const histogram = new Array(256).fill(0);
  let totalPixels = 0;

  for (let i = 0; i < data.length; i += 4) {
    histogram[data[i]]++;
    totalPixels++;
  }

  let sumAll = 0;
  for (let intensity = 0; intensity < 256; intensity++) {
    sumAll += intensity * histogram[intensity];
  }

  let sumBackground = 0;
  let weightBackground = 0;
  let maxBetweenClassVariance = 0;
  let threshold = 0;

  for (let intensity = 0; intensity < 256; intensity++) {
    weightBackground += histogram[intensity];
    if (weightBackground === 0) continue;

    const weightForeground = totalPixels - weightBackground;
    if (weightForeground === 0) break;

    sumBackground += intensity * histogram[intensity];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sumAll - sumBackground) / weightForeground;

    const betweenClassVariance = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;
    if (betweenClassVariance > maxBetweenClassVariance) {
      maxBetweenClassVariance = betweenClassVariance;
      threshold = intensity;
    }
  }

  return threshold;
};

/**
 * Pure black/white thresholding: pixels at or above the threshold become
 * white, pixels below become black. Alpha preserved.
 */
export const binarize = (imageData: ImageData, threshold: number): ImageData => {
  const { data, width, height } = imageData;
  const output = createImageData(new Uint8ClampedArray(data.length), width, height);

  for (let i = 0; i < data.length; i += 4) {
    const value = data[i] >= threshold ? 255 : 0;
    output.data[i] = value;
    output.data[i + 1] = value;
    output.data[i + 2] = value;
    output.data[i + 3] = data[i + 3];
  }

  return output;
};

/**
 * Thin canvas wrapper around toGrayscaleImageData + stretchContrast: reads
 * pixels off the source canvas, runs both pure pixel-math passes, and
 * draws the result onto a new canvas.
 */
export const enhanceForOcr = (source: HTMLCanvasElement): HTMLCanvasElement => {
  const ctx = source.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas 2d context');
  }

  const imageData = ctx.getImageData(0, 0, source.width, source.height);
  const enhanced = stretchContrast(toGrayscaleImageData(imageData));

  const output = document.createElement('canvas');
  output.width = source.width;
  output.height = source.height;
  const outputCtx = output.getContext('2d');
  if (!outputCtx) {
    throw new Error('Could not get canvas 2d context');
  }
  outputCtx.putImageData(enhanced, 0, 0);
  return output;
};

/**
 * Thin canvas wrapper around toGrayscaleImageData + otsuThreshold +
 * binarize: grayscales the source, picks a threshold from its own
 * histogram, and produces a pure black-and-white result — an alternative
 * to enhanceForOcr's smoother grayscale+contrast-stretch output.
 */
export const binarizeForOcr = (source: HTMLCanvasElement): HTMLCanvasElement => {
  const ctx = source.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas 2d context');
  }

  const gray = toGrayscaleImageData(ctx.getImageData(0, 0, source.width, source.height));
  const binarized = binarize(gray, otsuThreshold(gray));

  const output = document.createElement('canvas');
  output.width = source.width;
  output.height = source.height;
  const outputCtx = output.getContext('2d');
  if (!outputCtx) {
    throw new Error('Could not get canvas 2d context');
  }
  outputCtx.putImageData(binarized, 0, 0);
  return output;
};

/**
 * Downscales (never upscales) a canvas so neither dimension exceeds
 * maxDimension, reusing computeResizedDimensions' aspect-preserving math.
 */
export const resizeToMaxDimension = (canvas: HTMLCanvasElement, maxDimension = 2048): HTMLCanvasElement => {
  const { width, height } = computeResizedDimensions(canvas.width, canvas.height, maxDimension, maxDimension);

  if (width === canvas.width && height === canvas.height) {
    return canvas;
  }

  const output = document.createElement('canvas');
  output.width = width;
  output.height = height;
  const ctx = output.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas 2d context');
  }
  ctx.drawImage(canvas, 0, 0, width, height);
  return output;
};

export interface EnhancedReceiptImage {
  dataUrl: string;
  boundary: Quad | null;
  width: number;
  height: number;
}

export const loadImageFile = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for enhancement'));
    };
    img.src = objectUrl;
  });
};

/**
 * Returns a Quad covering the full image (its four corners) — the
 * starting boundary offered when detectReceiptBoundary finds nothing
 * confident, so a caller/UI still has something to crop-and-drag-in from.
 */
export const fullImageQuad = (source: HTMLImageElement | HTMLCanvasElement): Quad => {
  const width = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const height = 'naturalHeight' in source ? source.naturalHeight : source.height;
  return {
    topLeft: { x: 0, y: 0 },
    topRight: { x: width, y: 0 },
    bottomRight: { x: width, y: height },
    bottomLeft: { x: 0, y: height },
  };
};

/**
 * Moves each corner of a quad a fraction of the way toward the quad's
 * centroid. Used to pull a starting quad's corners in from an image's true
 * edges/corners a little, since a handle sitting exactly on the boundary
 * of a canvas is awkward to grab (especially with a fingertip) — half its
 * hit target falls outside the canvas.
 */
export const insetQuad = (quad: Quad, insetRatio: number): Quad => {
  const centroid: Point = {
    x: (quad.topLeft.x + quad.topRight.x + quad.bottomRight.x + quad.bottomLeft.x) / 4,
    y: (quad.topLeft.y + quad.topRight.y + quad.bottomRight.y + quad.bottomLeft.y) / 4,
  };
  const moveTowardCentroid = (p: Point): Point => ({
    x: p.x + (centroid.x - p.x) * insetRatio,
    y: p.y + (centroid.y - p.y) * insetRatio,
  });

  return {
    topLeft: moveTowardCentroid(quad.topLeft),
    topRight: moveTowardCentroid(quad.topRight),
    bottomRight: moveTowardCentroid(quad.bottomRight),
    bottomLeft: moveTowardCentroid(quad.bottomLeft),
  };
};

/**
 * Perspective-crops to the given quad, or (if quad is null) just draws the
 * full image onto a same-size canvas unchanged. The shared first step of
 * every "given an already-loaded image and an explicit quad" pipeline
 * variant below, so each one only has to add its own enhancement pass.
 */
const cropOrFullImage = async (img: HTMLImageElement, quad: Quad | null): Promise<HTMLCanvasElement> => {
  if (quad) {
    return cropToQuad(img, quad);
  }
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas 2d context');
  }
  ctx.drawImage(img, 0, 0);
  return canvas;
};

/**
 * Crop-or-skip -> grayscale/contrast enhancement -> resize to <=2048px on
 * either dimension -> JPEG data URL, given an already-loaded image and an
 * explicit quad (or null to skip cropping entirely). Split out from
 * enhanceReceiptImage so a caller that lets the user manually adjust the
 * detected boundary (e.g. drag corner handles) can re-run just this part
 * without redoing file loading/boundary detection.
 */
export const enhanceReceiptFromImageAndQuad = async (
  img: HTMLImageElement,
  quad: Quad | null
): Promise<EnhancedReceiptImage> => {
  const canvas = await cropOrFullImage(img, quad);
  const enhanced = enhanceForOcr(canvas);
  const resized = resizeToMaxDimension(enhanced);

  return {
    dataUrl: resized.toDataURL('image/jpeg', 0.85),
    boundary: quad,
    width: resized.width,
    height: resized.height,
  };
};

/**
 * Same as enhanceReceiptFromImageAndQuad, but using binarizeForOcr's
 * histogram-thresholded black-and-white output instead of the smoother
 * grayscale+contrast-stretch enhancement.
 */
export const binarizeReceiptFromImageAndQuad = async (img: HTMLImageElement, quad: Quad | null): Promise<EnhancedReceiptImage> => {
  const canvas = await cropOrFullImage(img, quad);
  const binarized = binarizeForOcr(canvas);
  const resized = resizeToMaxDimension(binarized);

  return {
    dataUrl: resized.toDataURL('image/jpeg', 0.85),
    boundary: quad,
    width: resized.width,
    height: resized.height,
  };
};

/**
 * Top-level orchestrator: File -> boundary detection -> perspective crop
 * (skipped if no boundary was found) -> grayscale/contrast enhancement ->
 * resize to <=2048px on either dimension -> JPEG data URL. This is the one
 * entry point both the dev test page and (eventually) the real scan flow
 * are meant to call for a fully-automatic run (no user-adjusted quad).
 */
export const enhanceReceiptImage = async (file: File): Promise<EnhancedReceiptImage> => {
  const img = await loadImageFile(file);
  const boundary = await detectReceiptBoundary(img);
  return enhanceReceiptFromImageAndQuad(img, boundary);
};
