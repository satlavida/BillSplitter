import type { SplitType } from '../schemas/bill.schema';

// Shared "what split type should a newly-added item start with" rule, used
// by billStore.addItem (creator's ItemsInput + the billStore branch of
// receiptScan.ts), receiptScan.ts's sessionStore branch, and the joiner's
// AddItemForm.tsx/receipt scan — so manual add and scanned items behave the
// same way everywhere. Gated by settingsStore's autoQuantitySplit (on by
// default) since some users prefer every new item to start as Equal Split
// regardless of quantity, same as pre-this-setting behavior.
export const defaultSplitTypeForQuantity = (quantity: number, autoQuantitySplit: boolean): SplitType =>
  autoQuantitySplit && quantity > 1 ? 'fraction' : 'equal';
