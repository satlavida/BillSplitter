import type { ReceiptScanResponse } from '../schemas/receiptScan.schema';

// Bill.title's schema default (session.schema.ts) — a title still at this
// value (or empty, billStore's own scratch default) hasn't been manually
// set yet, so a scan is free to fill it in. A rescan never clobbers a title
// the user already typed themselves.
export const DEFAULT_BILL_TITLE = 'Untitled Bill';

// Split into its own module (no import.meta anywhere in its dependency
// graph, unlike receiptScan.ts) so it can be unit-tested directly under
// Jest — see sessionStore.ts's comment on why a module referencing
// import.meta.env can't be statically imported into a Jest test at all.
export const scannedTitle = (data: Pick<ReceiptScanResponse, 'restaurant_name' | 'date'>): string | undefined => {
  if (!data.restaurant_name) return undefined;
  return data.date ? `${data.restaurant_name} - ${data.date}` : data.restaurant_name;
};

export const isUnsetTitle = (title: string | undefined) => !title || title === DEFAULT_BILL_TITLE;
