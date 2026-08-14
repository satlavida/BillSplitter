import { calculateBalances, simplifyDebts, calculateSettlement } from './settlement';
import type { Bill } from '../schemas/session.schema';
import type { Person } from '../schemas/bill.schema';

const person = (id: string, name: string): Person => ({ id, name });

// Builds a bill with a single item split equally among the given person ids.
const makeBill = (
  id: string,
  price: number,
  consumerIds: string[],
  paidByPersonId: string | null,
  overrides: Partial<Bill> = {}
): Bill => ({
  id,
  title: `Bill ${id}`,
  date: '2026-01-01T00:00:00.000Z',
  currency: 'INR',
  taxAmount: 0,
  paidByPersonId,
  receiptImage: null,
  splitStateVersion: '2.0.0',
  items: [
    {
      id: `${id}-item`,
      name: 'Item',
      price,
      quantity: 1,
      discount: 0,
      discountType: 'flat',
      splitType: 'equal',
      consumedBy: consumerIds.map((personId) => ({ personId, value: 1 })),
    },
  ],
  ...overrides,
});

const sumBalances = (balances: { amount: number }[]) => balances.reduce((sum, b) => sum + b.amount, 0);

describe('calculateBalances', () => {
  test('single bill, single payer: payer is owed by everyone else, degenerates to a per-bill summary', () => {
    const alice = person('alice', 'Alice');
    const bob = person('bob', 'Bob');
    const carol = person('carol', 'Carol');
    const people = [alice, bob, carol];

    // 90 split 3 ways = 30 each; Alice paid, so she's owed 60 (Bob's 30 + Carol's 30)
    const bills = [makeBill('b1', 90, ['alice', 'bob', 'carol'], 'alice')];

    const balances = calculateBalances(bills, people);
    const byId = Object.fromEntries(balances.map((b) => [b.personId, b.amount]));

    expect(byId.alice).toBeCloseTo(60);
    expect(byId.bob).toBeCloseTo(-30);
    expect(byId.carol).toBeCloseTo(-30);
    expect(sumBalances(balances)).toBeCloseTo(0);
  });

  test('multiple bills, same payer: balances accumulate', () => {
    const alice = person('alice', 'Alice');
    const bob = person('bob', 'Bob');
    const people = [alice, bob];

    const bills = [makeBill('b1', 20, ['alice', 'bob'], 'alice'), makeBill('b2', 40, ['alice', 'bob'], 'alice')];

    const balances = calculateBalances(bills, people);
    const byId = Object.fromEntries(balances.map((b) => [b.personId, b.amount]));

    // Alice is owed 10 from bill 1 and 20 from bill 2 = 30
    expect(byId.alice).toBeCloseTo(30);
    expect(byId.bob).toBeCloseTo(-30);
    expect(sumBalances(balances)).toBeCloseTo(0);
  });

  test('multiple bills, different payers, with overlapping people: balances net correctly', () => {
    const alice = person('alice', 'Alice');
    const bob = person('bob', 'Bob');
    const carol = person('carol', 'Carol');
    const people = [alice, bob, carol];

    const bills = [
      makeBill('b1', 90, ['alice', 'bob', 'carol'], 'alice'), // each owes 30, alice paid
      makeBill('b2', 60, ['bob', 'carol'], 'bob'), // each owes 30, bob paid (carol only involved)
    ];

    const balances = calculateBalances(bills, people);
    const byId = Object.fromEntries(balances.map((b) => [b.personId, b.amount]));

    // Alice: +60 (b1) + 0 (not in b2) = 60
    expect(byId.alice).toBeCloseTo(60);
    // Bob: -30 (b1) + 30 (b2, owed by carol) = 0
    expect(byId.bob).toBeCloseTo(0);
    // Carol: -30 (b1) -30 (b2) = -60
    expect(byId.carol).toBeCloseTo(-60);
    expect(sumBalances(balances)).toBeCloseTo(0);
  });

  test('a person absent from some bills only accrues balance from bills they are part of', () => {
    const alice = person('alice', 'Alice');
    const bob = person('bob', 'Bob');
    const dave = person('dave', 'Dave'); // not in any bill
    const people = [alice, bob, dave];

    const bills = [makeBill('b1', 50, ['alice', 'bob'], 'alice')];

    const balances = calculateBalances(bills, people);
    const byId = Object.fromEntries(balances.map((b) => [b.personId, b.amount]));

    expect(byId.dave).toBe(0);
    expect(sumBalances(balances)).toBeCloseTo(0);
  });

  test('a bill with no payer (paidByPersonId: null) contributes nothing to any balance', () => {
    const alice = person('alice', 'Alice');
    const bob = person('bob', 'Bob');
    const people = [alice, bob];

    const bills = [makeBill('b1', 100, ['alice', 'bob'], null)];

    const balances = calculateBalances(bills, people);
    balances.forEach((b) => expect(b.amount).toBe(0));
  });

  test('zero-sum invariant holds across many bills and payers', () => {
    const people = ['a', 'b', 'c', 'd'].map((id) => person(id, id));
    const bills = [
      makeBill('b1', 37.5, ['a', 'b', 'c'], 'a'),
      makeBill('b2', 123.45, ['b', 'c', 'd'], 'c'),
      makeBill('b3', 10, ['a', 'd'], 'd'),
      makeBill('b4', 99.99, ['a', 'b', 'c', 'd'], 'b'),
    ];

    const balances = calculateBalances(bills, people);
    expect(sumBalances(balances)).toBeCloseTo(0, 6);
  });

  test('rounding: fractional-cent splits still net to zero', () => {
    const alice = person('alice', 'Alice');
    const bob = person('bob', 'Bob');
    const carol = person('carol', 'Carol');
    const people = [alice, bob, carol];

    // 10 / 3 doesn't divide evenly
    const bills = [makeBill('b1', 10, ['alice', 'bob', 'carol'], 'alice')];

    const balances = calculateBalances(bills, people);
    expect(sumBalances(balances)).toBeCloseTo(0, 2);
  });
});

describe('simplifyDebts', () => {
  test('produces zero transactions when all balances are already zero', () => {
    const transactions = simplifyDebts([
      { personId: 'a', amount: 0 },
      { personId: 'b', amount: 0 },
    ]);
    expect(transactions).toEqual([]);
  });

  test('single creditor/single debtor produces one transaction', () => {
    const transactions = simplifyDebts([
      { personId: 'a', amount: 30 },
      { personId: 'b', amount: -30 },
    ]);
    expect(transactions).toEqual([{ from: 'b', to: 'a', amount: 30 }]);
  });

  test('multiple creditors/debtors settle down to zero net balance in aggregate', () => {
    const balances = [
      { personId: 'a', amount: 60 },
      { personId: 'b', amount: 0 },
      { personId: 'c', amount: -60 },
    ];
    const transactions = simplifyDebts(balances);

    // Verify the transaction set actually zeroes out every balance
    const net: Record<string, number> = { a: 0, b: 0, c: 0 };
    transactions.forEach((t) => {
      net[t.from] -= t.amount;
      net[t.to] += t.amount;
    });
    expect(net.a).toBeCloseTo(60);
    expect(net.b).toBeCloseTo(0);
    expect(net.c).toBeCloseTo(-60);
  });

  test('ignores balances within epsilon of zero', () => {
    const transactions = simplifyDebts([
      { personId: 'a', amount: 0.0000001 },
      { personId: 'b', amount: -0.0000001 },
    ]);
    expect(transactions).toEqual([]);
  });
});

describe('calculateSettlement', () => {
  test('combines balances and transactions for a multi-payer session', () => {
    const alice = person('alice', 'Alice');
    const bob = person('bob', 'Bob');
    const carol = person('carol', 'Carol');
    const people = [alice, bob, carol];

    const bills = [makeBill('b1', 90, ['alice', 'bob', 'carol'], 'alice'), makeBill('b2', 60, ['bob', 'carol'], 'bob')];

    const result = calculateSettlement(bills, people);

    expect(sumBalances(result.balances)).toBeCloseTo(0);
    // Every transaction should be a positive amount between two distinct people
    result.transactions.forEach((t) => {
      expect(t.amount).toBeGreaterThan(0);
      expect(t.from).not.toBe(t.to);
    });
  });
});
