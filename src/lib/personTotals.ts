import type { Item, Person, SplitType } from '../schemas/bill.schema';

// Mirrors billStore.SPLIT_TYPES; duplicated as string literals here (rather
// than imported) to avoid a circular import between billStore.ts and this
// module, since billStore delegates its getPersonTotals() to this function.
const SPLIT_TYPES = {
  EQUAL: 'equal',
  PERCENTAGE: 'percentage',
  FRACTION: 'fraction',
} as const;

export interface PersonTotalItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  splitType: SplitType;
  allocation: number;
  share: number;
  sharedWith: number;
  discount: number;
  discountType: 'flat' | 'percentage';
}

export interface PersonTotal {
  id: string;
  name: string;
  items: PersonTotalItem[];
  subtotal: number;
  tax: number;
  total: number;
}

// Helper to apply item-level discounts (kept in sync with billStore.getDiscountedItemPrice)
export const getDiscountedItemPrice = (item: Pick<Item, 'price' | 'discount' | 'discountType'>): number => {
  const price = parseFloat(String(item.price)) || 0;
  const discount = parseFloat(String(item.discount)) || 0;
  if (item.discountType === 'percentage') {
    return price - (price * discount) / 100;
  }
  return price - discount;
};

/**
 * Pure per-person totals calculation, shared by billStore.getPersonTotals()
 * (single active bill) and settlement.ts (per bill, across a whole session).
 * Kept framework-free so it has no Zustand/store dependency.
 */
export const calculatePersonTotals = (people: Person[], items: Item[], taxAmount: number): PersonTotal[] => {
  const totals: Record<string, PersonTotal> = {};

  // Initialize totals for each person
  people.forEach((person) => {
    totals[person.id] = {
      id: person.id,
      name: person.name,
      items: [],
      subtotal: 0,
      tax: 0,
      total: 0,
    };
  });

  // Calculate each person's share for each item based on split type
  items.forEach((item) => {
    // Skip items with no consumers
    if (item.consumedBy.length === 0) return;

    const itemPrice = getDiscountedItemPrice(item);
    const totalItemPrice = itemPrice * item.quantity;

    // Calculate shares based on split type
    const shares: Record<string, number> = {};

    switch (item.splitType) {
      case SPLIT_TYPES.EQUAL:
        // Equal split - each person gets same amount
        {
          const pricePerPerson = totalItemPrice / item.consumedBy.length;
          item.consumedBy.forEach((allocation) => {
            shares[allocation.personId] = pricePerPerson;
          });
        }
        break;

      case SPLIT_TYPES.PERCENTAGE:
        // Percentage split - calculate based on percentage values
        {
          const totalPercentage = item.consumedBy.reduce((sum, allocation) => sum + allocation.value, 0);
          item.consumedBy.forEach((allocation) => {
            const normalizedPercentage = allocation.value / totalPercentage;
            shares[allocation.personId] = totalItemPrice * normalizedPercentage;
          });
        }
        break;

      case SPLIT_TYPES.FRACTION:
        // Fractional split - calculate based on fraction values
        {
          const totalFraction = item.consumedBy.reduce((sum, allocation) => sum + allocation.value, 0);
          item.consumedBy.forEach((allocation) => {
            shares[allocation.personId] = totalItemPrice * (allocation.value / totalFraction);
          });
        }
        break;

      default:
        // Fall back to equal split if type not recognized
        {
          const pricePerPerson = totalItemPrice / item.consumedBy.length;
          item.consumedBy.forEach((allocation) => {
            shares[allocation.personId] = pricePerPerson;
          });
        }
    }

    // Add item shares to person totals
    item.consumedBy.forEach((allocation) => {
      const personId = allocation.personId;
      const share = shares[personId];

      if (totals[personId] && share !== undefined) {
        totals[personId].items.push({
          id: item.id,
          name: item.name,
          price: itemPrice,
          quantity: item.quantity,
          splitType: item.splitType,
          allocation: allocation.value,
          share: share,
          sharedWith: item.consumedBy.length,
          discount: item.discount,
          discountType: item.discountType,
        });

        totals[personId].subtotal += share;
      }
    });
  });

  // Calculate tax proportionally
  if (taxAmount > 0) {
    const totalBeforeTax = Object.values(totals).reduce((sum, person) => sum + person.subtotal, 0);

    if (totalBeforeTax > 0) {
      Object.values(totals).forEach((person) => {
        person.tax = (person.subtotal / totalBeforeTax) * taxAmount;
        person.total = person.subtotal + person.tax;
      });
    }
  } else {
    Object.values(totals).forEach((person) => {
      person.total = person.subtotal;
    });
  }

  return Object.values(totals);
};
