import { useCallback, useState, type ChangeEvent } from 'react';
import { Card, FileUpload, Spinner, Alert, Button } from '../ui/components';
import ReceiptBoundaryEditor, { computeStartingQuad, FALLBACK_INSET_RATIO } from '../Components/ReceiptBoundaryEditor';
import {
  enhanceReceiptFromImageAndQuad,
  binarizeReceiptFromImageAndQuad,
  loadImageFile,
  fullImageQuad,
  insetQuad,
  type Quad,
  type EnhancedReceiptImage,
} from '../lib/receiptEnhance';

/**
 * Dev-only page for visually validating the client-side receipt
 * crop/enhance pipeline (src/lib/receiptEnhance.ts) before it's wired into
 * the real ScanReceiptButton flow. Entirely local: no network calls, no
 * sessionStore/billStore/imageStore writes. Reached by navigating directly
 * to the hash route (not linked from the sidebar).
 *
 * Auto-detection is disabled (see detectReceiptBoundary's skeleton
 * comment), so this always starts from the full image's corners as
 * draggable handles on a canvas overlay, adjusted by hand before
 * re-running the crop + enhancement.
 */
const DevReceiptScanTestPage = () => {
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [editableQuad, setEditableQuad] = useState<Quad | null>(null);
  const [enhanced, setEnhanced] = useState<EnhancedReceiptImage | null>(null);
  const [binarized, setBinarized] = useState<EnhancedReceiptImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const runOutputs = useCallback(async (img: HTMLImageElement, quad: Quad | null) => {
    setIsApplying(true);
    try {
      const [enhancedResult, binarizedResult] = await Promise.all([
        enhanceReceiptFromImageAndQuad(img, quad),
        binarizeReceiptFromImageAndQuad(img, quad),
      ]);
      setEnhanced(enhancedResult);
      setBinarized(binarizedResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enhance image');
    } finally {
      setIsApplying(false);
    }
  }, []);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setEnhanced(null);
    setBinarized(null);
    setEditableQuad(null);
    setImgEl(null);
    setIsProcessing(true);

    try {
      const img = await loadImageFile(file);
      setImgEl(img);

      // No auto-detection (see receiptEnhance.ts's detectReceiptBoundary) —
      // always start from the full image.
      const startingQuad = computeStartingQuad(null, img);
      setEditableQuad(startingQuad);
      await runOutputs(img, startingQuad);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuadChange = (quad: Quad) => setEditableQuad(quad);

  const handleDragEnd = (quad: Quad) => {
    if (!imgEl) return;
    void runOutputs(imgEl, quad);
  };

  const useFullImage = () => {
    if (!imgEl) return;
    const quad = insetQuad(fullImageQuad(imgEl), FALLBACK_INSET_RATIO);
    setEditableQuad(quad);
    void runOutputs(imgEl, quad);
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2 dark:text-white">Receipt Scan Pipeline (Dev Test)</h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
        Local-only tool for validating manual perspective crop and grayscale/contrast enhancement (no auto-detection). Nothing
        here is sent to the server.
      </p>

      <Card>
        <FileUpload label="Pick a receipt photo" accept="image/*" onChange={handleFileChange} />
        {isProcessing && (
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <Spinner size="sm" /> Processing...
          </div>
        )}
        {error && <Alert type="error">{error}</Alert>}
      </Card>

      {imgEl && editableQuad && (
        <Card>
          <h3 className="font-medium mb-2 dark:text-white">Boundary (drag the corner handles to adjust)</h3>
          <ReceiptBoundaryEditor
            img={imgEl}
            quad={editableQuad}
            onChange={handleQuadChange}
            onDragEnd={handleDragEnd}
            className="max-w-full border border-zinc-200 dark:border-zinc-700 rounded"
          />
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
            No auto-detection — starting from the full image edges. Drag the corners in to select the receipt.
            {isApplying && ' Re-applying crop...'}
          </p>
          <div className="flex gap-2 mt-2">
            <Button variant="secondary" size="sm" onClick={useFullImage}>
              Reset to full image
            </Button>
          </div>
        </Card>
      )}

      {enhanced && (
        <Card>
          <h3 className="font-medium mb-2 dark:text-white">Cropped + enhanced output (grayscale + contrast)</h3>
          <img src={enhanced.dataUrl} alt="Enhanced receipt" className="max-w-full border border-zinc-200 dark:border-zinc-700 rounded" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
            {enhanced.width}×{enhanced.height}px, {enhanced.boundary ? 'perspective-cropped' : 'no crop applied'}
          </p>
        </Card>
      )}

      {binarized && (
        <Card>
          <h3 className="font-medium mb-2 dark:text-white">Black &amp; white preview (Otsu threshold)</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
            Histogram-based binarization: lighter pixels become pure white, darker pixels become pure black, instead of a
            smoothed grayscale.
          </p>
          <img src={binarized.dataUrl} alt="Black and white receipt" className="max-w-full border border-zinc-200 dark:border-zinc-700 rounded" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
            {binarized.width}×{binarized.height}px, {binarized.boundary ? 'perspective-cropped' : 'no crop applied'}
          </p>
        </Card>
      )}
    </div>
  );
};

export default DevReceiptScanTestPage;
