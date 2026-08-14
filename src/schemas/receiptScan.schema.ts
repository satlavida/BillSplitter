import { z } from 'zod';
import { DiscountTypeSchema } from './bill.schema';

/**
 * The worker's `discount` field on a scanned item comes in one of two shapes
 * (see ScanReceiptButton.jsx's processReceiptItems): a flat number, or a
 * structured { value, discountType } object. Both are accepted here and
 * normalized to the structured object shape.
 */
const ScannedDiscountSchema = z
  .union([
    z.number(),
    z.string(),
    z.object({
      value: z.union([z.number(), z.string()]).optional(),
      discountType: DiscountTypeSchema.optional(),
    }),
  ])
  .transform((discount) => {
    if (typeof discount === 'object') {
      return {
        value: Number(discount.value) || 0,
        discountType: discount.discountType || 'flat',
      };
    }
    return { value: Number(discount) || 0, discountType: 'flat' as const };
  });

export const ScannedItemSchema = z.object({
  name: z.string(),
  price: z.union([z.number(), z.string()]).transform((v) => Number(v) || 0),
  quantity: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => (v === undefined ? 1 : parseInt(String(v), 10) || 1)),
  discount: ScannedDiscountSchema.optional(),
});
export type ScannedItem = z.infer<typeof ScannedItemSchema>;

export const ReceiptScanResponseSchema = z.object({
  items: z.array(ScannedItemSchema),
  tax: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => (v === undefined ? undefined : Number(v) || 0)),
});
export type ReceiptScanResponse = z.infer<typeof ReceiptScanResponseSchema>;
