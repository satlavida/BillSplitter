import { BillHistoryEntrySchema, BillHistoryStateSchema } from './billHistory.schema';

const makeEntry = (overrides = {}) => ({
  id: 'AB12D',
  title: 'Dinner',
  date: '2026-01-01T00:00:00.000Z',
  data: {
    version: '1.1.0',
    billId: 'AB12D',
    step: 4,
    people: [{ id: 'p1', name: 'Alice' }],
    items: [
      {
        id: 'i1',
        name: 'Pizza',
        price: 10,
        quantity: 1,
        consumedBy: ['p1'],
        splitType: 'equal',
      },
    ],
    taxAmount: 1,
    currency: 'INR',
    title: 'Dinner',
  },
  isCurrent: true,
  version: '1.1.0',
  ...overrides,
});

describe('BillHistoryEntrySchema', () => {
  test('parses a well-formed history entry, normalizing legacy consumedBy inside data', () => {
    const entry = BillHistoryEntrySchema.parse(makeEntry());
    expect(entry.data.items[0].consumedBy).toEqual([{ personId: 'p1', value: 1 }]);
  });

  test('defaults isCurrent and title when missing (old persisted entry)', () => {
    const raw = makeEntry();
    // @ts-expect-error deliberately testing a partial legacy shape
    delete raw.isCurrent;
    const entry = BillHistoryEntrySchema.parse(raw);
    expect(entry.isCurrent).toBe(false);
  });
});

describe('BillHistoryStateSchema', () => {
  test('parses a full history blob with multiple entries', () => {
    const state = BillHistoryStateSchema.parse({
      version: '1.1.0',
      bills: [makeEntry({ id: 'A' }), makeEntry({ id: 'B', isCurrent: false })],
      currentBillId: 'A',
    });
    expect(state.bills).toHaveLength(2);
  });

  test('falls back to empty bills/null currentBillId for a malformed/missing blob', () => {
    const result = BillHistoryStateSchema.safeParse({ version: '1.0.0' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bills).toEqual([]);
      expect(result.data.currentBillId).toBeNull();
    }
  });

  test('rejects when a bill entry is fundamentally corrupt (missing data)', () => {
    const result = BillHistoryStateSchema.safeParse({
      version: '1.0.0',
      bills: [{ id: 'A', title: 'x', date: 'x', isCurrent: true, version: '1.0.0' }],
    });
    expect(result.success).toBe(false);
  });
});
