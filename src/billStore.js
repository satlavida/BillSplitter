import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useEffect } from 'react';
import { useShallow } from 'zustand/shallow';

// Initial state - same structure as the original BillContext
const initialState = {
  step: 1,
  people: [],
  items: [],
  taxAmount: 0,
  currency: 'INR',
  title: '', 
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
      addPerson: (name) => set(state => ({ 
        people: [...state.people, { id: Date.now().toString(), name }] 
      })),
      
      removePerson: (id) => set(state => ({ 
        people: state.people.filter(person => person.id !== id),
        // Also remove this person from all consumedBy arrays
        items: state.items.map(item => ({
          ...item,
          consumedBy: item.consumedBy.filter(personId => personId !== id)
        }))
      })),
      
      updatePerson: (id, name) => set(state => ({
        people: state.people.map(person => 
          person.id === id ? { ...person, name } : person
        )
      })),
      
      // Item management
      addItem: (item) => set(state => ({
        items: [...state.items, {
          id: Date.now().toString() + Math.random().toString(36),
          name: item.name,
          price: parseFloat(item.price),
          quantity: parseInt(item.quantity) || 1,
          consumedBy: []
        }]
      })),
      
      removeItem: (id) => set(state => ({
        items: state.items.filter(item => item.id !== id)
      })),
      
      updateItem: (id, data) => set(state => ({
        items: state.items.map(item => 
          item.id === id ? { ...item, ...data } : item
        )
      })),
      
      // Tax management
      setTax: (amount) => set({ taxAmount: parseFloat(amount) || 0 }),
      
      // Assignment actions
      assignItem: (itemId, peopleIds) => set(state => ({
        items: state.items.map(item => 
          item.id === itemId ? { ...item, consumedBy: peopleIds } : item
        )
      })),
      
      assignAllPeople: (itemId) => set(state => ({
        items: state.items.map(item => 
          item.id === itemId 
            ? { ...item, consumedBy: state.people.map(person => person.id) }
            : item
        )
      })),
      
      removeAllPeople: (itemId) => set(state => ({
        items: state.items.map(item => 
          item.id === itemId ? { ...item, consumedBy: [] } : item
        )
      })),
      
      // Other settings
      setCurrency: (currency) => set({ currency }),
      setTitle: (title) => set({ title }),
      
      // Reset
      reset: () => set(initialState, false), // Note: not using true for replace due to stricter types in v5
      
      // Business logic helpers
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
        
        // Calculate each person's share for each item
        state.items.forEach(item => {
          // Skip items with no consumers
          if (item.consumedBy.length === 0) return;
          
          const totalItemPrice = parseFloat(item.price) * item.quantity;
          const pricePerPerson = totalItemPrice / item.consumedBy.length;
          
          item.consumedBy.forEach(personId => {
            if (totals[personId]) {
              totals[personId].items.push({
                id: item.id,
                name: item.name,
                price: parseFloat(item.price),
                quantity: item.quantity,
                sharedWith: item.consumedBy.length,
                share: pricePerPerson
              });
              
              totals[personId].subtotal += pricePerPerson;
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
          (sum, item) => sum + (parseFloat(item.price) * item.quantity), 
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
      }
    }),
    {
      name: 'billSplitter', // Name for localStorage persistence
    }
  )
);

// Custom selectors using useShallow to prevent infinite loops
export const useBillPersons = () => useBillStore(useShallow(state => state.people));
export const useBillItems = () => useBillStore(useShallow(state => state.items));
export const useBillPersonTotals = () => {
  const getPersonTotals = useBillStore(state => state.getPersonTotals);
  // Using a stable reference to prevent infinite loops
  return useShallow(getPersonTotals)();
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