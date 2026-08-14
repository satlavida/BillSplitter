import { z } from 'zod';

/**
 * Frozen copy of the pre-session-store (`billSplitter` localStorage key)
 * shape, as it existed at the start of the v3 migration. Intentionally
 * self-contained (does not import from the live schemas/bill.schema.ts) so
 * future changes to the current schema never affect how old data is read
 * during migration - see migrations/toSessionStore.ts.
 */
const LegacyDiscountTypeSchema = z.enum(['flat', 'percentage']);

const LegacyConsumedByEntrySchema = z
  .union([
    z.string(),
    z.object({
      personId: z.string(),
      value: z.number(),
    }),
  ])
  .transform((entry) => (typeof entry === 'string' ? { personId: entry, value: 1 } : entry));

const LegacyItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number().nonnegative(),
  quantity: z.number().positive().default(1),
  discount: z.number().nonnegative().default(0),
  discountType: LegacyDiscountTypeSchema.default('flat'),
  consumedBy: z.array(LegacyConsumedByEntrySchema).default([]),
  splitType: z.enum(['equal', 'percentage', 'fraction']).default('equal'),
});

const LegacyPersonSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const LegacyBillStateSchema = z.object({
  version: z.string(),
  billId: z.string().nullable().default(null),
  step: z.number().int().min(1).max(4).default(1),
  people: z.array(LegacyPersonSchema).default([]),
  items: z.array(LegacyItemSchema).default([]),
  taxAmount: z.number().nonnegative().default(0),
  currency: z.string().default('INR'),
  title: z.string().default(''),
});
export type LegacyBillState = z.infer<typeof LegacyBillStateSchema>;
