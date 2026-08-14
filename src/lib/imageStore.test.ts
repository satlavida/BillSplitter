import { dataUrlToBlob } from './imageStore';

describe('dataUrlToBlob', () => {
  test('converts a base64 JPEG data URL into a Blob with the right mime type and size', () => {
    // "hello" base64-encoded, wrapped as a fake JPEG data URL
    const dataUrl = `data:image/jpeg;base64,${btoa('hello')}`;
    const blob = dataUrlToBlob(dataUrl);

    expect(blob.type).toBe('image/jpeg');
    expect(blob.size).toBe('hello'.length);
  });

  test('defaults to image/jpeg when the mime type cannot be parsed', () => {
    const dataUrl = `data:;base64,${btoa('x')}`;
    const blob = dataUrlToBlob(dataUrl);
    expect(blob.type).toBe('image/jpeg');
  });
});
