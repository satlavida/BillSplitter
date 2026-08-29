import { addLiveItem, updateLiveBill } from './liveApi';
import useSettingsStore from '../settingsStore';
import { defaultSplitTypeForQuantity } from './defaultSplitType';
import { generateId } from './generateId';
import { ReceiptScanResponseSchema } from '../schemas/receiptScan.schema';
import { scannedTitle, isUnsetTitle } from './receiptTitle';
import type { LiveBill } from '../schemas/live.schema';

// Same base URL as liveApi.ts/receiptScan.ts — POST /api/scan takes no
// session context at all (stateless image-in, items-out), so this needs no
// server changes to work for a joiner.
const LIVE_SERVER_URL = import.meta.env.VITE_LIVE_SERVER_URL || 'http://localhost:8080';

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

export interface JoinerScanResult {
  ok: boolean;
  // 'offline' for a network-level failure reaching the server, 'failed' for
  // a reachable-but-unsuccessful scan — mirrors Bill.scanError's two states
  // on the creator side (see architecture/scan-receipt.md).
  errorKind?: 'offline' | 'failed';
}

/**
 * Joiner-side mirror of receiptScan.ts's scanBillReceipt. The creator's
 * version writes results into sessionStore (the local persisted store,
 * which then best-effort-pushes to the live server); a joiner has no such
 * store, so this pushes items/tax/title straight to the live server via
 * liveApi.ts instead. Unlike the creator's fire-and-forget version, the
 * caller (JoinerScanReceiptButton.tsx) awaits this to drive its own
 * spinner/error UI — there's no background bill-list scan-status indicator
 * on the joiner side to fall back on.
 */
export async function scanLiveBillReceipt(code: string, bill: LiveBill, imageBlob: Blob, myPersonId: string | null, joinerToken: string | null): Promise<JoinerScanResult> {
  try {
    const base64Data = await blobToBase64(imageBlob);
    const response = await fetch(`${LIVE_SERVER_URL}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: { base64Data, mimeType: imageBlob.type || 'image/jpeg' } }),
    });
    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }
    const data = ReceiptScanResponseSchema.parse(await response.json());

    const autoQuantitySplit = useSettingsStore.getState().autoQuantitySplit;
    for (const item of data.items) {
      await addLiveItem(
        code,
        bill.id,
        {
          id: generateId(),
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          discount: item.discount?.value ?? 0,
          discountType: item.discount?.discountType ?? 'flat',
          splitType: defaultSplitTypeForQuantity(item.quantity, autoQuantitySplit),
        },
        joinerToken ?? undefined
      );
    }

    const title = scannedTitle(data);
    await updateLiveBill(
      code,
      bill.id,
      {
        title: title && isUnsetTitle(bill.title) ? title : bill.title,
        currency: bill.currency,
        taxAmount: data.tax !== undefined ? data.tax : bill.taxAmount,
        // Default the payer to whoever's scanning, if the bill has none yet
        // — mirrors the creator-side default in SessionHomePage.tsx's
        // handleScanNewBill (self-name match); a joiner's own identity is
        // always known, no matching needed.
        paidByPersonId: bill.paidByPersonId ?? myPersonId,
        exchangeRate: bill.exchangeRate,
        exchangeRateDate: bill.exchangeRateDate,
        exchangeRateIsOverride: bill.exchangeRateIsOverride,
      },
      joinerToken ?? undefined
    );

    return { ok: true };
  } catch (err) {
    console.error('Joiner receipt scan failed:', err);
    return { ok: false, errorKind: err instanceof TypeError ? 'offline' : 'failed' };
  }
}
