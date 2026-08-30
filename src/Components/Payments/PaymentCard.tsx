import { Button } from '../../ui/components';
import { formatAmountInCurrency } from '../../lib/currencyDisplay';
import type { Payment } from '../../schemas/bill.schema';

interface PaymentCardProps {
  payment: Payment;
  nameFor: (personId: string) => string;
  sessionCurrency: string;
  // Shown only when the viewer may act on this specific pending payment —
  // the payee (or the creator, who can act on anyone's behalf) — see
  // architecture/payments.md. verifying is the id of whichever payment is
  // currently mid-request, so only that one card shows a spinner-ish
  // disabled state.
  canVerify: boolean;
  verifying: boolean;
  onVerify: () => void;
}

const METHOD_LABEL: Record<Payment['method'], string> = { cash: 'Cash', online: 'Online' };

// One logged payment: who paid whom, how much (in its own currency, plus
// the session-currency equivalent when they differ), method/transaction id,
// and a verified/pending badge — with a "Mark Received" action for whoever
// may confirm it.
const PaymentCard = ({ payment, nameFor, sessionCurrency, canVerify, verifying, onVerify }: PaymentCardProps) => {
  const amountInOwnCurrency = formatAmountInCurrency(payment.amount, payment.currency);
  const differsFromSession = payment.currency !== sessionCurrency;
  const converted = differsFromSession && payment.exchangeRate !== null ? payment.amount * payment.exchangeRate : null;

  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <div className="min-w-0">
        <p className="text-sm text-zinc-800 dark:text-white transition-colors">
          <span className="font-medium">{nameFor(payment.payerId)}</span> paid <span className="font-medium">{nameFor(payment.payeeId)}</span>{' '}
          <span className="font-medium">{amountInOwnCurrency}</span>
          {converted !== null && <span className="text-zinc-500 dark:text-zinc-400"> ({formatAmountInCurrency(converted, sessionCurrency)})</span>}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {METHOD_LABEL[payment.method]}
          {payment.transactionId && ` — Txn ${payment.transactionId}`}
          {' · '}
          {new Date(payment.createdAt).toLocaleDateString()}
        </p>
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1">
        {payment.verified ? (
          <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">Verified</span>
        ) : (
          <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Pending</span>
        )}
        {!payment.verified && canVerify && (
          <Button size="sm" variant="success" onClick={onVerify} disabled={verifying}>
            {verifying ? 'Marking…' : 'Mark Received'}
          </Button>
        )}
      </div>
    </div>
  );
};

export default PaymentCard;
