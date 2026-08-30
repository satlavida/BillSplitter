import { z } from 'zod';

// Validates responses from the Go live-collaboration server (server/internal/api).
// Kept as a separate, deliberately loose schema rather than reusing
// session.schema.ts — the wire shape is JSON from a different language's
// hand-written structs, not this app's own persisted state.

export const CreateLiveSessionResponseSchema = z.object({
  code: z.string(),
  link: z.string(),
  creatorToken: z.string(),
});
export type CreateLiveSessionResponse = z.infer<typeof CreateLiveSessionResponseSchema>;

export const LivePersonSchema = z.object({
  id: z.string(),
  name: z.string(),
  // Mirrors bill.schema.ts's Person.upiId — see architecture/session-management.md
  // and architecture/live-collaboration.md's per-person UPI ID sync notes.
  upiId: z.string().default(''),
});

export const LiveAllocationSchema = z.object({
  personId: z.string(),
  value: z.number(),
});

export const LiveItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  quantity: z.number(),
  discount: z.number(),
  discountType: z.string(),
  splitType: z.string(),
  consumedBy: z.array(LiveAllocationSchema).default([]),
});

export type LiveItem = z.infer<typeof LiveItemSchema>;

export const LiveBillSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string(),
  items: z.array(LiveItemSchema).default([]),
  taxAmount: z.number(),
  currency: z.string(),
  exchangeRate: z.number().nullable().default(null),
  exchangeRateDate: z.string().nullable().default(null),
  exchangeRateIsOverride: z.boolean().default(false),
  paidByPersonId: z.string().nullable(),
  // The bill's most-recently-uploaded receipt image, if any — distinct
  // from the client-only Bill.receiptImage in session.schema.ts, whose
  // refKey addresses this browser's own IndexedDB, not the live server.
  imageRefKey: z.string().nullable().default(null),
  imageWidth: z.number().nullable().default(null),
  imageHeight: z.number().nullable().default(null),
  // Set only on entries returned by GET .../bills/deleted (creator-only
  // "Deleted Bills" review list) — a normal GetSession response never
  // includes a soft-deleted bill at all, so this is always null there.
  deletedAt: z.string().nullable().default(null),
});
export type LiveBill = z.infer<typeof LiveBillSchema>;

// Mirrors bill.schema.ts's PaymentSchema — see architecture/payments.md.
export const LivePaymentSchema = z.object({
  id: z.string(),
  payerId: z.string(),
  payeeId: z.string(),
  amount: z.number(),
  currency: z.string(),
  exchangeRate: z.number().nullable().default(null),
  exchangeRateDate: z.string().nullable().default(null),
  exchangeRateIsOverride: z.boolean().default(false),
  method: z.enum(['cash', 'online']),
  transactionId: z.string().nullable().default(null),
  addedByPersonId: z.string(),
  verified: z.boolean(),
  verifiedAt: z.string().nullable().default(null),
  createdAt: z.string(),
});
export type LivePayment = z.infer<typeof LivePaymentSchema>;

export const LiveSessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  joinMode: z.enum(['approval_code', 'open_link']),
  // 'edit' lets joiners directly add/assign items; 'read_only' means they
  // can only view the creator's changes (req 6 — replaces the removed
  // claims-approval workflow's claimMode field).
  permissionMode: z.enum(['edit', 'read_only']).default('edit'),
  // The person row that represents the session creator's own identity, if
  // they've claimed/added one. Joiners are never allowed to join as this
  // personId (see liveApi.ts's join call / server-side rejection).
  creatorPersonId: z.string().nullable().default(null),
  isSettled: z.boolean(),
  settledAt: z.string().nullable(),
  currency: z.string().default('USD'),
  // Mirrors session.schema.ts's Session.requirePaymentVerification.
  requirePaymentVerification: z.boolean().default(true),
  people: z.array(LivePersonSchema).default([]),
  bills: z.array(LiveBillSchema).default([]),
  // Filtered server-side by caller identity (creator sees all; a joiner
  // only sees payments where they're the payer or payee) — see
  // architecture/payments.md and session_handlers.go's filterPaymentsForViewer.
  payments: z.array(LivePaymentSchema).default([]),
});
export type LiveSession = z.infer<typeof LiveSessionSchema>;

export const LiveJoinerSchema = z.object({
  id: z.string(),
  name: z.string(),
  personId: z.string().nullable(),
  status: z.enum(['pending', 'approved', 'disapproved']),
  approvalCode: z.string().optional(),
  createdAt: z.string(),
  // Only present the one time the server reveals it (the first response
  // that observes status: 'approved') — see liveApi.ts/joinerStorage.ts.
  token: z.string().optional(),
});
export type LiveJoiner = z.infer<typeof LiveJoinerSchema>;

export const LiveActivityEntrySchema = z.object({
  id: z.number(),
  itemId: z.string(),
  itemName: z.string(),
  personId: z.string(),
  personName: z.string(),
  action: z.enum(['claim', 'unclaim', 'edit_item', 'delete_item', 'delete_bill', 'restore_bill', 'permanent_delete_bill']),
  deltaValue: z.number(),
  totalValue: z.number(),
  // Human-readable diff for 'edit_item'/'delete_item' entries (e.g. "price
  // $10.00 -> $12.00") — empty for claim/unclaim, see bill_handlers.go's
  // describeItemEdit.
  details: z.string().default(''),
  createdAt: z.string(),
});
export type LiveActivityEntry = z.infer<typeof LiveActivityEntrySchema>;

// "Correctly split" for a fraction-splitType item means every claimed share
// sums exactly (within floating-point epsilon) to the item's quantity.
// Non-fraction items have no such target and are always considered correct.
const FRACTION_EPSILON = 1e-6;
export function isFractionItemCorrect(item: LiveItem): boolean {
  if (item.splitType !== 'fraction') return true;
  const total = item.consumedBy.reduce((sum, c) => sum + c.value, 0);
  return Math.abs(total - item.quantity) < FRACTION_EPSILON;
}

// Batch companion to LiveSessionSchema (see liveApi.ts's getSessionsStatus)
// — a lightweight status per code instead of full session state, used to
// reconcile joinedSessionsStorage.ts's locally-tracked list.
export const SessionStatusSchema = z.object({
  code: z.string(),
  title: z.string().optional(),
  status: z.enum(['active', 'settled', 'deleted']),
  settledAt: z.string().nullable(),
});
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const LiveSettlementSchema = z.object({
  balances: z.array(z.object({ personId: z.string(), amount: z.number() })).default([]),
  transactions: z.array(z.object({ from: z.string(), to: z.string(), amount: z.number() })).default([]),
});
export type LiveSettlement = z.infer<typeof LiveSettlementSchema>;
