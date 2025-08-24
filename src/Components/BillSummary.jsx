import { memo, useCallback, useState } from 'react';
import useBillStore, { useBillPersonTotals } from '../billStore';
import useBillHistoryStore from '../billHistoryStore';
import { useFormatCurrency } from '../currencyStore';
import { useShallow } from 'zustand/shallow';
import { Button, Card, PrintButton, PrintWrapper } from '../ui/components';
import BillTotalsSummary from './BillTotalsSummary';
import { useBillHistory } from './BillHistory/BillHistoryContext';

// Generate a UPI payment link
function generateUpiLink({ upiId, name, amount, note, transactionRef }) {
  let link = `upi://pay?pa=${encodeURIComponent(upiId)}&cu=INR`;
  if (name) link += `&pn=${encodeURIComponent(name)}`;
  if (amount) link += `&am=${encodeURIComponent(amount)}`;
  if (note) link += `&tn=${encodeURIComponent(note.substring(0, 80))}`;
  if (transactionRef) link += `&tr=${encodeURIComponent(transactionRef)}`;
  return link;
}

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
const PersonCard = memo(({ person, formatCurrency, upiId, billTitle }) => {
  const upiLink = upiId
    ? generateUpiLink({
        upiId,
        name: person.name,
        amount: person.total.toFixed(2),
        note: billTitle,
      })
    : null;

  const handleShare = async () => {
    const text = `${person.name} owes ${formatCurrency(person.total)}${
      billTitle ? ` for ${billTitle}` : ''
    }${upiLink ? `\nPay: ${upiLink}` : ''}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: billTitle || 'Bill Payment', text, url: upiLink || undefined });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        alert('Payment details copied to clipboard');
      }
    } catch (err) {
      // ignore
    }
  };

  return (
    <Card>
      <div className="flex justify-between items-center mb-3 pb-2 border-b border-zinc-100 dark:border-zinc-700">
        <h3 className="text-lg font-bold text-zinc-800 dark:text-white transition-colors">
          {person.name}
        </h3>
        <div className="flex items-center gap-2">
          {upiLink && (
            <a
              href={upiLink}
              className="text-blue-600 dark:text-blue-400 underline text-sm"
            >
              Pay
            </a>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={handleShare}
            className="no-print"
          >
            Share
          </Button>
        </div>
      </div>

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
  const { saveBill } = useBillHistoryStore(
    useShallow(state => ({
      saveBill: state.saveBill
    }))
  );
  
  const formatCurrency = useFormatCurrency();
  
  // Get bill history modal controls
  const { openModal } = useBillHistory();
  
  // User provided UPI ID
  const [upiId, setUpiId] = useState('');
  const [showUpiInput, setShowUpiInput] = useState(false);

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
      // Save current bill to history
      const billData = useBillStore.getState();
      saveBill(billData);
      
      // Reset current bill state
      reset();
      //Save new bill state 
      const newBillData = useBillStore.getState();
      saveBill(newBillData);
    }
  }, [reset, saveBill]);
  
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
    // Save current bill to history
    const billData = useBillStore.getState();
    saveBill(billData);
    
    // Show confirmation
    alert('Bill saved to history successfully!');
  }, [saveBill]);
  
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 text-zinc-800 dark:text-white transition-colors">Bill Summary</h2>
      <div className="mb-4">
        {showUpiInput ? (
          <div className="flex items-center gap-2 no-print">
            <input
              type="text"
              value={upiId}
              onChange={e => setUpiId(e.target.value)}
              placeholder="your-upi@bank"
              className="flex-1 p-2 border border-zinc-300 dark:border-zinc-600 rounded-md"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowUpiInput(false)}
            >
              Hide
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 no-print">
            {upiId && (
              <span className="text-zinc-800 dark:text-white">UPI ID: {upiId}</span>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowUpiInput(true)}
            >
              {upiId ? 'Edit UPI ID' : 'Add UPI ID'}
            </Button>
          </div>
        )}
      </div>

      <PrintWrapper>
        <div id="printable-bill">
          {/* Display bill title in printable section */}
          <BillTitle title={title} />

          {personTotals.map(person => (
            <PersonCard
              key={person.id}
              person={person}
              formatCurrency={formatCurrency}
              upiId={upiId}
              billTitle={title}
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
          
          <Button
            variant="secondary"
            onClick={openModal}
          >
            Bill History
          </Button>
          
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