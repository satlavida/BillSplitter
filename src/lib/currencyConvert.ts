import { getEffectiveRate } from './settlement';

// Converts an amount from a bill's own currency into sessionCurrency using
// that bill's effective rate (see getEffectiveRate). Used by
// JoinerBillEditorPage's "Show in session currency" toggle — joiners default
// to seeing a bill in its own currency (the whole point of per-bill
// currency), but can opt into a session-currency view. Accepts a structural
// slice rather than the full Bill/LiveBill type since both frontend bill
// shapes carry the same currency/exchangeRate fields.
export const toSessionCurrency = (amount: number, bill: { currency: string; exchangeRate: number | null }, sessionCurrency: string): number =>
  amount * getEffectiveRate(bill, sessionCurrency);
