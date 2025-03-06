// Currency utility functions
import { useState, useEffect } from 'react';

// Default to USD if locale detection fails
const DEFAULT_CURRENCY = 'USD';

// Hook to get currency based on user's locale
export const useCurrencyFormat = (initialCurrency = null) => {
  const [currency, setCurrency] = useState(initialCurrency || DEFAULT_CURRENCY);
  
  useEffect(() => {
    if (!initialCurrency) {
      try {
        // Try to detect user's locale currency
        const detectedCurrency = Intl.NumberFormat().resolvedOptions().currency || DEFAULT_CURRENCY;
        setCurrency(detectedCurrency);
      } catch (error) {
        console.error('Failed to detect locale currency:', error);
        setCurrency(DEFAULT_CURRENCY);
      }
    }
  }, [initialCurrency]);
  
  // Format a number as currency
  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '';
    }
    
    try {
      return new Intl.NumberFormat(navigator.language || 'en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount);
    } catch (error) {
      console.error('Currency formatting error:', error);
      // Fallback formatting
      return `${amount.toFixed(2)}`;
    }
  };
  
  // Allow manual currency selection
  const changeCurrency = (newCurrency) => {
    setCurrency(newCurrency);
  };
  
  return { currency, formatCurrency, changeCurrency };
};