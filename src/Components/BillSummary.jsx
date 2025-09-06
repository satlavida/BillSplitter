import { useMemo, memo, useCallback, useState } from 'react';
import useBillStore, { SPLIT_TYPES, useBillPersonTotals } from '../billStore';
import useBillHistoryStore from '../billHistoryStore';
import useCurrencyStore, { useFormatCurrency } from '../currencyStore';
import { useShallow } from 'zustand/shallow';
import { Button, Card, PrintButton, PrintWrapper } from '../ui/components';
import BillTotalsSummary from './BillTotalsSummary';
import { useBillHistory } from './BillHistory/BillHistoryContext';

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
const PersonItemRow = memo(({ item, formatCurrency, displayShare, showBadge }) => {
  const hasDiscount = item.discount > 0;
  const discountText = hasDiscount
    ? `Discount ${
        item.discountType === 'percentage'
          ? `${item.discount}%`
          : formatCurrency(item.discount)
      }`
    : '';
  return (
    <li className="flex justify-between items-start py-2">
      <div>
        <span className="dark:text-white transition-colors">{item.name}</span>
        {hasDiscount && (
          <span className="ml-1 text-xs text-zinc-600 dark:text-zinc-400 transition-colors">
            ({discountText})
          </span>
        )}
        {item.sharedWith > 1 && (
          <span className="text-sm text-zinc-600 dark:text-zinc-400 block transition-colors">
            Split by {item.sharedWith}
          </span>
        )}
      </div>
      <span className="font-medium dark:text-white transition-colors flex items-center gap-2">
        {formatCurrency(displayShare ?? item.share)}
        {showBadge && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 uppercase tracking-wide">incl. tax</span>
        )}
      </span>
    </li>
  );
});

// PersonCard component for each person's summary
const PersonCard = memo(({ person, formatCurrency, upiId, billTitle, itemDisplayShareMap, showPostTax }) => {
  const handleShare = async () => {
    const breakdown = person.items
      .map(item => {
        const discountText = item.discount > 0
          ? ` (Discount ${
              item.discountType === 'percentage'
                ? `${item.discount}%`
                : formatCurrency(item.discount)
            })`
          : '';
        return `${item.name}: ${formatCurrency(item.share)} Split${discountText}`;
      })
      .join('\n');
    const text = `${person.name} owes ${formatCurrency(person.total)}${
      upiId ? `; Split can be sent on "${upiId}"` : ''
    }\nBreakdown:\n${breakdown}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: billTitle || 'Bill Payment', text });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        alert('Payment details copied to clipboard');
      }
    } catch {
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
          {upiId && (
            <span className="text-sm text-zinc-800 dark:text-zinc-300 transition-colors">
              {upiId}
            </span>
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
                displayShare={showPostTax ? itemDisplayShareMap[`${person.id}-${item.id}`] : undefined}
                showBadge={!!showPostTax}
              />
            ))}
          </ul>

          <div className="border-t border-zinc-100 dark:border-zinc-700 pt-3 space-y-1 transition-colors">
            <div className="flex justify-between">
              <span className="text-zinc-700 dark:text-zinc-300 transition-colors">Subtotal:</span>
              <span className="text-zinc-700 dark:text-zinc-300 transition-colors">{formatCurrency(person.subtotal)}</span>
            </div>

            {!showPostTax && person.tax > 0 && (
              <div className="flex justify-between">
                <span className="text-zinc-700 dark:text-zinc-300 transition-colors">Tax:</span>
                <span className="text-zinc-700 dark:text-zinc-300 transition-colors">{formatCurrency(person.tax)}</span>
              </div>
            )}

            <div className="flex justify-between font-bold text-lg pt-1 px-2 py-1 bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100 print:bg-green-800 print:text-white rounded transition-colors">
              <span>Total:</span>
              <span>{formatCurrency(person.total)}</span>
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
    <div className="space-x-4 space-y-4 no-print">
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
  const { title, taxAmount, goToStep, reset, exportBill, getSectionsSummary, items, sections, showPostTaxPrice } = useBillStore(
    useShallow(state => ({
      title: state.title,
      taxAmount: state.taxAmount,
      goToStep: state.goToStep,
      reset: state.reset,
      exportBill: state.exportBill,
      getSectionsSummary: state.getSectionsSummary,
      items: state.items,
      sections: state.sections,
      showPostTaxPrice: state.showPostTaxPrice
    }))
  );
  
  // Get bill history actions
  const { saveBill } = useBillHistoryStore(
    useShallow(state => ({
      saveBill: state.saveBill
    }))
  );
  
  const formatCurrency = useFormatCurrency();

  // Current currency
  const currency = useCurrencyStore(state => state.currency);

  // Get bill history modal controls
  const { openModal } = useBillHistory();

  // User provided UPI ID
  const [upiId, setUpiId] = useState('');
  const [showUpiInput, setShowUpiInput] = useState(false);
  const isInr = currency === 'INR';

  // Get person totals using the specialized hook
  const personTotals = useBillPersonTotals();
  const sectionsSummary = useShallow(getSectionsSummary)();
  
  // Calculate subtotal from person totals
  const subtotal = personTotals.reduce((sum, person) => sum + person.subtotal, 0);
  
  // Calculate grand total from person totals
  const grandTotal = personTotals.reduce((sum, person) => sum + person.total, 0);
  const totalSectionsTax = sectionsSummary.reduce((sum, s) => sum + (parseFloat(s.tax) || 0), 0);

  // Build per-item display shares (pre-tax + allocated tax) when setting is enabled
  const itemDisplayShareMap = useMemo(() => {
    if (!showPostTaxPrice) return {};
    const sectionSubtotals = {};
    const itemSubtotals = {};
    items.forEach(it => {
      const price = parseFloat(it.price) || 0;
      const discount = parseFloat(it.discount) || 0;
      const discounted = it.discountType === 'percentage' ? price - (price * discount) / 100 : price - discount;
      const subtotal = (isNaN(discounted) ? 0 : discounted) * (parseInt(it.quantity) || 1);
      itemSubtotals[it.id] = subtotal;
      const key = it.sectionId || 'default';
      sectionSubtotals[key] = (sectionSubtotals[key] || 0) + subtotal;
    });
    // Use multi-tax aware sections summary (falls back to legacy internally)
    const sectionTaxes = {};
    sectionsSummary.forEach(s => {
      const k = (s.id ?? 'default');
      sectionTaxes[k] = (parseFloat(s.tax) || 0);
    });

    const ratio = (item, alloc) => {
      if (!item || !alloc || !item.consumedBy || item.consumedBy.length === 0) return 0;
      switch (item.splitType) {
        case SPLIT_TYPES.PERCENTAGE: {
          const sum = item.consumedBy.reduce((t, a) => t + (a.value || 0), 0) || 0;
          return sum > 0 ? (alloc.value || 0) / sum : 0;
        }
        case SPLIT_TYPES.FRACTION: {
          const sum = item.consumedBy.reduce((t, a) => t + (a.value || 0), 0) || 0;
          return sum > 0 ? (alloc.value || 0) / sum : 0;
        }
        case SPLIT_TYPES.EQUAL:
        default:
          return 1 / item.consumedBy.length;
      }
    };

    const map = {};
    items.forEach(it => {
      if (!it.consumedBy || it.consumedBy.length === 0) return;
      const key = it.sectionId || 'default';
      const itemSubtotal = itemSubtotals[it.id] || 0;
      const secSubtotal = sectionSubtotals[key] || 0;
      const secTax = sectionTaxes[key] || 0;
      const itemTaxTotal = secSubtotal > 0 ? (itemSubtotal / secSubtotal) * secTax : 0;
      it.consumedBy.forEach(alloc => {
        const r = ratio(it, alloc);
        const pre = itemSubtotal * r;
        const tx = itemTaxTotal * r;
        map[`${alloc.personId}-${it.id}`] = pre + tx;
      });
    });
    return map;
  }, [items, sectionsSummary, showPostTaxPrice]);
  
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
      {isInr && (
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
      )}

      <PrintWrapper>
        <div id="printable-bill">
          {/* Display bill title in printable section */}
          <BillTitle title={title} />

          {personTotals.map(person => (
            <PersonCard
              key={person.id}
              person={person}
              formatCurrency={formatCurrency}
              upiId={isInr ? upiId : ''}
              billTitle={title}
              itemDisplayShareMap={itemDisplayShareMap}
              showPostTax={!!showPostTaxPrice}
            />
          ))}
          
          <BillTotalsSummary 
            subtotal={subtotal}
            taxAmount={totalSectionsTax || (parseFloat(taxAmount) || 0)}
            grandTotal={grandTotal}
            formatCurrency={formatCurrency}
            className="mb-6"
          />

          {/* Sections breakdown */}
          {sectionsSummary.length > 0 && (
            <Card>
              <h3 className="text-lg font-semibold mb-2 text-zinc-800 dark:text-white transition-colors">Sections</h3>
              <ul className="space-y-1 divide-y divide-zinc-100 dark:divide-zinc-700 transition-colors">
                {sectionsSummary.map(sec => (
                  <li key={sec.id ?? 'default'} className="py-2 flex justify-between items-center">
                    <div className="text-zinc-800 dark:text-zinc-200">
                      {sec.name && sec.name.trim().length > 0 ? sec.name : 'Default'}
                    </div>
                    <div className="text-sm text-zinc-700 dark:text-zinc-300 flex gap-4">
                      <span>Subtotal: {formatCurrency(sec.subtotal)}</span>
                      {sec.tax > 0 && <span>Tax: {formatCurrency(sec.tax)}</span>}
                      <span className="font-medium">Total: {formatCurrency(sec.total)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </PrintWrapper>
      
      <div className="no-print space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-zinc-800 dark:text-white mb-2">Edit</h3>
          <EditButtons onEdit={handleEdit} />
        </div>

        <div>
          <h3 className="text-lg font-semibold text-zinc-800 dark:text-white mb-2">Bill Actions</h3>
          <div className="flex flex-wrap gap-2">
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
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-zinc-800 dark:text-white mb-2">History</h3>
          <Button
            variant="secondary"
            onClick={openModal}
          >
            Bill History
          </Button>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-zinc-800 dark:text-white mb-2">Reset</h3>
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
