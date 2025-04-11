import { memo, useCallback } from 'react';
import useBillStore, { useBillPersonTotals } from '../billStore';
import { useFormatCurrency } from '../currencyStore';
import { useShallow } from 'zustand/shallow';
import { Button, Card, PrintButton, PrintWrapper } from '../ui/components';
import BillTotalsSummary from './BillTotalsSummary';

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
    <div className="space-x-2 mb-4 no-print">
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
  const { title, taxAmount, goToStep, reset } = useBillStore(
    useShallow(state => ({
      title: state.title,
      taxAmount: state.taxAmount,
      goToStep: state.goToStep,
      reset: state.reset
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
    const confirm = window.confirm('Are you sure you want to start over? This will reset everything.');
    if (confirm) {
      reset();
    }
  }, [reset]);
  
  const handlePrint = useCallback(() => {
    window.print();
  }, []);
  
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
      
      <div className="flex flex-wrap justify-between no-print">
        <EditButtons onEdit={handleEdit} />
        
        <div className="space-x-4 flex justify-between">
          <PrintButton onClick={handlePrint} />
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