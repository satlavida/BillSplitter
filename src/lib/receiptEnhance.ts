import { loadOpenCv } from './opencvLoader';
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
 * Sorts 4 unordered points (as returned by opencv's approxPolyDP, in
 * arbitrary winding order) into the TL/TR/BR/BL convention used by Quad.
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
 * Runs the receipt boundary through opencv's standard document-scanner
 * pipeline: grayscale -> blur -> Canny edges -> contours -> largest
 * 4-point contour. Returns null (not a thrown error) when no confident
 * quadrilateral is found, since "couldn't find a boundary" is an expected
 * outcome on busy backgrounds/poor lighting, not exceptional.
 */
export const detectReceiptBoundary = async (source: HTMLImageElement | HTMLCanvasElement): Promise<Quad | null> => {
  const cv = await loadOpenCv();

  const src = cv.imread(source);
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const edges = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    cv.Canny(blurred, edges, 75, 200);
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    const imageArea = src.rows * src.cols;
    let bestQuad: Point[] | null = null;
    let bestArea = 0;

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);

      // Ignore slivers/noise contours; a plausible receipt boundary should
      // cover a meaningful fraction of the photo.
      if (area > bestArea && area > imageArea * 0.1) {
        const perimeter = cv.arcLength(contour, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(contour, approx, 0.02 * perimeter, true);

        if (approx.rows === 4) {
          const points: Point[] = [];
          for (let p = 0; p < 4; p++) {
            points.push({ x: approx.data32S[p * 2], y: approx.data32S[p * 2 + 1] });
          }
          bestQuad = points;
          bestArea = area;
        }
        approx.delete();
      }
      contour.delete();
    }

    return bestQuad ? orderQuadPoints(bestQuad) : null;
  } finally {
    src.delete();
    gray.delete();
    blurred.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();
  }
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

/**
 * Perspective-corrects and crops the source image down to just the
 * detected quad, mapped onto an axis-aligned output rectangle (deskewing a
 * receipt photographed at an angle).
 */
export const cropToQuad = async (source: HTMLImageElement | HTMLCanvasElement, quad: Quad): Promise<HTMLCanvasElement> => {
  const cv = await loadOpenCv();
  const { width, height } = computeWarpedDimensions(quad);

  const src = cv.imread(source);
  const dst = new cv.Mat();
  const srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
    quad.topLeft.x,
    quad.topLeft.y,
    quad.topRight.x,
    quad.topRight.y,
    quad.bottomRight.x,
    quad.bottomRight.y,
    quad.bottomLeft.x,
    quad.bottomLeft.y,
  ]);
  const dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, width, 0, width, height, 0, height]);
  const transform = cv.getPerspectiveTransform(srcPoints, dstPoints);

  try {
    cv.warpPerspective(src, dst, transform, new cv.Size(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    cv.imshow(canvas, dst);
    return canvas;
  } finally {
    src.delete();
    dst.delete();
    srcPoints.delete();
    dstPoints.delete();
    transform.delete();
  }
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
 * Downscales (never upscales) a canvas so neither dimension exceeds
 * maxDimension, reusing the same aspect-preserving math as
 * resizeImageToDataUrl.
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
  let canvas: HTMLCanvasElement;
  if (quad) {
    canvas = await cropToQuad(img, quad);
  } else {
    canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas 2d context');
    }
    ctx.drawImage(img, 0, 0);
  }

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
