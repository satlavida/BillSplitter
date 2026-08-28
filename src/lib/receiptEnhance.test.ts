import { orderQuadPoints, computeWarpedDimensions, toGrayscaleImageData, stretchContrast, type Point, type Quad } from './receiptEnhance';

// jsdom doesn't implement the ImageData constructor; toGrayscaleImageData
// and stretchContrast only touch `.data`/`.width`/`.height`, so a plain
// object matching that shape is a sufficient test double.
const makeImageData = (data: number[], width: number, height: number): ImageData =>
  ({ data: new Uint8ClampedArray(data), width, height, colorSpace: 'srgb' }) as ImageData;

describe('orderQuadPoints', () => {
  test('orders an axis-aligned rectangle regardless of input order', () => {
    // A rectangle from (10,10) to (110,60), points shuffled/rotated.
    const points: Point[] = [
      { x: 110, y: 60 }, // bottom-right
      { x: 10, y: 10 }, // top-left
      { x: 110, y: 10 }, // top-right
      { x: 10, y: 60 }, // bottom-left
    ];

    const quad = orderQuadPoints(points);

    expect(quad.topLeft).toEqual({ x: 10, y: 10 });
    expect(quad.topRight).toEqual({ x: 110, y: 10 });
    expect(quad.bottomRight).toEqual({ x: 110, y: 60 });
    expect(quad.bottomLeft).toEqual({ x: 10, y: 60 });
  });

  test('orders a rotated (diamond-shaped) quadrilateral', () => {
    // A square rotated ~45deg, points given in an arbitrary shuffled order.
    const topLeft: Point = { x: 60, y: 0 };
    const topRight: Point = { x: 120, y: 40 };
    const bottomRight: Point = { x: 80, y: 100 };
    const bottomLeft: Point = { x: 20, y: 60 };
    const points = [bottomRight, topLeft, bottomLeft, topRight];

    const quad = orderQuadPoints(points);

    expect(quad.topLeft).toEqual(topLeft);
    expect(quad.topRight).toEqual(topRight);
    expect(quad.bottomRight).toEqual(bottomRight);
    expect(quad.bottomLeft).toEqual(bottomLeft);
  });

  test('is stable when the same quad is passed in a different rotation of the same order', () => {
    const square: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];

    // Rotate the array (same cycle, different starting point)
    const rotated: Point[] = [square[2], square[3], square[0], square[1]];

    expect(orderQuadPoints(square)).toEqual(orderQuadPoints(rotated));
  });

  test('throws when given a point count other than 4', () => {
    expect(() => orderQuadPoints([{ x: 0, y: 0 }])).toThrow('orderQuadPoints requires exactly 4 points, got 1');
    expect(() =>
      orderQuadPoints([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 },
        { x: 3, y: 3 },
        { x: 4, y: 4 },
      ])
    ).toThrow('orderQuadPoints requires exactly 4 points, got 5');
  });
});

describe('computeWarpedDimensions', () => {
  test('uses the longer of each pair of opposing edges', () => {
    // A trapezoid: top edge shorter than bottom edge, left/right edges equal.
    const quad: Quad = {
      topLeft: { x: 20, y: 0 },
      topRight: { x: 80, y: 0 },
      bottomRight: { x: 100, y: 50 },
      bottomLeft: { x: 0, y: 50 },
    };

    const { width, height } = computeWarpedDimensions(quad);

    expect(width).toBe(100); // bottom edge (100) is longer than top edge (60)
    expect(height).toBe(54); // slanted left/right edges: sqrt(20^2 + 50^2) ~= 53.85
  });

  test('returns the side length for an axis-aligned square', () => {
    const quad: Quad = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 40, y: 0 },
      bottomRight: { x: 40, y: 40 },
      bottomLeft: { x: 0, y: 40 },
    };

    expect(computeWarpedDimensions(quad)).toEqual({ width: 40, height: 40 });
  });
});

describe('toGrayscaleImageData', () => {
  test('applies luminance weights and preserves alpha', () => {
    // Two pixels: pure red, pure blue.
    const input = makeImageData([255, 0, 0, 255, 0, 0, 255, 128], 2, 1);

    const output = toGrayscaleImageData(input);

    const redGray = Math.round(0.299 * 255);
    expect(output.data[0]).toBe(redGray);
    expect(output.data[1]).toBe(redGray);
    expect(output.data[2]).toBe(redGray);
    expect(output.data[3]).toBe(255); // alpha preserved

    const blueGray = Math.round(0.114 * 255);
    expect(output.data[4]).toBe(blueGray);
    expect(output.data[5]).toBe(blueGray);
    expect(output.data[6]).toBe(blueGray);
    expect(output.data[7]).toBe(128); // alpha preserved
  });
});

describe('stretchContrast', () => {
  test('remaps the observed min/max range to the full 0-255 range', () => {
    // Two grayscale pixels: one at 50, one at 150 (min/max of this image).
    const input = makeImageData([50, 50, 50, 255, 150, 150, 150, 255], 2, 1);

    const output = stretchContrast(input);

    expect(output.data[0]).toBe(0);
    expect(output.data[1]).toBe(0);
    expect(output.data[2]).toBe(0);
    expect(output.data[4]).toBe(255);
    expect(output.data[5]).toBe(255);
    expect(output.data[6]).toBe(255);
  });

  test('leaves a flat (zero-range) image unchanged', () => {
    const input = makeImageData([100, 100, 100, 255, 100, 100, 100, 255], 2, 1);

    const output = stretchContrast(input);

    expect(Array.from(output.data)).toEqual(Array.from(input.data));
  });
});
