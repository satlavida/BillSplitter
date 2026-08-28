import { computeResizedDimensions } from './imageResize';

describe('computeResizedDimensions', () => {
  test('downscales a landscape image to fit within maxWidth/maxHeight, preserving aspect ratio', () => {
    const { width, height } = computeResizedDimensions(4000, 3000, 1920, 1080);
    // Height is the binding constraint: 1080/3000 = 0.36
    expect(height).toBe(1080);
    expect(width).toBe(Math.round(4000 * 0.36));
  });

  test('downscales a portrait image to fit within maxWidth/maxHeight, preserving aspect ratio', () => {
    const { width, height } = computeResizedDimensions(3000, 4000, 1920, 1080);
    // Height is the binding constraint: 1080/4000 = 0.27 (tighter than 1920/3000 = 0.64)
    expect(height).toBe(1080);
    expect(width).toBe(Math.round(3000 * 0.27));
  });

  test('never upscales a smaller-than-target image', () => {
    const { width, height } = computeResizedDimensions(800, 600, 1920, 1080);
    expect(width).toBe(800);
    expect(height).toBe(600);
  });

  test('leaves an already-exact-fit image unchanged', () => {
    const { width, height } = computeResizedDimensions(1920, 1080, 1920, 1080);
    expect(width).toBe(1920);
    expect(height).toBe(1080);
  });
});
