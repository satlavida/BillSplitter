import { computeResizedDimensions, resizeImageToDataUrl } from './imageResize';

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

describe('resizeImageToDataUrl', () => {
  const originalImage = globalThis.Image;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  afterEach(() => {
    globalThis.Image = originalImage;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    jest.restoreAllMocks();
  });

  test('draws the scaled image to a canvas and resolves with a JPEG data URL', async () => {
    URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = jest.fn();

    class MockImage {
      naturalWidth = 4000;
      naturalHeight = 3000;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        // Simulate async image decode completing successfully
        setTimeout(() => this.onload?.(), 0);
      }
    }
    // @ts-expect-error - simplified test double, not a full HTMLImageElement
    globalThis.Image = MockImage;

    const drawImageSpy = jest.fn();
    const toDataURLSpy = jest.fn(() => 'data:image/jpeg;base64,mockdata');
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: drawImageSpy,
    } as unknown as CanvasRenderingContext2D);
    jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(toDataURLSpy);

    const file = new File(['fake-image-bytes'], 'receipt.jpg', { type: 'image/jpeg' });
    const result = await resizeImageToDataUrl(file, 1920, 1080);

    expect(result.width).toBe(1440); // 4000 * (1080/3000) = 1440
    expect(result.height).toBe(1080);
    expect(result.dataUrl).toBe('data:image/jpeg;base64,mockdata');
    expect(drawImageSpy).toHaveBeenCalledWith(expect.anything(), 0, 0, 1440, 1080);
    expect(toDataURLSpy).toHaveBeenCalledWith('image/jpeg', 0.85);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  test('rejects when the image fails to load', async () => {
    URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = jest.fn();

    class FailingMockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        setTimeout(() => this.onerror?.(), 0);
      }
    }
    // @ts-expect-error - simplified test double
    globalThis.Image = FailingMockImage;

    const file = new File(['not-an-image'], 'broken.jpg', { type: 'image/jpeg' });
    await expect(resizeImageToDataUrl(file)).rejects.toThrow('Failed to load image for resizing');
  });
});
