import { z } from 'zod';
import { LegacyBillStateSchema } from './billStoreV1.schema';

/**
 * Frozen copy of the pre-session-store (`billHistory` localStorage key)
 * shape. See billStoreV1.schema.ts for why this is a separate, frozen copy
 * rather than a reference to the live schema.
 */
export const LegacyBillHistoryEntrySchema = z.object({
  id: z.string(),
  title: z.string().default('Untitled Bill'),
  date: z.string(),
  data: LegacyBillStateSchema,
  isCurrent: z.boolean().default(false),
  version: z.string(),
});
export type LegacyBillHistoryEntry = z.infer<typeof LegacyBillHistoryEntrySchema>;

export const LegacyBillHistoryStateSchema = z.object({
  version: z.string(),
  bills: z.array(LegacyBillHistoryEntrySchema).default([]),
  currentBillId: z.string().nullable().default(null),
});
export type LegacyBillHistoryState = z.infer<typeof LegacyBillHistoryStateSchema>;
