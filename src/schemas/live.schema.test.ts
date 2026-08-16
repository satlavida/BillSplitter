import { LiveJoinerSchema, LiveActivityEntrySchema, PendingClaimSchema, isFractionItemCorrect, type LiveItem } from './live.schema';

describe('LiveJoinerSchema', () => {
  test('parses without a token (the common case — already revealed, or not yet approved)', () => {
    const joiner = LiveJoinerSchema.parse({
      id: 'j1',
      name: 'Bob',
      personId: 'p1',
      status: 'approved',
      createdAt: '2026-01-01T00:00:00Z',
    });
    expect(joiner.token).toBeUndefined();
  });

  test('parses the one-time token field when present', () => {
    const joiner = LiveJoinerSchema.parse({
      id: 'j1',
      name: 'Bob',
      personId: 'p1',
      status: 'approved',
      createdAt: '2026-01-01T00:00:00Z',
      token: 'secret-token',
    });
    expect(joiner.token).toBe('secret-token');
  });
});

describe('LiveActivityEntrySchema', () => {
  test('parses a claim entry', () => {
    const entry = LiveActivityEntrySchema.parse({
      id: 1,
      itemId: 'i1',
      itemName: 'Pizza',
      personId: 'p1',
      personName: 'Bob',
      action: 'claim',
      deltaValue: 2,
      totalValue: 2,
      createdAt: '2026-01-01 00:00:00',
    });
    expect(entry.action).toBe('claim');
  });

  test('parses a reject entry (creator declining a pending claim)', () => {
    const entry = LiveActivityEntrySchema.parse({
      id: 2,
      itemId: 'i1',
      itemName: 'Pizza',
      personId: 'p1',
      personName: 'Bob',
      action: 'reject',
      deltaValue: -1,
      totalValue: 0,
      createdAt: '2026-01-01 00:00:00',
    });
    expect(entry.action).toBe('reject');
  });

  test('rejects an unknown action', () => {
    expect(
      LiveActivityEntrySchema.safeParse({
        id: 1,
        itemId: 'i1',
        itemName: 'Pizza',
        personId: 'p1',
        personName: 'Bob',
        action: 'delete',
        deltaValue: 1,
        totalValue: 1,
        createdAt: '2026-01-01 00:00:00',
      }).success
    ).toBe(false);
  });
});

describe('PendingClaimSchema', () => {
  test('parses a pending claim enriched with item/person names', () => {
    const claim = PendingClaimSchema.parse({
      id: 'c1',
      itemId: 'i1',
      itemName: 'Pizza',
      personId: 'p1',
      personName: 'Bob',
      value: 2,
      status: 'pending',
    });
    expect(claim.itemName).toBe('Pizza');
    expect(claim.personName).toBe('Bob');
  });

  test('rejects a missing itemId', () => {
    expect(
      PendingClaimSchema.safeParse({
        id: 'c1',
        itemName: 'Pizza',
        personId: 'p1',
        personName: 'Bob',
        value: 2,
        status: 'pending',
      }).success
    ).toBe(false);
  });
});

describe('isFractionItemCorrect', () => {
  const baseItem: LiveItem = {
    id: 'i1',
    name: 'Pizza',
    price: 10,
    quantity: 8,
    discount: 0,
    discountType: 'flat',
    splitType: 'fraction',
    consumedBy: [],
  };

  test('non-fraction items are always correct regardless of consumedBy total', () => {
    expect(isFractionItemCorrect({ ...baseItem, splitType: 'equal', consumedBy: [{ personId: 'p1', value: 1 }] })).toBe(true);
  });

  test('fraction item is correct when claimed parts sum exactly to quantity', () => {
    expect(
      isFractionItemCorrect({
        ...baseItem,
        consumedBy: [
          { personId: 'p1', value: 5 },
          { personId: 'p2', value: 3 },
        ],
      })
    ).toBe(true);
  });

  test('fraction item is incorrect when under-claimed', () => {
    expect(isFractionItemCorrect({ ...baseItem, consumedBy: [{ personId: 'p1', value: 5 }] })).toBe(false);
  });

  test('fraction item is incorrect when over-claimed', () => {
    expect(isFractionItemCorrect({ ...baseItem, consumedBy: [{ personId: 'p1', value: 9 }] })).toBe(false);
  });

  test('tolerates floating-point noise within epsilon', () => {
    expect(
      isFractionItemCorrect({
        ...baseItem,
        quantity: 1,
        consumedBy: [
          { personId: 'p1', value: 0.1 },
          { personId: 'p2', value: 0.2 },
          { personId: 'p3', value: 0.7000000001 },
        ],
      })
    ).toBe(true);
  });
});
