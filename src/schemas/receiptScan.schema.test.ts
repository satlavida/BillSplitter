import { ReceiptScanResponseSchema, ScannedItemSchema } from './receiptScan.schema';

describe('ScannedItemSchema', () => {
  test('accepts a flat numeric discount', () => {
    const item = ScannedItemSchema.parse({
      name: 'Burger',
      price: 12,
      quantity: 2,
      discount: 3,
    });
    expect(item.discount).toEqual({ value: 3, discountType: 'flat' });
  });

  test('accepts a structured {value, discountType} discount object', () => {
    const item = ScannedItemSchema.parse({
      name: 'Burger',
      price: 12,
      discount: { value: 10, discountType: 'percentage' },
    });
    expect(item.discount).toEqual({ value: 10, discountType: 'percentage' });
  });

  test('defaults quantity to 1 when omitted', () => {
    const item = ScannedItemSchema.parse({ name: 'Fries', price: 4 });
    expect(item.quantity).toBe(1);
  });

  test('coerces string price/quantity from the worker response', () => {
    const item = ScannedItemSchema.parse({ name: 'Soda', price: '2.5', quantity: '3' });
    expect(item.price).toBe(2.5);
    expect(item.quantity).toBe(3);
  });
});

describe('ReceiptScanResponseSchema', () => {
  test('parses a well-formed worker response', () => {
    const parsed = ReceiptScanResponseSchema.parse({
      items: [{ name: 'Pizza', price: 10, quantity: 1 }],
      tax: 2.5,
    });
    expect(parsed.items).toHaveLength(1);
    expect(parsed.tax).toBe(2.5);
  });

  test('tax is optional', () => {
    const parsed = ReceiptScanResponseSchema.parse({ items: [] });
    expect(parsed.tax).toBeUndefined();
  });

  test('rejects a malformed response missing the items array', () => {
    const result = ReceiptScanResponseSchema.safeParse({ tax: 5 });
    expect(result.success).toBe(false);
  });

  test('rejects a response where items is not an array', () => {
    const result = ReceiptScanResponseSchema.safeParse({ items: 'not-an-array' });
    expect(result.success).toBe(false);
  });

  test('rejects an item missing a required field (name)', () => {
    const result = ReceiptScanResponseSchema.safeParse({
      items: [{ price: 10 }],
    });
    expect(result.success).toBe(false);
  });

  test('parses restaurant_name and date when the model provides them', () => {
    const parsed = ReceiptScanResponseSchema.parse({
      items: [],
      restaurant_name: 'Pizza Hut',
      date: '2025-03-20',
    });
    expect(parsed.restaurant_name).toBe('Pizza Hut');
    expect(parsed.date).toBe('2025-03-20');
  });

  test('restaurant_name and date are optional', () => {
    const parsed = ReceiptScanResponseSchema.parse({ items: [] });
    expect(parsed.restaurant_name).toBeUndefined();
    expect(parsed.date).toBeUndefined();
  });
});
