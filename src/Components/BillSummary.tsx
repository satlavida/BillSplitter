import { memo, useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useBillStore, { useBillPersonTotals, useBillPersons, useBillItems, type PersonTotal, type PersonTotalItem } from '../billStore';
import useSessionStore from '../sessionStore';
import { formatAmountInCurrency } from '../lib/currencyDisplay';
import { useShallow } from 'zustand/shallow';
import { Button, Card, PrintButton, PrintWrapper, Dropdown, Disclosure, ProgressBar, Heading } from '../ui/components';
import BillTotalsSummary from './BillTotalsSummary';
import ImageLightbox from './ImageLightbox';
import ItemSplitCard from './ItemSplitCard';
import { getImageBlob } from '../lib/imageStore';
import type { ReceiptImageRef } from '../schemas/session.schema';

interface PaidBySelectorProps {
  sessionId: string;
  billId: string;
}

// Lets the user mark who fronted this bill, used by the session-wide settlement.
const PaidBySelector = memo(({ sessionId, billId }: PaidBySelectorProps) => {
  const people = useBillPersons();
  const paidByPersonId = useSessionStore((s) => s.getBill(sessionId, billId)?.paidByPersonId ?? null);
  const setBillPaidBy = useSessionStore((s) => s.setBillPaidBy);

  return (
    <div className="no-print">
      <h3 className="text-lg font-semibold text-zinc-800 dark:text-white mb-2">Who Paid?</h3>
      <Dropdown
        value={paidByPersonId ?? ''}
        onChange={(e) => setBillPaidBy(sessionId, billId, e.target.value || null)}
        disabled={people.length === 0}
        options={[{ value: '', label: 'Not set' }, ...people.map((person) => ({ value: person.id, label: person.name }))]}
      />
    </div>
  );
});

interface ReceiptImagePreviewProps {
  receiptImage: ReceiptImageRef;
}

// Displays the resized receipt image captured during scanning (stored in IndexedDB).
const ReceiptImagePreview = memo(({ receiptImage }: ReceiptImagePreviewProps) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    let currentUrl: string | null = null;
    getImageBlob(receiptImage.refKey).then((blob) => {
      if (blob) {
        currentUrl = URL.createObjectURL(blob);
        setObjectUrl(currentUrl);
      }
    });
    return () => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [receiptImage.refKey]);

  if (!objectUrl) return null;

  return (
    <div>
      <h3 className="text-lg font-semibold text-zinc-800 dark:text-white mb-2">Receipt</h3>
      <img
        src={objectUrl}
        alt="Scanned receipt"
        className="max-w-full rounded-md border border-zinc-200 dark:border-zinc-700 cursor-zoom-in"
        onClick={() => setLightboxOpen(true)}
      />
      <ImageLightbox isOpen={lightboxOpen} onClose={() => setLightboxOpen(false)} src={objectUrl} alt="Scanned receipt" />
    </div>
  );
});

interface BillTitleProps {
  title: string;
}

// BillTitle component for displaying the title in summary view
const BillTitle = memo(({ title }: BillTitleProps) => {
  if (!title) return null;

  return (
    <div className="mb-4 text-center">
      <h1 className="text-2xl font-bold text-zinc-800 dark:text-white transition-colors">{title}</h1>
    </div>
  );
});

interface PersonItemRowProps {
  item: PersonTotalItem;
  formatCurrency: (amount: number | null | undefined) => string;
}

// PersonItemRow component for individual item rows
const PersonItemRow = memo(({ item, formatCurrency }: PersonItemRowProps) => {
  const hasDiscount = item.discount > 0;
  const discountText = hasDiscount ? `Discount ${item.discountType === 'percentage' ? `${item.discount}%` : formatCurrency(item.discount)}` : '';
  return (
    <li className="flex justify-between items-start py-2">
      <div>
        <span className="dark:text-white transition-colors">{item.name}</span>
        {hasDiscount && <span className="ml-1 text-xs text-zinc-600 dark:text-zinc-400 transition-colors">({discountText})</span>}
        {item.sharedWith > 1 && <span className="text-sm text-zinc-600 dark:text-zinc-400 block transition-colors">Split by {item.sharedWith}</span>}
      </div>
      <span className="font-medium dark:text-white transition-colors">{formatCurrency(item.share)}</span>
    </li>
  );
});

interface PersonCardProps {
  person: PersonTotal;
  formatCurrency: (amount: number | null | undefined) => string;
  billTitle: string;
}

// PersonCard component for each person's summary
const PersonCard = memo(({ person, formatCurrency, billTitle }: PersonCardProps) => {
  const handleShare = async () => {
    const breakdown = person.items
      .map((item) => {
        const discountText = item.discount > 0 ? ` (Discount ${item.discountType === 'percentage' ? `${item.discount}%` : formatCurrency(item.discount)})` : '';
        return `${item.name}: ${formatCurrency(item.share)} Split${discountText}`;
      })
      .join('\n');
    const text = `${person.name} owes ${formatCurrency(person.total)}\nBreakdown:\n${breakdown}`;
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
        <h3 className="text-lg font-bold text-zinc-800 dark:text-white transition-colors">{person.name}</h3>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={handleShare} className="no-print">
            Share
          </Button>
        </div>
      </div>

      {person.items.length > 0 ? (
        <>
          <ul className="mb-4 space-y-1 divide-y divide-zinc-100 dark:divide-zinc-700 transition-colors">
            {person.items.map((item) => (
              <PersonItemRow key={item.id} item={item} formatCurrency={formatCurrency} />
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

interface EditButtonsProps {
  onEdit: (step: number) => void;
}

// EditButtons component for navigation
const EditButtons = memo(({ onEdit }: EditButtonsProps) => {
  return (
    <div className="space-x-4 space-y-4 no-print">
      <Button variant="secondary" size="sm" onClick={() => onEdit(1)}>
        Edit People
      </Button>
      <Button variant="secondary" size="sm" onClick={() => onEdit(2)}>
        Edit Items
      </Button>
      <Button variant="secondary" size="sm" onClick={() => onEdit(3)}>
        Edit Assignments
      </Button>
    </div>
  );
});

// Main BillSummary component
const BillSummary = () => {
  const { sessionId, billId } = useParams<{ sessionId: string; billId: string }>();
  const receiptImage = useSessionStore((s) => (sessionId && billId ? s.getBill(sessionId, billId)?.receiptImage : undefined));
  const navigate = useNavigate();

  // Use Zustand store with useShallow to prevent unnecessary re-renders
  const { title, taxAmount, currency, goToStep, exportBill } = useBillStore(
    useShallow((state) => ({
      title: state.title,
      taxAmount: state.taxAmount,
      currency: state.currency,
      goToStep: state.goToStep,
      exportBill: state.exportBill,
    }))
  );

  const addBill = useSessionStore((state) => state.addBill);
  const paidByPersonId = useSessionStore((s) => (sessionId && billId ? s.getBill(sessionId, billId)?.paidByPersonId : undefined));

  // This bill's own currency, not the user's global preference — a bill
  // paid for in USD should show "$" while being edited, regardless of what
  // the editor's own default/other sessions use. See architecture/currency.md.
  const formatCurrency = (amount: number | null | undefined) => formatAmountInCurrency(amount, currency);

  // Get person totals using the specialized hook
  const personTotals = useBillPersonTotals();
  const items = useBillItems();
  const people = useBillPersons();

  // Calculate subtotal from person totals
  const subtotal = personTotals.reduce((sum, person) => sum + person.subtotal, 0);

  // Calculate grand total from person totals
  const grandTotal = personTotals.reduce((sum, person) => sum + person.total, 0);

  // Mirrors JoinerBillEditorPage.tsx's same computation for its "X/Y
  // claimed" progress bar, sourced here from billStore's offline Item[]
  // rather than a LiveItem[] — works whether or not the session is live.
  const claimedCount = items.filter((item) => item.consumedBy.length > 0).length;

  // Tell everyone where to actually pay — the payer's own UPI ID, not each
  // claimer's, since the point is "who do I send money to."
  const payer = people.find((p) => p.id === paidByPersonId);

  const handleEdit = useCallback(
    (step: number) => {
      goToStep(step);
    },
    [goToStep]
  );

  const handleAddAnotherBill = useCallback(() => {
    if (!sessionId) return;
    const bill = addBill(sessionId);
    if (bill) navigate(`/session/${sessionId}/bill/${bill.id}`);
  }, [sessionId, addBill, navigate]);

  const handleBackToSession = useCallback(() => {
    if (sessionId) navigate(`/session/${sessionId}`);
  }, [sessionId, navigate]);

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

  return (
    <div>
      <Heading>Bill Summary</Heading>

      {sessionId && billId && (
        <div className="mb-4">
          <PaidBySelector sessionId={sessionId} billId={billId} />
          {payer?.upiId && (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Pay via UPI: <span className="font-medium text-zinc-800 dark:text-white">{payer.upiId}</span>
            </p>
          )}
        </div>
      )}

      {items.length > 0 && (
        <div className="mb-4">
          <ProgressBar value={(claimedCount / items.length) * 100} label={`${claimedCount}/${items.length} claimed`} className="mb-3" />
          <Disclosure title={<h3 className="text-lg font-semibold">Split Breakdown</h3>}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {items.map((item) => (
                <ItemSplitCard key={item.id} item={item} people={people} formatCurrency={formatCurrency} />
              ))}
            </div>
          </Disclosure>
        </div>
      )}

      <PrintWrapper>
        <div id="printable-bill">
          {/* Display bill title in printable section */}
          <BillTitle title={title} />

          {personTotals.map((person) => (
            <PersonCard key={person.id} person={person} formatCurrency={formatCurrency} billTitle={title} />
          ))}

          <BillTotalsSummary subtotal={subtotal} taxAmount={parseFloat(String(taxAmount)) || 0} grandTotal={grandTotal} formatCurrency={formatCurrency} className="mb-6" />

          {receiptImage && <ReceiptImagePreview receiptImage={receiptImage} />}
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

            <Button variant="secondary" onClick={handleExportJson}>
              Export JSON
            </Button>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-zinc-800 dark:text-white mb-2">Session</h3>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={handleBackToSession}>
              Back to Session
            </Button>
            <Button variant="success" onClick={handleAddAnotherBill}>
              Add Another Bill
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillSummary;
