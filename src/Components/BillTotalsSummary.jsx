import React, { memo } from 'react';

// Reusable component for displaying bill totals
const BillTotalsSummary = memo(({ 
  subtotal, 
  taxAmount, 
  grandTotal, 
  className = '', 
  formatCurrency 
}) => {
  
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
      <div className="flex justify-between items-center font-bold text-lg pt-2 border-t border-zinc-200 dark:border-zinc-600 px-2 py-1 bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100 print:bg-green-800 print:text-white rounded transition-colors">
        <span>Grand Total:</span>
        <span>
          {formatCurrency(grandTotal)}
        </span>
      </div>
    </div>
  );
});

export default BillTotalsSummary;