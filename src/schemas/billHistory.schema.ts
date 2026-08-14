import { z } from 'zod';
import { BillStateSchema } from './bill.schema';

/**
 * `data` on a history entry is a full billStore state snapshot, but with a
 * `billId` mixed in (see billHistoryStore's addBill/saveBill). Kept
 * permissive (.passthrough-free but built on BillStateSchema's own
 * defaults) so older bill snapshots missing newer fields still parse.
 */
export const BillHistoryEntrySchema = z.object({
  id: z.string(),
  title: z.string().default('Untitled Bill'),
  date: z.string(),
  data: BillStateSchema.extend({
    billId: z.string().nullable().optional(),
  }),
  isCurrent: z.boolean().default(false),
  version: z.string(),
});
export type BillHistoryEntry = z.infer<typeof BillHistoryEntrySchema>;

export const BillHistoryStateSchema = z.object({
  version: z.string(),
  bills: z.array(BillHistoryEntrySchema).default([]),
  currentBillId: z.string().nullable().default(null),
});
export type BillHistoryState = z.infer<typeof BillHistoryStateSchema>;
