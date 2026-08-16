import useSessionStore from '../sessionStore';
import useBillStore from '../billStore';
import { getImageBlob } from './imageStore';
import { ReceiptScanResponseSchema, type ReceiptScanResponse } from '../schemas/receiptScan.schema';

// Same base URL as liveApi.ts — receipt scanning is now served by the Go
// live-collaboration server's POST /api/scan (migrated off the external
// bill-processor Cloudflare Worker).
const LIVE_SERVER_URL = import.meta.env.VITE_LIVE_SERVER_URL || 'http://localhost:8080';

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
};

const applyScanResults = (sessionId: string, billId: string, data: ReceiptScanResponse) => {
  // If the scanned bill is the one currently open in the bill-editor's
  // scratch store, write through billStore so the on-screen item list picks
  // up the results immediately (billStore -> sessionStore is a one-way
  // subscription; sessionStore changes made directly don't flow back into
  // an already-hydrated billStore). Otherwise the bill was scanned in the
  // background while the user was elsewhere, so sessionStore is the only
  // place that needs updating.
  if (useBillStore.getState().billId === billId) {
    const { addItem, setTax } = useBillStore.getState();
    data.items.forEach((item) => {
      addItem({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        discount: item.discount?.value ?? 0,
        discountType: item.discount?.discountType ?? 'flat',
      });
    });
    if (data.tax !== undefined) {
      setTax(data.tax);
    }
    useSessionStore.getState().updateBill(sessionId, billId, { scanStatus: 'idle', scanError: null });
    return;
  }

  const bill = useSessionStore.getState().getBill(sessionId, billId);
  const existingItems = bill?.items ?? [];
  const newItems = data.items.map((item) => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    discount: item.discount?.value ?? 0,
    discountType: item.discount?.discountType ?? ('flat' as const),
    consumedBy: [],
    splitType: 'equal' as const,
  }));

  useSessionStore.getState().updateBill(sessionId, billId, {
    items: [...existingItems, ...newItems],
    taxAmount: data.tax !== undefined ? data.tax : bill?.taxAmount,
    scanStatus: 'idle',
    scanError: null,
  });
};

/**
 * Scans a bill's already-stored receipt image (bill.receiptImage, saved to
 * IndexedDB by ScanReceiptButton before this is called) and writes the
 * result into the store. Fire-and-forget by design — it has its own
 * try/catch and never throws, so it survives the upload modal closing and
 * the triggering component unmounting. Used for both the initial scan and
 * manual retries.
 */
export async function scanBillReceipt(sessionId: string, billId: string): Promise<void> {
  const bill = useSessionStore.getState().getBill(sessionId, billId);
  if (!bill?.receiptImage) return;

  try {
    const blob = await getImageBlob(bill.receiptImage.refKey);
    if (!blob) {
      throw new Error('Stored receipt image is missing');
    }

    const base64Data = await blobToBase64(blob);
    const response = await fetch(`${LIVE_SERVER_URL}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: { base64Data, mimeType: blob.type || 'image/jpeg' } }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    const rawData = await response.json();
    const data = ReceiptScanResponseSchema.parse(rawData);
    applyScanResults(sessionId, billId, data);
  } catch (err) {
    // A thrown TypeError means fetch couldn't reach the server at all
    // (network error / server down) — distinct from a reachable server
    // returning an error or unparseable output.
    const scanError = err instanceof TypeError ? 'offline' : 'failed';
    console.error('Receipt scan failed:', err);
    useSessionStore.getState().updateBill(sessionId, billId, { scanStatus: 'error', scanError });
  }
}
