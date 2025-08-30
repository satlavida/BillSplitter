import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/shallow';
import createIndexedDBStorage from './storage/indexedDBStorage';

// Default to USD if locale detection fails
const DEFAULT_CURRENCY = 'USD';

// Try to detect user's locale currency
const detectCurrency = () => {
  try {
    return Intl.NumberFormat().resolvedOptions().currency || DEFAULT_CURRENCY;
  } catch (error) {
    console.error('Failed to detect locale currency:', error);
    return DEFAULT_CURRENCY;
  }
};

export const CURRENCY_STORE_VERSION = '1.2.0';

// Create the currency store with persistence
const useCurrencyStore = create(
  persist(
    (set, get) => ({
      version: CURRENCY_STORE_VERSION,
      currency: detectCurrency(),
      
      // Format a number as currency
      formatCurrency: (amount) => {
        if (amount === null || amount === undefined || isNaN(amount)) {
          return '';
        }
        
        try {
          return new Intl.NumberFormat(navigator.language || 'en-US', {
            style: 'currency',
            currency: get().currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }).format(amount);
        } catch (error) {
          console.error('Currency formatting error:', error);
          // Fallback formatting
          return `${amount.toFixed(2)}`;
        }
      },
      
      // Allow manual currency selection
      changeCurrency: (newCurrency) => set({ currency: newCurrency }),
    }),
    {
      name: 'billSplitterCurrency',
      version: 2,
      storage: createJSONStorage(() => createIndexedDBStorage()),
      migrate: (persistedState, version) => {
        if (!persistedState) return { version: CURRENCY_STORE_VERSION, currency: detectCurrency() };
        if (version < 2) {
          return { ...persistedState, version: CURRENCY_STORE_VERSION };
        }
        return persistedState;
      }
    }
  )
);

// Utility hook to get formatCurrency with stable reference
export const useFormatCurrency = () => {
  // This is the correct way to use useShallow with a selector
  return useCurrencyStore(
    useShallow(state => state.formatCurrency)
  );
};

export default useCurrencyStore;