import { calculatePersonTotals } from './personTotals';
import type { Bill } from '../schemas/session.schema';
import type { Person } from '../schemas/bill.schema';

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
 * Computes each person's net balance across every bill in a session, by
 * summing calculateBillBalances over each bill.
 *
 * Invariant: sum(balances) is always 0 (money owed always nets to money owed
 * back), verified explicitly in settlement.test.ts.
 */
export const calculateBalances = (bills: Bill[], people: Person[]): Balance[] => {
  const totals: Record<string, number> = {};
  people.forEach((p) => {
    totals[p.id] = 0;
  });

  bills.forEach((bill) => {
    calculateBillBalances(bill, people).forEach(({ personId, amount }) => {
      totals[personId] += amount;
    });
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
 * the simplified set of who-pays-whom transactions to zero them out.
 */
export const calculateSettlement = (bills: Bill[], people: Person[]): SettlementResult => {
  const balances = calculateBalances(bills, people);
  const transactions = simplifyDebts(balances);
  return { balances, transactions };
};
