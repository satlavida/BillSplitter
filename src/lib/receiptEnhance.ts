import { loadOpenCv } from './opencvLoader';

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
