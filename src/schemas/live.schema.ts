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
  paidByPersonId: z.string().nullable(),
  // The bill's most-recently-uploaded receipt image, if any — distinct
  // from the client-only Bill.receiptImage in session.schema.ts, whose
  // refKey addresses this browser's own IndexedDB, not the live server.
  imageRefKey: z.string().nullable().default(null),
  imageWidth: z.number().nullable().default(null),
  imageHeight: z.number().nullable().default(null),
});
export type LiveBill = z.infer<typeof LiveBillSchema>;

export const LiveSessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  joinMode: z.enum(['approval_code', 'open_link']),
  claimMode: z.enum(['free_select', 'claims_require_approval']),
  isSettled: z.boolean(),
  settledAt: z.string().nullable(),
  people: z.array(LivePersonSchema).default([]),
  bills: z.array(LiveBillSchema).default([]),
});
export type LiveSession = z.infer<typeof LiveSessionSchema>;

export const LiveJoinerSchema = z.object({
  id: z.string(),
  name: z.string(),
  personId: z.string().nullable(),
  status: z.enum(['pending', 'approved', 'disapproved']),
  approvalCode: z.string().optional(),
  createdAt: z.string(),
});
export type LiveJoiner = z.infer<typeof LiveJoinerSchema>;

// POST .../items/{itemId}/claims responds one of two shapes depending on
// the session's claim_mode: free_select auto-approves and returns just
// {status: "approved"}; claims_require_approval returns the created pending
// claim (models.ItemClaim — its ItemID field is `json:"-"`, so it's not on
// the wire here). The plain-status alternative is checked first and is
// .strict() so it only matches the exact free_select shape; the richer
// shape (which a non-strict object would otherwise also match, silently
// dropping id/personId/value) is the fallback.
export const ClaimItemResponseSchema = z.union([
  z.object({ status: z.string() }).strict(),
  z.object({
    id: z.string(),
    personId: z.string(),
    value: z.number(),
    status: z.enum(['pending', 'approved']),
  }),
]);
export type ClaimItemResponse = z.infer<typeof ClaimItemResponseSchema>;

export const LiveSettlementSchema = z.object({
  balances: z.array(z.object({ personId: z.string(), amount: z.number() })).default([]),
  transactions: z.array(z.object({ from: z.string(), to: z.string(), amount: z.number() })).default([]),
});
export type LiveSettlement = z.infer<typeof LiveSettlementSchema>;
