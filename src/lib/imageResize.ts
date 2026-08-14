export interface ResizedImage {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Pure scaling math, split out from resizeImageToDataUrl so it's testable
 * without a real canvas/Image environment. Never upscales (ratio capped at 1).
 */
export const computeResizedDimensions = (
  naturalWidth: number,
  naturalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } => {
  const ratio = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight, 1);
  return {
    width: Math.round(naturalWidth * ratio),
    height: Math.round(naturalHeight * ratio),
  };
};

/**
 * Resizes an image file to fit within maxWidth x maxHeight (aspect-preserved,
 * never upscaled) and returns it as a JPEG data URL. Used to shrink scanned
 * receipt photos before persisting them, independent of the full-resolution
 * bytes sent to the OCR worker for scanning.
 */
export const resizeImageToDataUrl = (file: File, maxWidth = 1920, maxHeight = 1080): Promise<ResizedImage> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      const { width, height } = computeResizedDimensions(img.naturalWidth, img.naturalHeight, maxWidth, maxHeight);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      URL.revokeObjectURL(objectUrl);

      if (!ctx) {
        reject(new Error('Could not get canvas 2d context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve({ dataUrl, width, height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for resizing'));
    };

    img.src = objectUrl;
  });
};
