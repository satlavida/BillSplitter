import { useState } from 'react';
import { addLivePayment, verifyLivePayment, LiveApiError } from '../../lib/liveApi';
import { Card, Button, Alert } from '../../ui/components';
import { generateId } from '../../lib/generateId';
import PaymentCard from '../Payments/PaymentCard';
import AddPaymentModal, { type AddPaymentInput } from '../Payments/AddPaymentModal';
import type { LivePayment, LiveSettlement, LivePerson } from '../../schemas/live.schema';

interface JoinerPaymentsSectionProps {
  code: string;
  myPersonId: string;
  joinerToken: string;
  people: LivePerson[];
  sessionCurrency: string;
  // Already filtered server-side to payments this joiner is a party to —
  // see architecture/payments.md's GetSession filtering.
  payments: LivePayment[];
  settlement: LiveSettlement | null;
  onChanged: () => void;
}

// Joiner-facing Payments section — only ever shows payments where this
// joiner is the payer or payee (the server has already filtered them out
// of `payments`, so there's no client-side filtering to do here). A joiner
// can log a payment for themselves (as payer or payee) and verify a
// pending payment where they're the payee; they can never act on someone
// else's payment.
const JoinerPaymentsSection = ({ code, myPersonId, joinerToken, people, sessionCurrency, payments, settlement, onChanged }: JoinerPaymentsSectionProps) => {
  const [addOpen, setAddOpen] = useState(false);
  const [prefill, setPrefill] = useState<{ payerId?: string; payeeId?: string; amount?: number }>({});
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nameFor = (id: string) => people.find((p) => p.id === id)?.name ?? 'Someone';

  const myTransactions = (settlement?.transactions ?? []).filter((t) => t.from === myPersonId || t.to === myPersonId);

  const handleVerify = async (paymentId: string) => {
    setVerifyingId(paymentId);
    setError(null);
    try {
      await verifyLivePayment(code, paymentId, joinerToken);
      onChanged();
    } catch (err) {
      setError(err instanceof LiveApiError ? err.message : 'Failed to verify payment');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleSubmit = async (input: AddPaymentInput) => {
    try {
      await addLivePayment(code, { id: generateId(), ...input, addedByPersonId: myPersonId }, joinerToken);
      onChanged();
    } catch (err) {
      setError(err instanceof LiveApiError ? err.message : 'Failed to log payment');
    }
  };

  const openAddFor = (payerId?: string, payeeId?: string, amount?: number) => {
    setPrefill({ payerId, payeeId, amount });
    setAddOpen(true);
  };

  if (payments.length === 0 && myTransactions.length === 0) return null;

  const sortedPayments = [...payments].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <Card data-testid="joiner-payments-section" className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-zinc-800 dark:text-white transition-colors">My Payments</h3>
        <Button size="sm" variant="secondary" onClick={() => openAddFor(myPersonId)}>
          Log Payment
        </Button>
      </div>

      {error && <Alert type="error" className="mb-2">{error}</Alert>}

      {myTransactions.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Still owed</p>
          <ul className="space-y-1">
            {myTransactions.map((t, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="text-zinc-700 dark:text-zinc-300">
                  {t.from === myPersonId ? `You owe ${nameFor(t.to)}` : `${nameFor(t.from)} owes you`} {t.amount.toFixed(2)} {sessionCurrency}
                </span>
                <Button size="sm" variant="secondary" onClick={() => openAddFor(t.from, t.to, t.amount)}>
                  Log Payment
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sortedPayments.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No payments logged yet.</p>
      ) : (
        <div>
          {sortedPayments.map((payment) => (
            <PaymentCard
              key={payment.id}
              payment={payment}
              nameFor={nameFor}
              sessionCurrency={sessionCurrency}
              canVerify={payment.payeeId === myPersonId}
              verifying={verifyingId === payment.id}
              onVerify={() => void handleVerify(payment.id)}
            />
          ))}
        </div>
      )}

      <AddPaymentModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        people={people}
        sessionCurrency={sessionCurrency}
        defaultPayerId={prefill.payerId}
        defaultPayeeId={prefill.payeeId}
        defaultAmount={prefill.amount}
        onSubmit={(input) => void handleSubmit(input)}
      />
    </Card>
  );
};

export default JoinerPaymentsSection;
