import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useEffect } from 'react';
import { useShallow } from 'zustand/shallow';
import createIndexedDBStorage from './storage/indexedDBStorage';

// Define constants for split types
export const SPLIT_TYPES = {
  EQUAL: 'equal',
  PERCENTAGE: 'percentage',
  FRACTION: 'fraction'
};

// Add version for future compatibility
export const BILL_STORE_VERSION = '1.2.0';

// Helper to apply item-level discounts
export const getDiscountedItemPrice = (item) => {
  const price = parseFloat(item.price) || 0;
  const discount = parseFloat(item.discount) || 0;
  if (item.discountType === 'percentage') {
    return price - (price * discount) / 100;
  }
  return price - discount;
};

// Initial state with enhanced structure
const initialState = {
  version: BILL_STORE_VERSION,
  billId: null, // Add bill ID for history tracking
  step: 1,
  people: [],
  items: [],
  taxAmount: 0,
  currency: 'INR',
  title: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lastSyncedAt: null,
};

// Create the Zustand store with persistence
const useBillStore = create(
  persist(
    (set, get) => ({
      // State
      ...initialState,
      
      // Navigation actions
      nextStep: () => set(state => ({ step: Math.min(state.step + 1, 4) })),
      prevStep: () => set(state => ({ step: Math.max(state.step - 1, 1) })),
      goToStep: (step) => set({ step }),
      
      // People management
      addPerson: (name) => {
        const newPerson = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // cleaner ID
          name,
        };

        set((state) => ({
          people: [...state.people, newPerson],
          updatedAt: new Date().toISOString()
        }));

        return newPerson; // return the new ID immediately
      },

      removePerson: (id) => set(state => ({
        people: state.people.filter(person => person.id !== id),
        // Also remove this person from all consumedBy arrays
        items: state.items.map(item => ({
          ...item,
          consumedBy: item.consumedBy.filter(allocation => allocation.personId !== id)
        })),
        updatedAt: new Date().toISOString()
      })),

      updatePerson: (id, name) => set(state => ({
        people: state.people.map(person =>
          person.id === id ? { ...person, name } : person
        ),
        updatedAt: new Date().toISOString()
      })),
      
      // Item management with enhanced consumedBy structure
      addItem: (item) => set(state => ({
        items: [...state.items, {
          id: Date.now().toString() + Math.random().toString(36),
          name: item.name,
          price: parseFloat(item.price),
          quantity: parseInt(item.quantity) || 1,
          discount: parseFloat(item.discount) || 0,
          discountType: item.discountType || 'flat',
          consumedBy: [],
          splitType: SPLIT_TYPES.EQUAL // default split type
        }],
        updatedAt: new Date().toISOString()
      })),
      
      removeItem: (id) => set(state => ({
        items: state.items.filter(item => item.id !== id),
        updatedAt: new Date().toISOString()
      })),
      
      updateItem: (id, data) => set(state => ({
        items: state.items.map(item =>
          item.id === id ? { ...item, ...data } : item
        ),
        updatedAt: new Date().toISOString()
      })),
      
      // Tax management
      setTax: (amount) => set({ taxAmount: parseFloat(amount) || 0, updatedAt: new Date().toISOString() }),
      
      // Assignment actions with split type support
      assignItemEqual: (itemId, peopleIds) => set(state => ({
        items: state.items.map(item => {
          if (item.id === itemId) {
            // Create equal allocations for each person
            const allocations = peopleIds.map(personId => ({
              personId,
              value: 1 // Each person gets equal share
            }));

            return {
              ...item,
              consumedBy: allocations,
              splitType: SPLIT_TYPES.EQUAL
            };
          }
          return item;
        }),
        updatedAt: new Date().toISOString()
      })),

      // New function to set percentage split
      assignItemPercentage: (itemId, allocations) => set(state => ({
        items: state.items.map(item => {
          if (item.id === itemId) {
            // allocations should be array of {personId, value} where value is percentage
            return {
              ...item,
              consumedBy: allocations,
              splitType: SPLIT_TYPES.PERCENTAGE
            };
          }
          return item;
        }),
        updatedAt: new Date().toISOString()
      })),

      // New function to set fractional split
      assignItemFraction: (itemId, allocations) => set(state => ({
        items: state.items.map(item => {
          if (item.id === itemId) {
            // allocations should be array of {personId, value} where value is numerator of fraction
            return {
              ...item,
              consumedBy: allocations,
              splitType: SPLIT_TYPES.FRACTION
            };
          }
          return item;
        }),
        updatedAt: new Date().toISOString()
      })),
      
      // Update split type for an item
      setSplitType: (itemId, splitType) => set(state => ({
        items: state.items.map(item => {
          if (item.id === itemId) {
            // When changing split type, reset allocations for consistency
            return {
              ...item,
              splitType,
              consumedBy: [] // Reset allocations when changing split type
            };
          }
          return item;
        }),
        updatedAt: new Date().toISOString()
      })),
      
      assignAllPeopleEqual: (itemId) => set(state => ({
        items: state.items.map(item => {
          if (item.id === itemId) {
            // Create allocations with equal shares for all people
            const allocations = state.people.map(person => ({
              personId: person.id,
              value: 1 // Each person gets equal share
            }));

            return {
              ...item,
              consumedBy: allocations,
              splitType: SPLIT_TYPES.EQUAL
            };
          }
          return item;
        }),
        updatedAt: new Date().toISOString()
      })),
      
      removeAllPeople: (itemId) => set(state => ({
        items: state.items.map(item =>
          item.id === itemId ? { ...item, consumedBy: [] } : item
        ),
        updatedAt: new Date().toISOString()
      })),
      
      // Other settings
      setCurrency: (currency) => set({ currency, updatedAt: new Date().toISOString() }),
      setTitle: (title) => set({ title, updatedAt: new Date().toISOString() }),
      
      // Reset - modified to keep version but clear billId
      reset: () => set({
        ...initialState,
        version: BILL_STORE_VERSION,
        billId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastSyncedAt: null
      }, false),
      
      // Set bill ID (used when loading from history)
      setBillId: (billId) => set({ billId, updatedAt: new Date().toISOString() }),
      
      // Export current bill state
      exportBill: () => {
        const state = get();
        return JSON.stringify({
          version: BILL_STORE_VERSION,
          data: state,
          exportDate: new Date().toISOString()
        });
      },
      
      // Import bill state
      importBill: (data) => {
        // Preserve version during import
        set({
          ...data,
          version: BILL_STORE_VERSION,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastSyncedAt: data.lastSyncedAt || null
        });
      },
      
      // Business logic helpers with support for different split types
      getPersonTotals: () => {
        const state = get();
        const totals = {};
        
        // Initialize totals for each person
        state.people.forEach(person => {
          totals[person.id] = {
            id: person.id,
            name: person.name,
            items: [],
            subtotal: 0,
            tax: 0,
            total: 0
          };
        });
        
        // Calculate each person's share for each item based on split type
        state.items.forEach(item => {
          // Skip items with no consumers
          if (item.consumedBy.length === 0) return;

          const itemPrice = getDiscountedItemPrice(item);
          const totalItemPrice = itemPrice * item.quantity;
          
          // Calculate shares based on split type
          let shares = {};
          
          switch (item.splitType) {
            case SPLIT_TYPES.EQUAL:
              // Equal split - each person gets same amount
              {
                const pricePerPerson = totalItemPrice / item.consumedBy.length;
                item.consumedBy.forEach(allocation => {
                  shares[allocation.personId] = pricePerPerson;
                });
              }
              break;
              
            case SPLIT_TYPES.PERCENTAGE:
              // Percentage split - calculate based on percentage values
              {
                // Calculate total percentage (should sum to 100, but handle other cases)
                const totalPercentage = item.consumedBy.reduce(
                  (sum, allocation) => sum + allocation.value, 0
                );
                
                // Calculate share for each person based on their percentage
                item.consumedBy.forEach(allocation => {
                  const normalizedPercentage = allocation.value / totalPercentage;
                  shares[allocation.personId] = totalItemPrice * normalizedPercentage;
                });
              }
              break;
              
            case SPLIT_TYPES.FRACTION:
              // Fractional split - calculate based on fraction values
              {
                // Calculate total of all fractions
                const totalFraction = item.consumedBy.reduce(
                  (sum, allocation) => sum + allocation.value, 0
                );
                
                // Calculate share for each person based on their fraction
                item.consumedBy.forEach(allocation => {
                  shares[allocation.personId] = totalItemPrice * (allocation.value / totalFraction);
                });
              }
              break;
              
            default:
              // Fall back to equal split if type not recognized
              {
                const pricePerPerson = totalItemPrice / item.consumedBy.length;
                item.consumedBy.forEach(allocation => {
                  shares[allocation.personId] = pricePerPerson;
                });
              }
          }
          
          // Add item shares to person totals
          item.consumedBy.forEach(allocation => {
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
                discountType: item.discountType
              });
              
              totals[personId].subtotal += share;
            }
          });
        });
        
        // Calculate tax proportionally
        if (state.taxAmount > 0) {
          const totalBeforeTax = Object.values(totals).reduce(
            (sum, person) => sum + person.subtotal, 0
          );
          
          if (totalBeforeTax > 0) {
            Object.values(totals).forEach(person => {
              // Proportional tax based on their share of the bill
              person.tax = (person.subtotal / totalBeforeTax) * parseFloat(state.taxAmount);
              person.total = person.subtotal + person.tax;
            });
          }
        } else {
          // No tax, so total equals subtotal
          Object.values(totals).forEach(person => {
            person.total = person.subtotal;
          });
        }
        
        return Object.values(totals);
      },
      
      getSubtotal: () => {
        const state = get();
        return state.items.reduce(
          (sum, item) => sum + (getDiscountedItemPrice(item) * item.quantity),
          0
        );
      },
      
      getGrandTotal: () => {
        const personTotals = get().getPersonTotals();
        return personTotals.reduce((sum, person) => sum + person.total, 0);
      },
      
      isItemAssigned: (itemId) => {
        const state = get();
        const item = state.items.find(item => item.id === itemId);
        return item ? item.consumedBy.length > 0 : false;
      },
      
      areAllItemsAssigned: () => {
        const state = get();
        return state.items.every(item => item.consumedBy.length > 0);
      },
      
      getUnassignedItems: () => {
        const state = get();
        return state.items.filter(item => item.consumedBy.length === 0);
      },
      
      // New utility functions for split management
      
      // Validates if total allocation sums to expected value
      validateAllocations: (allocations, splitType) => {
        if (!allocations || allocations.length === 0) return false;
        
        // For percentage split, we expect sum close to 100%
        if (splitType === SPLIT_TYPES.PERCENTAGE) {
          const sum = allocations.reduce((total, alloc) => total + alloc.value, 0);
          const anyNegative = allocations.some(alloc => alloc.value < 0);
          if(anyNegative) return false;
          // Allow some tolerance for floating point errors
          return Math.abs(sum - 100) < 0.01;
        }
        
        // For other split types, any positive values are valid
        return allocations.every(alloc => alloc.value > 0);
      },
      
      // Get split details for an item
      getItemSplitDetails: (itemId) => {
        const state = get();
        const item = state.items.find(item => item.id === itemId);
        
        if (!item) return null;
        
        return {
          splitType: item.splitType,
          allocations: item.consumedBy
        };
      },
      
      // Create normalized allocations (ensuring they sum to expected values)
      normalizeAllocations: (allocations, splitType) => {
        if (!allocations || allocations.length === 0) return [];
        
        const sum = allocations.reduce((total, alloc) => total + alloc.value, 0);
        
        if (splitType === SPLIT_TYPES.PERCENTAGE && sum !== 100) {
          // Normalize to ensure percentages sum to 100
          return allocations.map(alloc => ({
            ...alloc,
            value: (alloc.value / sum) * 100
          }));
        } else if (splitType === SPLIT_TYPES.FRACTION) {
          // For fractions, we can keep the original values
          // The actual share calculation will handle normalization
          return allocations;
        }
        
        return allocations;
      }
    }),
    {
      name: 'billSplitter',
      version: 2,
      storage: createJSONStorage(() => createIndexedDBStorage()),
      migrate: (persistedState, version) => {
        if (!persistedState) return { ...initialState };
        if (version < 2) {
          return {
            ...initialState,
            ...persistedState,
            createdAt: persistedState.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastSyncedAt: persistedState.lastSyncedAt || null,
            version: BILL_STORE_VERSION,
          };
        }
        return persistedState;
      }
    }
  )
);

// Custom selectors using useShallow to prevent infinite loops
export const useBillPersons = () => useBillStore(useShallow(state => state.people));
export const useBillItems = () => useBillStore(useShallow(state => state.items));
export const useBillStep = () => useBillStore(state => state.step);
export const useBillCurrency = () => useBillStore(state => state.currency);
export const useBillTitle = () => useBillStore(state => state.title);
export const useBillTaxAmount = () => useBillStore(state => state.taxAmount);

// More complex selectors with derived data
export const useBillPersonTotals = () => {
  // We create a selector for the function itself
  const getPersonTotals = useBillStore(state => state.getPersonTotals);
  // Then call the function to get the current totals
  return getPersonTotals();
};

export const useBillSubtotal = () => {
  const getSubtotal = useBillStore(state => state.getSubtotal);
  return getSubtotal();
};

export const useBillGrandTotal = () => {
  const getGrandTotal = useBillStore(state => state.getGrandTotal);
  return getGrandTotal();
};

// Hook for updating document title based on bill title
export const useDocumentTitle = () => {
  const title = useBillStore(state => state.title);
  
  useEffect(() => {
    if (title) {
      document.title = `Bill Splitter - ${title}`;
    } else {
      document.title = 'Bill Splitter';
    }
  }, [title]);
};

export default useBillStore;