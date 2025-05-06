import { memo, useCallback } from 'react';
import useBillStore, { useBillPersonTotals } from '../billStore';
import useBillHistoryStore from '../billHistoryStore';
import { useFormatCurrency } from '../currencyStore';
import { useShallow } from 'zustand/shallow';
import { Button, Card, PrintButton, PrintWrapper } from '../ui/components';
import BillTotalsSummary from './BillTotalsSummary';
import BillHistoryButton from './BillHistory/BillHistoryButton';

// BillTitle component for displaying the title in summary view
const BillTitle = memo(({ title }) => {
  if (!title) return null;
  
  return (
    <div className="mb-4 text-center">
      <h1 className="text-2xl font-bold text-zinc-800 dark:text-white transition-colors">
        {title}
      </h1>
    </div>
  );
});

// PersonItemRow component for individual item rows
const PersonItemRow = memo(({ item, formatCurrency }) => {
  return (
    <li className="flex justify-between items-start py-2">
      <div>
        <span className="dark:text-white transition-colors">{item.name}</span>
        {item.sharedWith > 1 && (
          <span className="text-sm text-zinc-600 dark:text-zinc-400 block transition-colors">
            Split by {item.sharedWith}
          </span>
        )}
      </div>
      <span className="font-medium dark:text-white transition-colors">{formatCurrency(item.share)}</span>
    </li>
  );
});

// PersonCard component for each person's summary
const PersonCard = memo(({ person, formatCurrency }) => {
  return (
    <Card>
      <h3 className="text-lg font-bold mb-3 pb-2 border-b border-zinc-100 dark:border-zinc-700 text-zinc-800 dark:text-white transition-colors">
        {person.name}
      </h3>
      
      {person.items.length > 0 ? (
        <>
          <ul className="mb-4 space-y-1 divide-y divide-zinc-100 dark:divide-zinc-700 transition-colors">
            {person.items.map(item => (
              <PersonItemRow
                key={item.id}
                item={item}
                formatCurrency={formatCurrency}
              />
            ))}
          </ul>
          
          <div className="border-t border-zinc-100 dark:border-zinc-700 pt-3 space-y-1 transition-colors">
            <div className="flex justify-between">
              <span className="text-zinc-700 dark:text-zinc-300 transition-colors">Subtotal:</span>
              <span className="text-zinc-700 dark:text-zinc-300 transition-colors">{formatCurrency(person.subtotal)}</span>
            </div>
            
            {person.tax > 0 && (
              <div className="flex justify-between">
                <span className="text-zinc-700 dark:text-zinc-300 transition-colors">Tax:</span>
                <span className="text-zinc-700 dark:text-zinc-300 transition-colors">{formatCurrency(person.tax)}</span>
              </div>
            )}
            
            <div className="flex justify-between font-bold text-lg pt-1">
              <span className="text-zinc-900 dark:text-white transition-colors">Total:</span>
              <span className="text-zinc-900 dark:text-white transition-colors">{formatCurrency(person.total)}</span>
            </div>
          </div>
        </>
      ) : (
        <p className="text-zinc-500 dark:text-zinc-400 transition-colors">No items assigned</p>
      )}
    </Card>
  );
});

// EditButtons component for navigation
const EditButtons = memo(({ onEdit }) => {
  return (
    <div className="space-x-4 space-y-4 mb-4 no-print">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onEdit(1)}
      >
        Edit People
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onEdit(2)}
      >
        Edit Items
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onEdit(3)}
      >
        Edit Assignments
      </Button>
    </div>
  );
});

// Main BillSummary component
const BillSummary = () => {
  // Use Zustand store with useShallow to prevent unnecessary re-renders
  const { title, taxAmount, goToStep, reset, exportBill } = useBillStore(
    useShallow(state => ({
      title: state.title,
      taxAmount: state.taxAmount,
      goToStep: state.goToStep,
      reset: state.reset,
      exportBill: state.exportBill
    }))
  );
  
  // Get bill history actions
  const { addBill } = useBillHistoryStore(
    useShallow(state => ({
      addBill: state.addBill
    }))
  );
  
  const formatCurrency = useFormatCurrency();
  
  // Get person totals using the specialized hook
  const personTotals = useBillPersonTotals();
  
  // Calculate subtotal from person totals
  const subtotal = personTotals.reduce((sum, person) => sum + person.subtotal, 0);
  
  // Calculate grand total from person totals
  const grandTotal = personTotals.reduce((sum, person) => sum + person.total, 0);
  
  const handleEdit = useCallback((step) => {
    goToStep(step);
  }, [goToStep]);
  
  const handleReset = useCallback(() => {
    const confirm = window.confirm('Are you sure you want to start over? This will save the current bill to history and reset everything.');
    if (confirm) {
      // Add current bill to history
      const billData = useBillStore.getState();
      addBill(billData);
      
      // Reset current bill state
      reset();
    }
  }, [reset, addBill]);
  
  const handlePrint = useCallback(() => {
    window.print();
  }, []);
  
  const handleExportJson = useCallback(() => {
    const jsonData = exportBill();
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create temporary link and trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = `bill-${title || 'untitled'}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  }, [exportBill, title]);
  
  const handleSaveBill = useCallback(() => {
    // Add current bill to history
    const billData = useBillStore.getState();
    addBill(billData);
    
    // Show confirmation
    alert('Bill saved to history successfully!');
  }, [addBill]);
  
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 text-zinc-800 dark:text-white transition-colors">Bill Summary</h2>
      
      <PrintWrapper>
        <div id="printable-bill">
          {/* Display bill title in printable section */}
          <BillTitle title={title} />
          
          {personTotals.map(person => (
            <PersonCard 
              key={person.id}
              person={person}
              formatCurrency={formatCurrency}
            />
          ))}
          
          <BillTotalsSummary 
            subtotal={subtotal}
            taxAmount={parseFloat(taxAmount) || 0}
            grandTotal={grandTotal}
            formatCurrency={formatCurrency}
            className="mb-6"
          />
        </div>
      </PrintWrapper>
      
      <div className="flex flex-wrap justify-between items-center no-print">
        <EditButtons onEdit={handleEdit} />
        
        <div className="space-x-2 mb-4 flex flex-wrap gap-2">
          <PrintButton onClick={handlePrint} />
          
          <Button
            variant="success"
            onClick={handleSaveBill}
          >
            Save Bill
          </Button>
          
          <Button
            variant="secondary"
            onClick={handleExportJson}
          >
            Export JSON
          </Button>
          
          <BillHistoryButton />
          
          <Button
            variant="danger"
            onClick={handleReset}
          >
            Start Over
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BillSummary;