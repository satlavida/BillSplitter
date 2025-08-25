import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Current version of bill history store
export const BILL_HISTORY_VERSION = '1.1.0';

// Function to generate 5-digit alphanumeric ID
const generateBillId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Initial state
const initialState = {
  version: BILL_HISTORY_VERSION,
  bills: [],
  currentBillId: null
};

// Create the bill history store with persistence
const useBillHistoryStore = create(
  persist(
    (set, get) => ({
      // State
      ...initialState,
      
      // Actions
      
      // Add a new bill to history
      addBill: (billData) => set((state) => {
        // Generate a unique ID
        const billId = generateBillId();
        
        // Set all existing bills to not current
        const updatedBills = state.bills.map(bill => ({
          ...bill,
          isCurrent: false
        }));
        
        // Add the new bill as current
        const newBill = {
          id: billId,
          title: billData.title || 'Untitled Bill',
          date: new Date().toISOString(),
          data: { ...billData, billId }, // Include billId in the data
          isCurrent: true,
          version: BILL_HISTORY_VERSION
        };
        
        return {
          bills: [...updatedBills, newBill],
          currentBillId: billId
        };
      }),
      
      // Save an existing bill or create a new one if it doesn't exist
      saveBill: (billData) => set((state) => {
        // Check if bill already has an ID in the history
        const existingBillId = billData.billId;
        let billId = existingBillId;
        let updatedBills = [];
        let isNewBill = false;
        
        if (!existingBillId || !state.bills.some(bill => bill.id === existingBillId)) {
          // Generate a new ID if bill doesn't have one or doesn't exist in history
          billId = generateBillId();
          isNewBill = true;
        }
        
        // Update billData with the billId (new or existing)
        const dataWithId = { ...billData, billId };
        
        if (isNewBill) {
          // This is a new bill - add it to history
          // Set all existing bills to not current
          updatedBills = state.bills.map(bill => ({
            ...bill,
            isCurrent: false
          }));
          
          // Add the new bill
          const newBill = {
            id: billId,
            title: billData.title || 'Untitled Bill',
            date: new Date().toISOString(),
            data: dataWithId,
            isCurrent: true,
            version: BILL_HISTORY_VERSION
          };
          
          updatedBills = [...updatedBills, newBill];
        } else {
          // This is an existing bill - update it
          updatedBills = state.bills.map(bill => {
            if (bill.id === billId) {
              // Update the existing bill
              return {
                ...bill,
                title: billData.title || bill.title,
                date: new Date().toISOString(), // Update the date to now
                data: dataWithId,
                isCurrent: true,
              };
            }
            return {
              ...bill,
              isCurrent: false // Set all other bills to not current
            };
          });
        }
        
        return {
          bills: updatedBills,
          currentBillId: billId
        };
      }),
      
      // Delete a bill from history
      deleteBill: (billId) => set((state) => {
        const newBills = state.bills.filter(bill => bill.id !== billId);
        
        // If we deleted the current bill, set currentBillId to null
        const currentBillId = state.currentBillId === billId
          ? null
          : state.currentBillId;
          
        return {
          bills: newBills,
          currentBillId
        };
      }),
      
      // Set a bill as the current bill
      setCurrentBill: (billId) => set((state) => {
        // Set all bills to not current, then set the selected one as current
        const updatedBills = state.bills.map(bill => ({
          ...bill,
          isCurrent: bill.id === billId
        }));
        
        return {
          bills: updatedBills,
          currentBillId: billId
        };
      }),
      
      // Get the current bill data
      getCurrentBill: () => {
        const state = get();
        return state.bills.find(bill => bill.id === state.currentBillId);
      },
      
      // Export all bills to JSON
      exportBills: () => {
        const state = get();
        return JSON.stringify({
          version: BILL_HISTORY_VERSION,
          bills: state.bills,
          exportDate: new Date().toISOString()
        });
      },
      
      // Import bills from JSON
      importBills: (jsonString) => {
        try {
          const imported = JSON.parse(jsonString);
          
          // Basic validation
          if (!imported.bills || !Array.isArray(imported.bills)) {
            throw new Error('Invalid bill data format');
          }
          
          set((state) => {
            // Keep existing bills and add new ones, avoiding duplicates by ID
            const existingIds = new Set(state.bills.map(bill => bill.id));
            const newBills = imported.bills.filter(bill => !existingIds.has(bill.id));
            
            return {
              bills: [...state.bills, ...newBills],
              // Keep current bill ID as is
            };
          });
          
          return { success: true };
        } catch (error) {
          console.error('Failed to import bills:', error);
          return { success: false, error: error.message };
        }
      },
      
      // Clear all bill history
      clearHistory: () => set(initialState),
    }),
    {
      name: 'billHistory', // Name for persistence
    }
  )
);

export default useBillHistoryStore;