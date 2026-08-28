import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Card, FileUpload, Spinner, Alert } from '../ui/components';
import { detectReceiptBoundary, enhanceReceiptImage, type Quad, type EnhancedReceiptImage } from '../lib/receiptEnhance';

/**
 * Dev-only page for visually validating the client-side receipt
 * boundary-detection/crop/enhance pipeline (src/lib/receiptEnhance.ts)
 * before it's wired into the real ScanReceiptButton flow. Entirely local:
 * no network calls, no sessionStore/billStore/imageStore writes. Reached
 * by navigating directly to the hash route (not linked from the sidebar).
 */
const DevReceiptScanTestPage = () => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [boundary, setBoundary] = useState<Quad | null | undefined>(undefined);
  const [enhanced, setEnhanced] = useState<EnhancedReceiptImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Draw the original image + detected boundary overlay once both the
  // image element and the boundary-detection result are ready.
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || boundary === undefined) return;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(img, 0, 0);

    if (boundary) {
      const points = [boundary.topLeft, boundary.topRight, boundary.bottomRight, boundary.bottomLeft];
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = Math.max(2, img.naturalWidth / 300);
      ctx.beginPath();
      points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.stroke();

      const labels = ['TL', 'TR', 'BR', 'BL'];
      ctx.font = `${Math.max(16, img.naturalWidth / 40)}px sans-serif`;
      points.forEach((p, i) => {
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(4, img.naturalWidth / 150), 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = '#166534';
        ctx.fillText(labels[i], p.x + 8, p.y - 8);
      });
    }
  }, [boundary]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setEnhanced(null);
    setBoundary(undefined);
    setIsProcessing(true);

    const url = URL.createObjectURL(file);
    setImageUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return url;
    });

    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      imgRef.current = img;

      const detected = await detectReceiptBoundary(img);
      setBoundary(detected);

      const result = await enhanceReceiptImage(file);
      setEnhanced(result);
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
          <h3 className="font-medium mb-2 dark:text-white">Detected boundary</h3>
          {/* Hidden source image used only to feed the canvas draw + detection */}
          <img ref={imgRef} src={imageUrl} alt="" className="hidden" />
          <canvas ref={canvasRef} className="max-w-full border border-zinc-200 dark:border-zinc-700 rounded" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
            {boundary === undefined ? 'Detecting...' : boundary ? 'Boundary found (green overlay).' : 'No confident boundary found — full image will be used.'}
          </p>
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
