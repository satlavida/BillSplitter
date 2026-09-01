import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useShallow } from 'zustand/shallow';
import useSessionStore from '../sessionStore';
import { calculateSettlement, calculateBillBalances, getEffectiveRate } from '../lib/settlement';
import { getDiscountedItemPrice } from '../lib/personTotals';
import { getImageBlob } from '../lib/imageStore';
import { formatAmountInCurrency } from '../lib/currencyDisplay';
import { Card, Button, Modal, PrintWrapper, BackLink, Heading } from '../ui/components';
import type { Bill } from '../schemas/session.schema';
import type { Person, Payment } from '../schemas/bill.schema';

const METHOD_LABEL: Record<Payment['method'], string> = { cash: 'Cash', online: 'Online' };

// Req 16: a compact per-bill list on the settlement page (bill totals
// computed the same way BillSummary/personTotals.ts do — subtotal after
// item-level discounts, plus tax) with an optional receipt-image viewer,
// so the whole session's bills are visible in one place without opening
// each one's own editor. Returned in the bill's own currency — callers
// convert to session currency via getEffectiveRate before display, since
// this page always renders in session currency (see calculateBalances's
// doc comment and architecture/currency.md).
const billTotal = (bill: Bill): number => bill.items.reduce((sum, item) => sum + getDiscountedItemPrice(item) * item.quantity, 0) + bill.taxAmount;

const ReceiptModal = ({ refKey, onClose }: { refKey: string; onClose: () => void }) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    let currentUrl: string | null = null;
    getImageBlob(refKey).then((blob) => {
      if (blob) {
        currentUrl = URL.createObjectURL(blob);
        setObjectUrl(currentUrl);
      }
    });
    return () => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [refKey]);

  return (
    <Modal isOpen onClose={onClose} title="Receipt">
      {objectUrl ? <img src={objectUrl} alt="Receipt" className="max-w-full rounded" /> : <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>}
    </Modal>
  );
};

interface BillBreakdownProps {
  bill: Bill;
  people: Person[];
  nameFor: (id: string) => string;
  formatCurrency: (amount: number) => string;
  effectiveRate: number;
}

// Per-bill "who owes whom on this bill" line, e.g. "Bob owes Alice 500" /
// "you're owed 500" — the detailed settlement view's per-bill counterpart
// to the session-wide "Who pays whom" card above. Converted to session
// currency via effectiveRate, since this page shows session currency only.
const BillBreakdown = ({ bill, people, nameFor, formatCurrency, effectiveRate }: BillBreakdownProps) => {
  const balances = calculateBillBalances(bill, people)
    .map((b) => ({ ...b, amount: b.amount * effectiveRate }))
    .filter((b) => Math.abs(b.amount) > 0.005);
  if (balances.length === 0) return null;

  return (
    <ul className="mt-1 space-y-0.5">
      {balances.map((b) => (
        <li key={b.personId} className="text-xs text-zinc-500 dark:text-zinc-400">
          {b.amount > 0 ? `${nameFor(b.personId)} is owed ${formatCurrency(b.amount)}` : `${nameFor(b.personId)} owes ${formatCurrency(-b.amount)}`}
        </li>
      ))}
    </ul>
  );
};

const SessionSettlementPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const session = useSessionStore(useShallow((s) => (sessionId ? s.sessions.find((sess) => sess.id === sessionId) : undefined)));
  const [viewingReceiptFor, setViewingReceiptFor] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'basic' | 'detailed'>('basic');

  if (!sessionId || !session) {
    return (
      <div>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">Session not found.</p>
        <BackLink to="/sessions">Back to sessions</BackLink>
      </div>
    );
  }

  const { balances, transactions } = calculateSettlement(session.bills, session.people, session.currency, session.payments);
  const nameFor = (id: string) => session.people.find((p) => p.id === id)?.name || 'Unknown';
  // Always session currency on this page — a bill in a different currency
  // is converted via its effective rate, never shown in its own currency
  // (unlike the joiner bill view's opt-in toggle — see architecture/currency.md).
  const formatCurrency = (amount: number) => formatAmountInCurrency(amount, session.currency);

  return (
    <div>
      <div className="mb-4 no-print">
        <BackLink to={`/session/${sessionId}`} className="text-sm">← Back to Session</BackLink>
      </div>
      <div className="flex items-center justify-between mb-4">
        <Heading margin="none">Settlement</Heading>
        <div className="flex gap-1 no-print">
          <Button size="sm" variant={viewMode === 'basic' ? 'primary' : 'secondary'} onClick={() => setViewMode('basic')}>
            Basic
          </Button>
          <Button size="sm" variant={viewMode === 'detailed' ? 'primary' : 'secondary'} onClick={() => setViewMode('detailed')}>
            Detailed
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              // Print output always uses the detailed per-bill breakdown,
              // regardless of which view the creator was looking at on
              // screen — same PrintWrapper technique BillSummary.tsx uses,
              // so there's no separate print-only DOM to keep in sync.
              setViewMode('detailed');
              setTimeout(() => window.print(), 0);
            }}
          >
            Print Summary PDF
          </Button>
        </div>
      </div>

      <PrintWrapper>
        <div id="printable-settlement">
          <Card>
            <h3 className="font-medium mb-2 text-zinc-800 dark:text-white transition-colors">Balances</h3>
            {balances.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 transition-colors">No people in this session yet.</p>
            ) : (
              <ul className="space-y-1">
                {balances.map((b) => (
                  <li key={b.personId} className="flex justify-between text-sm">
                    <span className="text-zinc-700 dark:text-zinc-300 transition-colors">{nameFor(b.personId)}</span>
                    <span
                      className={
                        b.amount > 0.005
                          ? 'text-green-600 dark:text-green-400'
                          : b.amount < -0.005
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-zinc-500 dark:text-zinc-400'
                      }
                    >
                      {b.amount > 0.005 ? `is owed ${formatCurrency(b.amount)}` : b.amount < -0.005 ? `owes ${formatCurrency(-b.amount)}` : 'settled up'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h3 className="font-medium mb-2 text-zinc-800 dark:text-white transition-colors">Who pays whom</h3>
            {transactions.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 transition-colors">Everyone is settled up.</p>
            ) : (
              <ul className="space-y-1">
                {transactions.map((t, i) => (
                  <li key={i} className="text-sm text-zinc-700 dark:text-zinc-300 transition-colors">
                    <span className="font-medium">{nameFor(t.from)}</span> pays <span className="font-medium">{nameFor(t.to)}</span>{' '}
                    {formatCurrency(t.amount)}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {session.payments.length > 0 && (
            <Card>
              <h3 className="font-medium mb-2 text-zinc-800 dark:text-white transition-colors">Payments</h3>
              <ul className="space-y-1">
                {session.payments.map((payment) => (
                  <li key={payment.id} className="text-sm text-zinc-700 dark:text-zinc-300 transition-colors">
                    <span className="font-medium">{nameFor(payment.payerId)}</span> paid <span className="font-medium">{nameFor(payment.payeeId)}</span>{' '}
                    {formatAmountInCurrency(payment.amount, payment.currency)} ({METHOD_LABEL[payment.method]}
                    {payment.transactionId ? `, Txn ${payment.transactionId}` : ''}) —{' '}
                    <span className={payment.verified ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}>
                      {payment.verified ? 'Verified' : 'Pending verification'}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <h3 className="font-medium mb-2 text-zinc-800 dark:text-white transition-colors">Bills</h3>
            {session.bills.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 transition-colors">No bills yet.</p>
            ) : (
              <ul className="space-y-2">
                {session.bills.map((bill) => {
                  const effectiveRate = getEffectiveRate(bill, session.currency);
                  return (
                    <li key={bill.id} className="flex justify-between items-center text-sm">
                      <div>
                        <span className="text-zinc-800 dark:text-white transition-colors">{bill.title}</span>
                        <span className="block text-xs text-zinc-500 dark:text-zinc-400">{new Date(bill.date).toLocaleDateString()}</span>
                        {viewMode === 'detailed' && (
                          <>
                            <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                              Paid by {bill.paidByPersonId ? nameFor(bill.paidByPersonId) : 'no one yet'}
                            </span>
                            <BillBreakdown bill={bill} people={session.people} nameFor={nameFor} formatCurrency={formatCurrency} effectiveRate={effectiveRate} />
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">{formatCurrency(billTotal(bill) * effectiveRate)}</span>
                        {bill.receiptImage && (
                          <Button size="sm" variant="secondary" className="no-print" onClick={() => setViewingReceiptFor(bill.receiptImage!.refKey)}>
                            View Receipt
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </PrintWrapper>

      {viewingReceiptFor && <ReceiptModal refKey={viewingReceiptFor} onClose={() => setViewingReceiptFor(null)} />}
    </div>
  );
};

export default SessionSettlementPage;
