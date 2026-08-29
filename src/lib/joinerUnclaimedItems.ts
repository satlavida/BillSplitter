import type { LiveBill, LiveItem } from '../schemas/live.schema';

// Same tolerance unclaimedItems.ts/ItemAssignment.tsx use for comparing a
// fraction-split item's claimed total against its quantity.
const FRACTION_EPSILON = 1e-6;

// From one joiner's perspective: is this item something they might still
// want to claim? True only when they haven't claimed anything on it AND
// it isn't already fully spoken for by everyone else — a fraction item
// with no remaining pool, or an equal/percentage item someone else already
// claimed, isn't "for me" to act on.
export function isItemUnclaimedByMe(item: LiveItem, myPersonId: string): boolean {
  const myValue = item.consumedBy.find((c) => c.personId === myPersonId)?.value ?? 0;
  if (myValue > 0) return false;

  if (item.splitType === 'fraction') {
    const total = item.consumedBy.reduce((sum, c) => sum + c.value, 0);
    return total < item.quantity - FRACTION_EPSILON;
  }
  return item.consumedBy.length === 0;
}

export function getMyUnclaimedItemCount(bill: LiveBill, myPersonId: string): number {
  return bill.items.filter((item) => isItemUnclaimedByMe(item, myPersonId)).length;
}
