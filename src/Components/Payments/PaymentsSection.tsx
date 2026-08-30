import { useState } from 'react';
import { useShallow } from 'zustand/shallow';
import useSessionStore from '../../sessionStore';
import { calculateSettlement } from '../../lib/settlement';
import { Card, Button } from '../../ui/components';
import PaymentCard from './PaymentCard';
import AddPaymentModal, { type AddPaymentInput } from './AddPaymentModal';
import type { Session } from '../../schemas/session.schema';

interface PaymentsSectionProps {
  session: Session;
}

// Creator-facing Payments section on SessionHomePage — the creator sees
// every payment (this component is never mounted for a joiner; see
// JoinerSessionView.tsx's own payments rendering, which relies on the
// server having already filtered LiveSession.payments for that viewer).
// Renders above the bill list once the session is fully settled by payment
// (see the exported isSessionSettledByPayments helper SessionHomePage.tsx
// uses to decide where to mount this), otherwise in its default slot.
const PaymentsSection = ({ session }: PaymentsSectionProps) => {
  const { addPayment, verifyPayment } = useSessionStore(useShallow((s) => ({ addPayment: s.addPayment, verifyPayment: s.verifyPayment })));
  const [addOpen, setAddOpen] = useState(false);
  const [prefill, setPrefill] = useState<{ payerId?: string; payeeId?: string; amount?: number }>({});
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const nameFor = (id: string) => session.people.find((p) => p.id === id)?.name ?? 'Someone';

  const { transactions } = calculateSettlement(session.bills, session.people, session.currency, session.payments);

  const handleVerify = (paymentId: string) => {
    setVerifyingId(paymentId);
    try {
      verifyPayment(session.id, paymentId);
    } finally {
      setVerifyingId(null);
    }
  };

  const handleSubmit = (input: AddPaymentInput) => {
    addPayment(session.id, { ...input, addedByPersonId: session.creatorPersonId ?? input.payerId });
  };

  const openAddFor = (payerId?: string, payeeId?: string, amount?: number) => {
    setPrefill({ payerId, payeeId, amount });
    setAddOpen(true);
  };

  const sortedPayments = [...session.payments].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  if (session.people.length === 0) return null;

  return (
    <Card data-testid="payments-section">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-zinc-800 dark:text-white transition-colors">Payments</h3>
        <Button size="sm" variant="secondary" onClick={() => openAddFor()}>
          Log Payment
        </Button>
      </div>

      {transactions.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Still owed</p>
          <ul className="space-y-1">
            {transactions.map((t, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="text-zinc-700 dark:text-zinc-300">
                  {nameFor(t.from)} owes {nameFor(t.to)} {t.amount.toFixed(2)} {session.currency}
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
              sessionCurrency={session.currency}
              canVerify
              verifying={verifyingId === payment.id}
              onVerify={() => handleVerify(payment.id)}
            />
          ))}
        </div>
      )}

      <AddPaymentModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        people={session.people}
        sessionCurrency={session.currency}
        defaultPayerId={prefill.payerId}
        defaultPayeeId={prefill.payeeId}
        defaultAmount={prefill.amount}
        onSubmit={handleSubmit}
      />
    </Card>
  );
};

export default PaymentsSection;
