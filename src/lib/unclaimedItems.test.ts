import { isItemIncomplete, getIncompleteItems, getUnclaimedItemCount } from './unclaimedItems';
import type { Item } from '../schemas/bill.schema';
import type { Bill } from '../schemas/session.schema';

function makeItem(overrides: Partial<Item>): Item {
  return {
    id: 'item1',
    name: 'Pizza',
    price: 10,
    quantity: 1,
    discount: 0,
    discountType: 'flat',
    consumedBy: [],
    splitType: 'equal',
    ...overrides,
  };
}

function makeBill(items: Item[]): Bill {
  return {
    id: 'bill1',
    title: 'Dinner',
    date: new Date().toISOString(),
    items,
    taxAmount: 0,
    currency: 'USD',
    exchangeRate: null,
    exchangeRateDate: null,
    exchangeRateIsOverride: false,
    paidByPersonId: null,
    receiptImage: null,
    splitStateVersion: '2.0.0',
    scanStatus: 'idle',
    scanError: null,
  };
}

describe('isItemIncomplete', () => {
  it('flags an equal-split item nobody has claimed', () => {
    expect(isItemIncomplete(makeItem({ splitType: 'equal', consumedBy: [] }))).toBe(true);
  });

  it('does not flag an equal-split item once anyone has claimed it', () => {
    expect(isItemIncomplete(makeItem({ splitType: 'equal', consumedBy: [{ personId: 'p1', value: 1 }] }))).toBe(false);
  });

  it('flags a fraction-split item whose claimed total falls short of quantity', () => {
    expect(isItemIncomplete(makeItem({ splitType: 'fraction', quantity: 10, consumedBy: [{ personId: 'p1', value: 6 }] }))).toBe(true);
  });

  it('does not flag a fraction-split item whose claimed total matches quantity', () => {
    expect(
      isItemIncomplete(
        makeItem({
          splitType: 'fraction',
          quantity: 10,
          consumedBy: [
            { personId: 'p1', value: 6 },
            { personId: 'p2', value: 4 },
          ],
        })
      )
    ).toBe(false);
  });

  it('flags a percentage-split item whose shares do not add up to 100%', () => {
    expect(
      isItemIncomplete(
        makeItem({
          splitType: 'percentage',
          consumedBy: [
            { personId: 'p1', value: 40 },
            { personId: 'p2', value: 40 },
          ],
        })
      )
    ).toBe(true);
  });

  it('does not flag a percentage-split item whose shares add up to 100%', () => {
    expect(
      isItemIncomplete(
        makeItem({
          splitType: 'percentage',
          consumedBy: [
            { personId: 'p1', value: 60 },
            { personId: 'p2', value: 40 },
          ],
        })
      )
    ).toBe(false);
  });
});

describe('getIncompleteItems / getUnclaimedItemCount', () => {
  it('collects only the incomplete items in a bill', () => {
    const complete = makeItem({ id: 'a', consumedBy: [{ personId: 'p1', value: 1 }] });
    const incomplete = makeItem({ id: 'b', consumedBy: [] });
    const bill = makeBill([complete, incomplete]);

    expect(getIncompleteItems(bill)).toEqual([incomplete]);
    expect(getUnclaimedItemCount(bill)).toBe(1);
  });

  it('returns 0 for a fully-claimed bill', () => {
    const bill = makeBill([makeItem({ consumedBy: [{ personId: 'p1', value: 1 }] })]);
    expect(getUnclaimedItemCount(bill)).toBe(0);
  });
});
