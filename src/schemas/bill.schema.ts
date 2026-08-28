import { z } from 'zod';

export const SplitTypeSchema = z.enum(['equal', 'percentage', 'fraction']);
export type SplitType = z.infer<typeof SplitTypeSchema>;

export const DiscountTypeSchema = z.enum(['flat', 'percentage']);
export type DiscountType = z.infer<typeof DiscountTypeSchema>;

export const PersonSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type Person = z.infer<typeof PersonSchema>;

/**
 * consumedBy entries were historically persisted as bare personId strings
 * (see passAndSplitStore's `typeof consumer === 'string'` guard). The union
 * + transform here accepts both the legacy string shape and the current
 * {personId, value} object shape, normalizing everything to the object shape
 * so every downstream reader only ever sees one canonical form.
 */
export const ConsumedByEntrySchema = z
  .union([
    z.string(),
    z.object({
      personId: z.string(),
      value: z.number(),
    }),
  ])
  .transform((entry) =>
    typeof entry === 'string' ? { personId: entry, value: 1 } : entry
  );
export type ConsumedByEntry = z.output<typeof ConsumedByEntrySchema>;

export const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number().nonnegative(),
  quantity: z.number().positive().default(1),
  discount: z.number().nonnegative().default(0),
  discountType: DiscountTypeSchema.default('flat'),
  consumedBy: z.array(ConsumedByEntrySchema).default([]),
  splitType: SplitTypeSchema.default('equal'),
});
export type Item = z.infer<typeof ItemSchema>;

export const BillStateSchema = z.object({
  version: z.string(),
  billId: z.string().nullable().default(null),
  step: z.number().int().min(1).max(4).default(1),
  people: z.array(PersonSchema).default([]),
  items: z.array(ItemSchema).default([]),
  taxAmount: z.number().nonnegative().default(0),
  currency: z.string().default('INR'),
  // Mirrors Bill.exchangeRate/exchangeRateDate/exchangeRateIsOverride in
  // session.schema.ts — see that schema's comment. billStore is a scratch
  // editor, so these hold the in-progress values while the Bill Settings
  // modal is open, committed back to sessionStore like every other field.
  exchangeRate: z.number().positive().nullable().default(null),
  exchangeRateDate: z.string().nullable().default(null),
  exchangeRateIsOverride: z.boolean().default(false),
  title: z.string().default(''),
});
export type BillState = z.infer<typeof BillStateSchema>;
