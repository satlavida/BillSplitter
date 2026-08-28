/**
 * Pure scaling math. Never upscales (ratio capped at 1). Used by
 * receiptEnhance.ts's resizeToMaxDimension.
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
