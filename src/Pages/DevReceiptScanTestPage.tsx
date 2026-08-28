import { useCallback, useEffect, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Card, FileUpload, Spinner, Alert, Button } from '../ui/components';
import {
  detectReceiptBoundary,
  enhanceReceiptFromImageAndQuad,
  loadImageFile,
  fullImageQuad,
  type Quad,
  type Point,
  type EnhancedReceiptImage,
} from '../lib/receiptEnhance';

const CORNER_KEYS: (keyof Quad)[] = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];
const CORNER_LABELS = ['TL', 'TR', 'BR', 'BL'];

const drawQuadOverlay = (ctx: CanvasRenderingContext2D, quad: Quad, refWidth: number, draggingIndex: number | null) => {
  const points = CORNER_KEYS.map((key) => quad[key]);
  const handleRadius = Math.max(8, refWidth / 120);

  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = Math.max(2, refWidth / 300);
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.stroke();

  ctx.font = `${Math.max(16, refWidth / 40)}px sans-serif`;
  points.forEach((p, i) => {
    ctx.fillStyle = i === draggingIndex ? '#f97316' : '#22c55e';
    ctx.beginPath();
    ctx.arc(p.x, p.y, i === draggingIndex ? handleRadius * 1.3 : handleRadius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#166534';
    ctx.fillText(CORNER_LABELS[i], p.x + handleRadius + 4, p.y - handleRadius - 4);
  });
};

/**
 * Dev-only page for visually validating the client-side receipt
 * boundary-detection/crop/enhance pipeline (src/lib/receiptEnhance.ts)
 * before it's wired into the real ScanReceiptButton flow. Entirely local:
 * no network calls, no sessionStore/billStore/imageStore writes. Reached
 * by navigating directly to the hash route (not linked from the sidebar).
 *
 * Shows whatever boundary was auto-detected (or, if none was found, the
 * full image's corners) as draggable handles on a canvas overlay, so a
 * missed/imperfect detection can be corrected by hand before re-running
 * the crop + enhancement.
 */
const DevReceiptScanTestPage = () => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [detectedBoundary, setDetectedBoundary] = useState<Quad | null | undefined>(undefined);
  const [editableQuad, setEditableQuad] = useState<Quad | null>(null);
  const [enhanced, setEnhanced] = useState<EnhancedReceiptImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Draw the original image + the current (possibly hand-adjusted)
  // boundary overlay whenever the quad or drag state changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !editableQuad) return;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(img, 0, 0);
    drawQuadOverlay(ctx, editableQuad, img.naturalWidth, draggingIndex);
  }, [editableQuad, draggingIndex]);

  const runEnhance = useCallback(async (quad: Quad | null) => {
    const img = imgRef.current;
    if (!img) return;
    setIsApplying(true);
    try {
      const result = await enhanceReceiptFromImageAndQuad(img, quad);
      setEnhanced(result);
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
    setDetectedBoundary(undefined);
    setEditableQuad(null);
    setIsProcessing(true);

    try {
      const img = await loadImageFile(file);
      imgRef.current = img;
      setImageUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return img.src;
      });

      const detected = await detectReceiptBoundary(img);
      setDetectedBoundary(detected);

      const startingQuad = detected ?? fullImageQuad(img);
      setEditableQuad(startingQuad);
      await runEnhance(startingQuad);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getCanvasPoint = (e: ReactPointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: Math.min(canvas.width, Math.max(0, (e.clientX - rect.left) * scaleX)),
      y: Math.min(canvas.height, Math.max(0, (e.clientY - rect.top) * scaleY)),
    };
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!editableQuad || !imgRef.current) return;
    const p = getCanvasPoint(e);
    const hitRadius = Math.max(20, imgRef.current.naturalWidth / 40);

    let closestIndex = -1;
    let closestDist = Infinity;
    CORNER_KEYS.forEach((key, i) => {
      const corner = editableQuad[key];
      const dist = Math.hypot(corner.x - p.x, corner.y - p.y);
      if (dist < hitRadius && dist < closestDist) {
        closestDist = dist;
        closestIndex = i;
      }
    });

    if (closestIndex >= 0) {
      setDraggingIndex(closestIndex);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (draggingIndex === null || !editableQuad) return;
    const p = getCanvasPoint(e);
    const key = CORNER_KEYS[draggingIndex];
    setEditableQuad({ ...editableQuad, [key]: p });
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (draggingIndex === null) return;
    setDraggingIndex(null);
    e.currentTarget.releasePointerCapture(e.pointerId);
    void runEnhance(editableQuad);
  };

  const resetToDetected = () => {
    const img = imgRef.current;
    if (!img) return;
    const quad = detectedBoundary ?? fullImageQuad(img);
    setEditableQuad(quad);
    void runEnhance(quad);
  };

  const useFullImage = () => {
    const img = imgRef.current;
    if (!img) return;
    const quad = fullImageQuad(img);
    setEditableQuad(quad);
    void runEnhance(quad);
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2 dark:text-white">Receipt Scan Pipeline (Dev Test)</h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
        Local-only tool for validating boundary detection, perspective crop, and grayscale/contrast enhancement. Nothing here is
        sent to the server.
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

      {imageUrl && (
        <Card>
          <h3 className="font-medium mb-2 dark:text-white">Boundary (drag the corner handles to adjust)</h3>
          <canvas
            ref={canvasRef}
            className="max-w-full border border-zinc-200 dark:border-zinc-700 rounded touch-none cursor-grab"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
            {detectedBoundary === undefined
              ? 'Detecting...'
              : detectedBoundary
                ? 'Boundary auto-detected (green). Drag a corner to fine-tune it.'
                : 'No confident boundary found — starting from the full image edges. Drag the corners in to select the receipt.'}
            {isApplying && ' Re-applying crop...'}
          </p>
          <div className="flex gap-2 mt-2">
            <Button variant="secondary" size="sm" onClick={resetToDetected} disabled={!imgRef.current}>
              Reset to detected
            </Button>
            <Button variant="secondary" size="sm" onClick={useFullImage} disabled={!imgRef.current}>
              Use full image
            </Button>
          </div>
        </Card>
      )}

      {enhanced && (
        <Card>
          <h3 className="font-medium mb-2 dark:text-white">Cropped + enhanced output</h3>
          <img src={enhanced.dataUrl} alt="Enhanced receipt" className="max-w-full border border-zinc-200 dark:border-zinc-700 rounded" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
            {enhanced.width}×{enhanced.height}px, {enhanced.boundary ? 'perspective-cropped' : 'no crop applied'}
          </p>
        </Card>
      )}
    </div>
  );
};

export default DevReceiptScanTestPage;
