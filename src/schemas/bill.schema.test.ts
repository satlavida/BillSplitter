import {
  ConsumedByEntrySchema,
  ItemSchema,
  BillStateSchema,
} from './bill.schema';

describe('ConsumedByEntrySchema', () => {
  test('normalizes a legacy bare personId string into {personId, value:1}', () => {
    const result = ConsumedByEntrySchema.parse('person-123');
    expect(result).toEqual({ personId: 'person-123', value: 1 });
  });

  test('passes through the current object shape unchanged', () => {
    const result = ConsumedByEntrySchema.parse({ personId: 'person-1', value: 33.3 });
    expect(result).toEqual({ personId: 'person-1', value: 33.3 });
  });

  test('rejects a malformed entry', () => {
    expect(ConsumedByEntrySchema.safeParse({ personId: 'p1' }).success).toBe(false);
    expect(ConsumedByEntrySchema.safeParse(42).success).toBe(false);
  });
});

describe('ItemSchema', () => {
  test('normalizes a mixed legacy/current consumedBy array', () => {
    const item = ItemSchema.parse({
      id: 'i1',
      name: 'Pizza',
      price: 10,
      consumedBy: ['p1', { personId: 'p2', value: 2 }],
    });
    expect(item.consumedBy).toEqual([
      { personId: 'p1', value: 1 },
      { personId: 'p2', value: 2 },
    ]);
    // defaults applied
    expect(item.quantity).toBe(1);
    expect(item.discount).toBe(0);
    expect(item.discountType).toBe('flat');
    expect(item.splitType).toBe('equal');
  });

  test('accepts a negative price (discount/refund line items)', () => {
    expect(
      ItemSchema.safeParse({ id: 'i1', name: 'Pizza', price: -5 }).success
    ).toBe(true);
  });
});

describe('BillStateSchema', () => {
  test('parses a full, well-formed bill snapshot', () => {
    const state = BillStateSchema.parse({
      version: '1.1.0',
      billId: null,
      step: 2,
      people: [{ id: 'p1', name: 'Alice' }],
      items: [
        {
          id: 'i1',
          name: 'Pizza',
          price: 10,
          quantity: 1,
          consumedBy: [{ personId: 'p1', value: 1 }],
          splitType: 'equal',
        },
      ],
      taxAmount: 5,
      currency: 'INR',
      title: 'Dinner',
    });
    expect(state.people).toHaveLength(1);
    expect(state.items[0].consumedBy).toHaveLength(1);
  });

  test('falls back to defaults for missing optional fields (old persisted blob)', () => {
    const result = BillStateSchema.safeParse({ version: '1.0.0' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.people).toEqual([]);
      expect(result.data.items).toEqual([]);
      expect(result.data.step).toBe(1);
      expect(result.data.currency).toBe('INR');
    }
  });

  test('rejects a step outside the valid 1-4 range', () => {
    expect(
      BillStateSchema.safeParse({ version: '1.0.0', step: 7 }).success
    ).toBe(false);
  });
});
