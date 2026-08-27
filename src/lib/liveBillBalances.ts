import { calculateBillBalances, type Balance } from './settlement';
import type { SplitType, DiscountType } from '../schemas/bill.schema';
import { LivePersonSchema, type LiveBill } from '../schemas/live.schema';
import type { z } from 'zod';

type LivePerson = z.infer<typeof LivePersonSchema>;

const SPLIT_TYPES: SplitType[] = ['equal', 'percentage', 'fraction'];
const DISCOUNT_TYPES: DiscountType[] = ['flat', 'percentage'];

// LiveBill/LiveItem's discountType/splitType are loosely-typed plain
// strings (server response — see live.schema.ts's comment on why it's kept
// deliberately loose), not this app's narrower literal unions, so they
// can't be passed to calculateBillBalances as-is. Narrows them here so the
// settlement math stays a single source of truth instead of being
// duplicated for live data — mirrors JoinerBillEditorPage.tsx's existing
// tolerance for this same LiveItem looseness (its own discountedPrice
// helper).
export const calculateLiveBillBalances = (liveBill: LiveBill, people: LivePerson[]): Balance[] => {
  const items = liveBill.items.map((item) => ({
    ...item,
    splitType: (SPLIT_TYPES as string[]).includes(item.splitType) ? (item.splitType as SplitType) : 'equal',
    discountType: (DISCOUNT_TYPES as string[]).includes(item.discountType) ? (item.discountType as DiscountType) : 'flat',
  }));

  return calculateBillBalances({ items, taxAmount: liveBill.taxAmount, paidByPersonId: liveBill.paidByPersonId }, people);
};
