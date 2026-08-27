import { create } from 'zustand';
import { useEffect } from 'react';
import { useShallow } from 'zustand/shallow';
import { BillStateSchema, type Item, type Person } from './schemas/bill.schema';
import { calculatePersonTotals, getDiscountedItemPrice, type PersonTotal, type PersonTotalItem } from './lib/personTotals';
import type { Bill } from './schemas/session.schema';

// Define constants for split types
export const SPLIT_TYPES = {
  EQUAL: 'equal',
  PERCENTAGE: 'percentage',
  FRACTION: 'fraction',
} as const;

export type SplitType = (typeof SPLIT_TYPES)[keyof typeof SPLIT_TYPES];

// Add version for future compatibility
export const BILL_STORE_VERSION = '1.1.0';

export interface Allocation {
  personId: string;
  value: number;
}

export type { PersonTotal, PersonTotalItem };
export { getDiscountedItemPrice };

export interface ItemSplitDetails {
  splitType: SplitType;
  allocations: Allocation[];
}

interface NewItemInput {
  name: string;
  price: number | string;
  quantity?: number | string | null;
  discount?: number | string | null;
  discountType?: 'flat' | 'percentage';
}

interface BillStoreState {
  version: string;
  billId: string | null;
  step: number;
  people: Person[];
  items: Item[];
  taxAmount: number;
  currency: string;
  title: string;
}

interface BillStoreActions {
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;

  addPerson: (name: string) => Person;
  removePerson: (id: string) => void;
  updatePerson: (id: string, name: string) => void;

  addItem: (item: NewItemInput) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, data: Partial<Item>) => void;

  setTax: (amount: number | string) => void;

  assignItemEqual: (itemId: string, peopleIds: string[]) => void;
  assignItemPercentage: (itemId: string, allocations: Allocation[]) => void;
  assignItemFraction: (itemId: string, allocations: Allocation[]) => void;
  setSplitType: (itemId: string, splitType: SplitType) => void;
  assignAllPeopleEqual: (itemId: string) => void;
  removeAllPeople: (itemId: string) => void;

  setCurrency: (currency: string) => void;
  setTitle: (title: string) => void;

  reset: () => void;
  setBillId: (billId: string | null) => void;

  exportBill: () => string;
  importBill: (data: Partial<BillStoreState>) => void;
  hydrateFromSession: (people: Person[], bill: Bill) => void;
  // Merges a live-refreshed bill's items (consumedBy from joiner claims, or
  // brand-new items a joiner added) and the session's people (a joiner who
  // picked "someone new" adds a new Person server-side — without syncing
  // this too, that joiner's name wouldn't resolve in e.g. ItemAssignment's
  // "Split between: ..." list) into this scratch editor without touching
  // step/title/etc. — unlike hydrateFromSession, which always resets step
  // to 1, so it can't be re-run on every live-sync tick without jerking the
  // creator back to the wizard's first step. billId is passed so a fetch
  // that resolves after the creator has navigated to a different bill
  // (BillEditorPage's cleanup stops new fetches but can't cancel one
  // already in flight) is a no-op rather than cross-contaminating the
  // now-open bill. See BillEditorPage.tsx's live-sync effect, the only
  // caller.
  syncItemsFromLive: (billId: string, items: Item[], people: Person[]) => void;

  getPersonTotals: () => PersonTotal[];
  getSubtotal: () => number;
  getGrandTotal: () => number;
  isItemAssigned: (itemId: string) => boolean;
  areAllItemsAssigned: () => boolean;
  getUnassignedItems: () => Item[];
  validateAllocations: (allocations: Pick<Allocation, 'value'>[] | null | undefined, splitType: string) => boolean;
  getItemSplitDetails: (itemId: string) => ItemSplitDetails | null;
  normalizeAllocations: (allocations: Allocation[], splitType: SplitType) => Allocation[];
}

type BillStore = BillStoreState & BillStoreActions;

// Initial state with enhanced structure
const initialState: BillStoreState = {
  version: BILL_STORE_VERSION,
  billId: null, // Add bill ID for history tracking
  step: 1,
  people: [],
  items: [],
  taxAmount: 0,
  currency: 'INR',
  title: '',
};

// Create the Zustand store. NOT independently persisted - this is a thin
// scratch editor for whichever bill is currently open, hydrated from
// sessionStore (the actual source of truth) via hydrateFromSession() on
// route entry, and committed back to sessionStore by the bill-editor page
// subscribing to this store's changes. See BillEditorPage.
const useBillStore = create<BillStore>()((set, get) => ({
      // State
      ...initialState,

      // Navigation actions
      nextStep: () => set((state) => ({ step: Math.min(state.step + 1, 3) })),
      prevStep: () => set((state) => ({ step: Math.max(state.step - 1, 1) })),
      goToStep: (step) => set({ step }),

      // People management
      addPerson: (name) => {
        const newPerson: Person = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // cleaner ID
          name,
        };

        set((state) => ({
          people: [...state.people, newPerson],
        }));

        return newPerson; // return the new ID immediately
      },

      removePerson: (id) =>
        set((state) => ({
          people: state.people.filter((person) => person.id !== id),
          // Also remove this person from all consumedBy arrays
          items: state.items.map((item) => ({
            ...item,
            consumedBy: item.consumedBy.filter((allocation) => allocation.personId !== id),
          })),
        })),

      updatePerson: (id, name) =>
        set((state) => ({
          people: state.people.map((person) => (person.id === id ? { ...person, name } : person)),
        })),

      // Item management with enhanced consumedBy structure
      addItem: (item) =>
        set((state) => ({
          items: [
            ...state.items,
            {
              id: Date.now().toString() + Math.random().toString(36),
              name: item.name,
              price: parseFloat(String(item.price)),
              quantity: parseInt(String(item.quantity), 10) || 1,
              discount: parseFloat(String(item.discount)) || 0,
              discountType: item.discountType || 'flat',
              consumedBy: [],
              splitType: SPLIT_TYPES.EQUAL, // default split type
            },
          ],
        })),

      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        })),

      updateItem: (id, data) =>
        set((state) => ({
          items: state.items.map((item) => (item.id === id ? { ...item, ...data } : item)),
        })),

      // Tax management
      setTax: (amount) => set({ taxAmount: parseFloat(String(amount)) || 0 }),

      // Assignment actions with split type support
      assignItemEqual: (itemId, peopleIds) =>
        set((state) => ({
          items: state.items.map((item) => {
            if (item.id === itemId) {
              // Create equal allocations for each person
              const allocations = peopleIds.map((personId) => ({
                personId,
                value: 1, // Each person gets equal share
              }));

              return {
                ...item,
                consumedBy: allocations,
                splitType: SPLIT_TYPES.EQUAL,
              };
            }
            return item;
          }),
        })),

      // New function to set percentage split
      assignItemPercentage: (itemId, allocations) =>
        set((state) => ({
          items: state.items.map((item) => {
            if (item.id === itemId) {
              // allocations should be array of {personId, value} where value is percentage
              return {
                ...item,
                consumedBy: allocations,
                splitType: SPLIT_TYPES.PERCENTAGE,
              };
            }
            return item;
          }),
        })),

      // New function to set fractional split
      assignItemFraction: (itemId, allocations) =>
        set((state) => ({
          items: state.items.map((item) => {
            if (item.id === itemId) {
              // allocations should be array of {personId, value} where value is numerator of fraction
              return {
                ...item,
                consumedBy: allocations,
                splitType: SPLIT_TYPES.FRACTION,
              };
            }
            return item;
          }),
        })),

      // Update split type for an item
      setSplitType: (itemId, splitType) =>
        set((state) => ({
          items: state.items.map((item) => {
            if (item.id === itemId) {
              // When changing split type, reset allocations for consistency
              return {
                ...item,
                splitType,
                consumedBy: [], // Reset allocations when changing split type
              };
            }
            return item;
          }),
        })),

      assignAllPeopleEqual: (itemId) =>
        set((state) => ({
          items: state.items.map((item) => {
            if (item.id === itemId) {
              // Create allocations with equal shares for all people
              const allocations = state.people.map((person) => ({
                personId: person.id,
                value: 1, // Each person gets equal share
              }));

              return {
                ...item,
                consumedBy: allocations,
                splitType: SPLIT_TYPES.EQUAL,
              };
            }
            return item;
          }),
        })),

      removeAllPeople: (itemId) =>
        set((state) => ({
          items: state.items.map((item) => (item.id === itemId ? { ...item, consumedBy: [] } : item)),
        })),

      // Other settings
      setCurrency: (currency) => set({ currency }),
      setTitle: (title) => set({ title }),

      // Reset - modified to keep version but clear billId
      reset: () => set({ ...initialState, version: BILL_STORE_VERSION, billId: null }, false),

      // Set bill ID (used when loading from history)
      setBillId: (billId) => set({ billId }),

      // Export current bill state
      exportBill: () => {
        const state = get();
        return JSON.stringify({
          version: BILL_STORE_VERSION,
          data: state,
          exportDate: new Date().toISOString(),
        });
      },

      // Import bill state
      importBill: (data) => {
        // Preserve version during import
        set({ ...data, version: BILL_STORE_VERSION });
      },

      // Business logic helpers with support for different split types
      getPersonTotals: () => {
        const state = get();
        return calculatePersonTotals(state.people, state.items, state.taxAmount);
      },

      getSubtotal: () => {
        const state = get();
        return state.items.reduce((sum, item) => sum + getDiscountedItemPrice(item) * item.quantity, 0);
      },

      getGrandTotal: () => {
        const personTotals = get().getPersonTotals();
        return personTotals.reduce((sum, person) => sum + person.total, 0);
      },

      isItemAssigned: (itemId) => {
        const state = get();
        const item = state.items.find((item) => item.id === itemId);
        return item ? item.consumedBy.length > 0 : false;
      },

      areAllItemsAssigned: () => {
        const state = get();
        return state.items.every((item) => item.consumedBy.length > 0);
      },

      getUnassignedItems: () => {
        const state = get();
        return state.items.filter((item) => item.consumedBy.length === 0);
      },

      // New utility functions for split management

      // Validates if total allocation sums to expected value
      validateAllocations: (allocations, splitType) => {
        if (!allocations || allocations.length === 0) return false;

        // For percentage split, we expect sum close to 100%
        if (splitType === SPLIT_TYPES.PERCENTAGE) {
          const sum = allocations.reduce((total, alloc) => total + alloc.value, 0);
          const anyNegative = allocations.some((alloc) => alloc.value < 0);
          if (anyNegative) return false;
          // Allow some tolerance for floating point errors
          return Math.abs(sum - 100) < 0.01;
        }

        // For other split types, any positive values are valid
        return allocations.every((alloc) => alloc.value > 0);
      },

      // Get split details for an item
      getItemSplitDetails: (itemId) => {
        const state = get();
        const item = state.items.find((item) => item.id === itemId);

        if (!item) return null;

        return {
          splitType: item.splitType,
          allocations: item.consumedBy,
        };
      },

      // Create normalized allocations (ensuring they sum to expected values)
      normalizeAllocations: (allocations, splitType) => {
        if (!allocations || allocations.length === 0) return [];

        const sum = allocations.reduce((total, alloc) => total + alloc.value, 0);

        if (splitType === SPLIT_TYPES.PERCENTAGE && sum !== 100) {
          // Normalize to ensure percentages sum to 100
          return allocations.map((alloc) => ({
            ...alloc,
            value: (alloc.value / sum) * 100,
          }));
        } else if (splitType === SPLIT_TYPES.FRACTION) {
          // For fractions, we can keep the original values
          // The actual share calculation will handle normalization
          return allocations;
        }

        return allocations;
      },

      syncItemsFromLive: (billId, items, people) => {
        set((state) => (state.billId === billId ? { items, people } : state));
      },

      // Hydrate this scratch editor from a session's shared people pool and
      // a specific bill's fields. Called by BillEditorPage on route entry.
      hydrateFromSession: (people, bill) => {
        const result = BillStateSchema.safeParse({
          version: BILL_STORE_VERSION,
          billId: bill.id,
          step: 1,
          people,
          items: bill.items,
          taxAmount: bill.taxAmount,
          currency: bill.currency,
          title: bill.title,
        });
        if (!result.success) {
          console.error('Failed to hydrate billStore from session bill, falling back to defaults:', result.error);
          set({ ...initialState, billId: bill.id });
          return;
        }
        set(result.data);
      },
    }));

// Custom selectors using useShallow to prevent infinite loops
export const useBillPersons = () => useBillStore(useShallow((state) => state.people));
export const useBillItems = () => useBillStore(useShallow((state) => state.items));
export const useBillStep = () => useBillStore((state) => state.step);
export const useBillCurrency = () => useBillStore((state) => state.currency);
export const useBillTitle = () => useBillStore((state) => state.title);
export const useBillTaxAmount = () => useBillStore((state) => state.taxAmount);

// More complex selectors with derived data
export const useBillPersonTotals = () => {
  // We create a selector for the function itself
  const getPersonTotals = useBillStore((state) => state.getPersonTotals);
  // Then call the function to get the current totals
  return getPersonTotals();
};

export const useBillSubtotal = () => {
  const getSubtotal = useBillStore((state) => state.getSubtotal);
  return getSubtotal();
};

export const useBillGrandTotal = () => {
  const getGrandTotal = useBillStore((state) => state.getGrandTotal);
  return getGrandTotal();
};

// Hook for updating document title based on bill title
export const useDocumentTitle = () => {
  const title = useBillStore((state) => state.title);

  useEffect(() => {
    if (title) {
      document.title = `Bill Splitter - ${title}`;
    } else {
      document.title = 'Bill Splitter';
    }
  }, [title]);
};

export default useBillStore;
