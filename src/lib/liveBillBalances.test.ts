import { calculateLiveBillBalances } from './liveBillBalances';
import { calculateBillBalances } from './settlement';
import type { LiveBill } from '../schemas/live.schema';

const people = [
  { id: 'alice', name: 'Alice' },
  { id: 'bob', name: 'Bob' },
];

const liveBill = (overrides: Partial<LiveBill> = {}): LiveBill => ({
  id: 'b1',
  title: 'Dinner',
  date: '2026-01-01T00:00:00.000Z',
  currency: 'USD',
  exchangeRate: null,
  exchangeRateDate: null,
  exchangeRateIsOverride: false,
  taxAmount: 0,
  paidByPersonId: 'alice',
  imageRefKey: null,
  imageWidth: null,
  imageHeight: null,
  items: [
    {
      id: 'item-1',
      name: 'Pasta',
      price: 20,
      quantity: 1,
      discount: 0,
      discountType: 'flat',
      splitType: 'equal',
      consumedBy: [
        { personId: 'alice', value: 1 },
        { personId: 'bob', value: 1 },
      ],
    },
  ],
  ...overrides,
});

describe('calculateLiveBillBalances', () => {
  test('matches calculateBillBalances for an equivalent narrowly-typed bill', () => {
    const bill = liveBill();
    const live = calculateLiveBillBalances(bill, people);
    const strict = calculateBillBalances({ items: bill.items as never, taxAmount: bill.taxAmount, paidByPersonId: bill.paidByPersonId }, people);
    expect(live).toEqual(strict);
  });

  test('falls back to equal/flat for an unrecognized splitType/discountType string', () => {
    const bill = liveBill({
      items: [
        {
          id: 'item-1',
          name: 'Pasta',
          price: 20,
          quantity: 1,
          discount: 0,
          discountType: 'weird',
          splitType: 'weird',
          consumedBy: [
            { personId: 'alice', value: 1 },
            { personId: 'bob', value: 1 },
          ],
        },
      ],
    });

    const balances = calculateLiveBillBalances(bill, people);
    const alice = balances.find((b) => b.personId === 'alice')!;
    const bob = balances.find((b) => b.personId === 'bob')!;
    // Falls back to equal split: 20 / 2 = 10 each; Alice paid, so she's owed Bob's 10.
    expect(alice.amount).toBeCloseTo(10);
    expect(bob.amount).toBeCloseTo(-10);
  });
});
