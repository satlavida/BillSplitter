import type { Bill } from '../schemas/session.schema';
import type { Item } from '../schemas/bill.schema';

// Same tolerance ItemAssignment.tsx's fractionCorrectness badge uses for
// comparing a fraction-split item's claimed total against its quantity —
// floating point sums should never be compared with strict equality.
const FRACTION_EPSILON = 1e-6;

// An item "needs attention" when it isn't fully spoken for yet: nobody's
// claimed an equal-split item at all, a fraction-split item's claimed
// total falls short of its quantity, or a percentage-split item's shares
// don't add up to 100%.
export function isItemIncomplete(item: Item): boolean {
  if (item.consumedBy.length === 0) return true;
  if (item.splitType === 'fraction') {
    const total = item.consumedBy.reduce((sum, c) => sum + c.value, 0);
    return total < item.quantity - FRACTION_EPSILON;
  }
  if (item.splitType === 'percentage') {
    const total = item.consumedBy.reduce((sum, c) => sum + c.value, 0);
    return Math.abs(total - 100) > FRACTION_EPSILON;
  }
  return false;
}

export function getIncompleteItems(bill: Bill): Item[] {
  return bill.items.filter(isItemIncomplete);
}

export function getUnclaimedItemCount(bill: Bill): number {
  return getIncompleteItems(bill).length;
}
