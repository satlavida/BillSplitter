import { BillSchema, SessionSchema, SessionStoreStateSchema } from './session.schema';

describe('BillSchema', () => {
  test('applies defaults for a minimal bill', () => {
    const bill = BillSchema.parse({ id: 'b1', date: '2026-01-01T00:00:00.000Z' });
    expect(bill.title).toBe('Untitled Bill');
    expect(bill.items).toEqual([]);
    expect(bill.paidByPersonId).toBeNull();
    expect(bill.receiptImage).toBeNull();
  });

  test('normalizes legacy consumedBy inside a bill item', () => {
    const bill = BillSchema.parse({
      id: 'b1',
      date: '2026-01-01T00:00:00.000Z',
      items: [{ id: 'i1', name: 'Pizza', price: 10, consumedBy: ['p1'] }],
    });
    expect(bill.items[0].consumedBy).toEqual([{ personId: 'p1', value: 1 }]);
  });

  test('accepts a set paidByPersonId and receiptImage', () => {
    const bill = BillSchema.parse({
      id: 'b1',
      date: '2026-01-01T00:00:00.000Z',
      paidByPersonId: 'p1',
      receiptImage: { refKey: 'img-1', width: 1920, height: 1080 },
    });
    expect(bill.paidByPersonId).toBe('p1');
    expect(bill.receiptImage).toEqual({ refKey: 'img-1', width: 1920, height: 1080 });
  });
});

describe('SessionSchema', () => {
  test('applies defaults for a minimal session', () => {
    const session = SessionSchema.parse({
      id: 's1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(session.title).toBe('Untitled Session');
    expect(session.people).toEqual([]);
    expect(session.bills).toEqual([]);
    expect(session.isLive).toBe(false);
  });

  test('parses a session with a shared people pool and multiple bills', () => {
    const session = SessionSchema.parse({
      id: 's1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      people: [{ id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' }],
      bills: [
        { id: 'b1', date: '2026-01-01T00:00:00.000Z', paidByPersonId: 'p1' },
        { id: 'b2', date: '2026-01-02T00:00:00.000Z', paidByPersonId: 'p2' },
      ],
    });
    expect(session.people).toHaveLength(2);
    expect(session.bills).toHaveLength(2);
  });
});

describe('SessionStoreStateSchema', () => {
  test('falls back to empty sessions for a missing/malformed blob', () => {
    const result = SessionStoreStateSchema.safeParse({ version: '2.0.0' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sessions).toEqual([]);
      expect(result.data.currentSessionId).toBeNull();
      expect(result.data.migratedFromV1).toBe(false);
    }
  });

  test('rejects a session entry that is fundamentally corrupt', () => {
    const result = SessionStoreStateSchema.safeParse({
      version: '2.0.0',
      sessions: [{ id: 's1' }], // missing required createdAt/updatedAt
    });
    expect(result.success).toBe(false);
  });
});
