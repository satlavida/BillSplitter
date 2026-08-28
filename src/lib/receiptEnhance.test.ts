import { orderQuadPoints, type Point } from './receiptEnhance';

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
