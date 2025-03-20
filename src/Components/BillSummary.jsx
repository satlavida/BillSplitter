import { useContext, useMemo, memo, useCallback } from 'react';
import { BillContext, GO_TO_STEP, RESET } from '../BillContext';
import { Button, Card, PrintButton, PrintWrapper } from '../ui/components';
import BillTotalsSummary from './BillTotalsSummary';

// BillTitle component for displaying the title in summary view
const BillTitle = ({ title }) => {
  if (!title) return null;
  
  return (
    <div className="mb-4 text-center">
      <h1 className="text-2xl font-bold text-zinc-800 dark:text-white transition-colors">
        {title}
      </h1>
    </div>
  );
};

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
  const { state, dispatch, formatCurrency } = useContext(BillContext);
  
  // Calculate subtotals and tax for each person
  const personTotals = useMemo(() => {
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
    
    // Calculate tax proportionally based on subtotals
    if (state.taxAmount > 0) {
      const totalBeforeTax = Object.values(totals).reduce((sum, person) => sum + person.subtotal, 0);
      
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
  }, [state.people, state.items, state.taxAmount]);
  
  // Calculate grand total
  const grandTotal = useMemo(() => {
    return personTotals.reduce((sum, person) => sum + person.total, 0);
  }, [personTotals]);
  
  const handleEdit = useCallback((step) => {
    dispatch({ type: GO_TO_STEP, payload: step });
  }, [dispatch]);
  
  const handleReset = useCallback(() => {
    const confirm = window.confirm('Are you sure you want to start over? This will reset everything.');
    if (confirm) {
      dispatch({ type: RESET });
    }
  }, [dispatch]);
  
  const handlePrint = useCallback(() => {
    window.print();
  }, []);
  
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 text-zinc-800 dark:text-white transition-colors">Bill Summary</h2>
      
      <PrintWrapper>
        <div id="printable-bill">
          {/* Display bill title in printable section */}
          <BillTitle title={state.title} />
          
          {personTotals.map(person => (
            <PersonCard 
              key={person.id}
              person={person}
              formatCurrency={formatCurrency}
            />
          ))}
          
          <BillTotalsSummary 
            subtotal={personTotals.reduce((sum, person) => sum + person.subtotal, 0)}
            taxAmount={parseFloat(state.taxAmount) || 0}
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