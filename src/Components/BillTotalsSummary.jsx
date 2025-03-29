import React, { memo } from 'react';
import { useFormatCurrency } from '../currencyStore';

// Reusable component for displaying bill totals
const BillTotalsSummary = memo(({ 
  subtotal, 
  taxAmount, 
  grandTotal, 
  className = '' 
}) => {
  const formatCurrency = useFormatCurrency();
  
  return (
    <div className={`p-4 bg-zinc-50 dark:bg-zinc-700 rounded-lg border border-zinc-200 dark:border-zinc-600 transition-colors ${className}`}>
      <div className="flex justify-between items-center mb-2">
        <span className="font-medium text-zinc-800 dark:text-white transition-colors">Items Subtotal:</span>
        <span className="text-zinc-800 dark:text-white transition-colors">
          {formatCurrency(subtotal)}
        </span>
      </div>
      <div className="flex justify-between items-center mb-2">
        <span className="font-medium text-zinc-800 dark:text-white transition-colors">Tax Amount:</span>
        <span className="text-zinc-800 dark:text-white transition-colors">
          {formatCurrency(taxAmount)}
        </span>
      </div>
      <div className="flex justify-between items-center font-bold text-lg pt-2 border-t border-zinc-200 dark:border-zinc-600">
        <span className="text-zinc-900 dark:text-white transition-colors">Grand Total:</span>
        <span className="text-zinc-900 dark:text-white transition-colors">
          {formatCurrency(grandTotal)}
        </span>
      </div>
    </div>
  );
});

export default BillTotalsSummary;