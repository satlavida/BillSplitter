import { calculatePersonTotals } from './personTotals';
import type { Bill } from '../schemas/session.schema';
import type { Person, Payment } from '../schemas/bill.schema';

export interface Balance {
  personId: string;
  amount: number;
}

export interface Transaction {
  from: string;
  to: string;
  amount: number;
}

export interface SettlementResult {
  balances: Balance[];
  transactions: Transaction[];
}

const EPSILON = 1e-6;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Computes each person's net balance for a single bill.
 *
 * The payer (bill.paidByPersonId) is owed everyone else's share and owes
 * nothing extra for their own share (they already paid it). Everyone else
 * owes their share to the payer. A bill with no payer (paidByPersonId:
 * null) contributes nothing to any balance — deliberate: there's no payer
 * to attribute a settlement claim to (every balance comes back 0).
 *
 * Kept at full float precision (not rounded to cents here) so the zero-sum
 * invariant holds exactly when balances are later summed across bills;
 * rounding happens only where amounts are actually settled/displayed (see
 * simplifyDebts).
 */
// The rate to convert 1 unit of bill.currency into sessionCurrency: 1 if
// they match, else bill.exchangeRate (falling back to 1 if unset — see
// calculateBalances's doc comment for why that's a deliberate non-throwing
// fallback). Exported so pages showing a bill's own amounts (e.g.
// SessionSettlementPage's per-bill breakdown) can convert them the same way
// settlement math does, without duplicating this fallback logic.
export const getEffectiveRate = (bill: Pick<Bill, 'currency' | 'exchangeRate'>, sessionCurrency: string): number => {
  if (bill.currency === sessionCurrency) return 1;
  return bill.exchangeRate ?? 1;
};

export const calculateBillBalances = (bill: Pick<Bill, 'items' | 'taxAmount' | 'paidByPersonId'>, people: Person[]): Balance[] => {
  const balances: Record<string, number> = {};
  people.forEach((p) => {
    balances[p.id] = 0;
  });

  if (bill.paidByPersonId) {
    const personTotals = calculatePersonTotals(people, bill.items, bill.taxAmount);
    const billTotal = personTotals.reduce((sum, p) => sum + p.total, 0);

    personTotals.forEach((personTotal) => {
      if (balances[personTotal.id] === undefined) return;

      if (personTotal.id === bill.paidByPersonId) {
        balances[personTotal.id] += billTotal - personTotal.total;
      } else {
        balances[personTotal.id] -= personTotal.total;
      }
    });
  }

  return Object.entries(balances).map(([personId, amount]) => ({
    personId,
    amount,
  }));
};

/**
 * Computes each person's net balance across every bill in a session, in
 * sessionCurrency. For each bill, the payer is credited/debtors debited in
 * that bill's own currency (calculateBillBalances), then converted into
 * sessionCurrency by multiplying by the bill's effective rate: 1 if the
 * bill's currency matches the session's, else bill.exchangeRate (the
 * currently-in-effect fetched-or-overridden rate — see
 * BillSettingsModal.tsx). Falls back to 1 (with a console warning, not a
 * throw) if a mismatched-currency bill somehow has no rate yet, so a single
 * incomplete bill can't break the whole session's settlement.
 *
 * This is a hand-mirrored twin of server/internal/settlement/settlement.go's
 * CalculateBalances — see that file's doc comment and
 * architecture/settlement.md: both sides must change together.
 *
 * Invariant: sum(balances) is always 0 (money owed always nets to money owed
 * back), verified explicitly in settlement.test.ts. This still holds with
 * payments applied — see below.
 *
 * `payments` (default []) nets out logged payments after the bill-based
 * balances are summed — see architecture/payments.md. Only **verified**
 * payments count; a pending (payer-added, not-yet-confirmed-by-payee)
 * payment is ignored entirely, same as an unset bill exchange rate falls
 * back to 1 rather than throwing. A payment transfers money from payer to
 * payee regardless of which specific bills created the underlying debt, so
 * it's applied as a flat balances[payer] += amount / balances[payee] -=
 * amount — this is exactly equivalent to (and preserves the zero-sum
 * invariant of) reducing whatever pairwise debts simplifyDebts would
 * otherwise compute between them.
 */
export const calculateBalances = (bills: Bill[], people: Person[], sessionCurrency: string, payments: Payment[] = []): Balance[] => {
  const totals: Record<string, number> = {};
  people.forEach((p) => {
    totals[p.id] = 0;
  });

  bills.forEach((bill) => {
    if (bill.currency !== sessionCurrency && bill.exchangeRate === null) {
      console.warn(`Bill ${bill.id} is in ${bill.currency} but has no exchange rate to ${sessionCurrency} — treating as 1:1.`);
    }
    const effectiveRate = getEffectiveRate(bill, sessionCurrency);

    calculateBillBalances(bill, people).forEach(({ personId, amount }) => {
      totals[personId] += amount * effectiveRate;
    });
  });

  payments.forEach((payment) => {
    if (!payment.verified) return;
    if (totals[payment.payerId] === undefined || totals[payment.payeeId] === undefined) return;

    const rate = payment.currency === sessionCurrency ? 1 : (payment.exchangeRate ?? 1);
    const converted = payment.amount * rate;
    totals[payment.payerId] += converted;
    totals[payment.payeeId] -= converted;
  });

  return Object.entries(totals).map(([personId, amount]) => ({
    personId,
    amount,
  }));
};

/**
 * Greedy debt-simplification: repeatedly match the largest creditor against
 * the largest debtor and settle the smaller of the two amounts. This is the
 * standard practical approximation used by Splitwise-style apps — it is NOT
 * guaranteed to produce the true minimum number of transactions (that's
 * NP-hard in general), but it's a reasonable, fast, well-understood
 * trade-off for this use case.
 */
export const simplifyDebts = (balances: Balance[]): Transaction[] => {
  const creditors = balances.filter((b) => b.amount > EPSILON).map((b) => ({ ...b })).sort((a, b) => b.amount - a.amount);
  const debtors = balances
    .filter((b) => b.amount < -EPSILON)
    .map((b) => ({ ...b, amount: -b.amount }))
    .sort((a, b) => b.amount - a.amount);

  const transactions: Transaction[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];
    const settled = Math.min(creditor.amount, debtor.amount);

    if (settled > EPSILON) {
      transactions.push({
        from: debtor.personId,
        to: creditor.personId,
        amount: round2(settled),
      });
    }

    creditor.amount -= settled;
    debtor.amount -= settled;

    if (creditor.amount <= EPSILON) ci++;
    if (debtor.amount <= EPSILON) di++;
  }

  return transactions;
};

/**
 * Full settlement computation for a session: net balances per person plus
 * the simplified set of who-pays-whom transactions to zero them out, all in
 * sessionCurrency.
 */
export const calculateSettlement = (bills: Bill[], people: Person[], sessionCurrency: string, payments: Payment[] = []): SettlementResult => {
  const balances = calculateBalances(bills, people, sessionCurrency, payments);
  const transactions = simplifyDebts(balances);
  return { balances, transactions };
};
