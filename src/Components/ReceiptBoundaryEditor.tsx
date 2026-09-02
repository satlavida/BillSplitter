import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { fullImageQuad, insetQuad, type Quad, type Point } from '../lib/receiptEnhance';

const CORNER_KEYS: (keyof Quad)[] = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];
const CORNER_LABELS = ['TL', 'TR', 'BR', 'BL'];

// A quad starting exactly on the image's true edges/corners is awkward to
// grab (half the touch target falls outside the canvas, especially on
// mobile), so any "start from the full image" quad gets pulled in a
// little first — the user can still drag corners back out to the true
// edge.
export const FALLBACK_INSET_RATIO = 0.05;

/** detected ?? an easy-to-grab starting quad covering (almost) the full image. */
export const computeStartingQuad = (detected: Quad | null, img: HTMLImageElement): Quad =>
  detected ?? insetQuad(fullImageQuad(img), FALLBACK_INSET_RATIO);

// Shared between drawing and hit-testing so the visible "catch" ring
// always matches the actual draggable area.
const getHandleRadii = (refWidth: number) => ({
  dot: Math.max(13, refWidth / 70),
  catchRing: Math.max(26, refWidth / 30),
});

const drawQuadOverlay = (ctx: CanvasRenderingContext2D, quad: Quad, refWidth: number, draggingIndex: number | null) => {
  const points = CORNER_KEYS.map((key) => quad[key]);
  const { dot, catchRing } = getHandleRadii(refWidth);

  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = Math.max(2, refWidth / 300);
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.stroke();

  ctx.font = `${Math.max(16, refWidth / 40)}px sans-serif`;
  points.forEach((p, i) => {
    const isActive = i === draggingIndex;
    const color = isActive ? '#f97316' : '#2563eb';

    // Larger translucent ring showing the actual grabbable area — this is
    // the part that matters for touch, since a fingertip is much wider
    // than the thin boundary line/solid dot alone.
    ctx.beginPath();
    ctx.arc(p.x, p.y, isActive ? catchRing * 1.15 : catchRing, 0, 2 * Math.PI);
    ctx.fillStyle = isActive ? 'rgba(249, 115, 22, 0.18)' : 'rgba(37, 99, 235, 0.15)';
    ctx.fill();
    ctx.strokeStyle = isActive ? 'rgba(249, 115, 22, 0.6)' : 'rgba(37, 99, 235, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Solid center dot marking the exact corner position.
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(p.x, p.y, isActive ? dot * 1.3 : dot, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#1e3a8a';
    ctx.fillText(CORNER_LABELS[i], p.x + catchRing + 4, p.y - catchRing - 4);
  });
};

export interface ReceiptBoundaryEditorProps {
  img: HTMLImageElement;
  quad: Quad;
  onChange: (quad: Quad) => void;
  onDragEnd?: (quad: Quad) => void;
  className?: string;
}

/**
 * Draws an image with a draggable-corner-handle quad overlay on top —
 * controlled: the parent owns the quad, this just renders it and reports
 * drag updates. Pointer-event-driven so it works with touch as well as
 * mouse. Shared by the dev-only pipeline test page
 * (DevReceiptScanTestPage.tsx) and the real ScanReceiptButton crop step.
 */
const ReceiptBoundaryEditor = ({ img, quad, onChange, onDragEnd, className = '' }: ReceiptBoundaryEditorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(img, 0, 0);
    drawQuadOverlay(ctx, quad, img.naturalWidth, draggingIndex);
  }, [img, quad, draggingIndex]);

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
    const p = getCanvasPoint(e);
    const hitRadius = getHandleRadii(img.naturalWidth).catchRing;

    let closestIndex = -1;
    let closestDist = Infinity;
    CORNER_KEYS.forEach((key, i) => {
      const corner = quad[key];
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
    if (draggingIndex === null) return;
    const p = getCanvasPoint(e);
    const key = CORNER_KEYS[draggingIndex];
    onChange({ ...quad, [key]: p });
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (draggingIndex === null) return;
    setDraggingIndex(null);
    e.currentTarget.releasePointerCapture(e.pointerId);
    onDragEnd?.(quad);
  };

  return (
    <canvas
      ref={canvasRef}
      className={`touch-none cursor-grab ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    />
  );
};

export default ReceiptBoundaryEditor;
