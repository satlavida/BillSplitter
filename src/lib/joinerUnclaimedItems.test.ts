import { isItemUnclaimedByMe, getMyUnclaimedItemCount } from './joinerUnclaimedItems';
import type { LiveItem, LiveBill } from '../schemas/live.schema';

function makeItem(overrides: Partial<LiveItem>): LiveItem {
  return {
    id: 'item1',
    name: 'Pizza',
    price: 10,
    quantity: 1,
    discount: 0,
    discountType: 'flat',
    splitType: 'equal',
    consumedBy: [],
    ...overrides,
  };
}

describe('isItemUnclaimedByMe', () => {
  it('flags an equal-split item nobody has claimed', () => {
    expect(isItemUnclaimedByMe(makeItem({ consumedBy: [] }), 'me')).toBe(true);
  });

  it('does not flag an equal-split item someone else already claimed', () => {
    expect(isItemUnclaimedByMe(makeItem({ consumedBy: [{ personId: 'other', value: 1 }] }), 'me')).toBe(false);
  });

  it('does not flag an item I have already claimed myself', () => {
    expect(isItemUnclaimedByMe(makeItem({ consumedBy: [{ personId: 'me', value: 1 }] }), 'me')).toBe(false);
  });

  it('flags a fraction item with remaining pool I have not touched', () => {
    expect(isItemUnclaimedByMe(makeItem({ splitType: 'fraction', quantity: 10, consumedBy: [{ personId: 'other', value: 4 }] }), 'me')).toBe(true);
  });

  it('does not flag a fraction item that is already fully claimed by others', () => {
    expect(isItemUnclaimedByMe(makeItem({ splitType: 'fraction', quantity: 10, consumedBy: [{ personId: 'other', value: 10 }] }), 'me')).toBe(false);
  });
});

describe('getMyUnclaimedItemCount', () => {
  it('counts only the items unclaimed by me across a bill', () => {
    const bill: LiveBill = {
      id: 'bill1',
      title: 'Dinner',
      date: new Date().toISOString(),
      items: [
        makeItem({ id: 'a', consumedBy: [] }),
        makeItem({ id: 'b', consumedBy: [{ personId: 'me', value: 1 }] }),
        makeItem({ id: 'c', consumedBy: [{ personId: 'other', value: 1 }] }),
      ],
      taxAmount: 0,
      currency: 'USD',
      exchangeRate: null,
      exchangeRateDate: null,
      exchangeRateIsOverride: false,
      paidByPersonId: null,
      imageRefKey: null,
      imageWidth: null,
      imageHeight: null,
    };

    expect(getMyUnclaimedItemCount(bill, 'me')).toBe(1);
  });
});
