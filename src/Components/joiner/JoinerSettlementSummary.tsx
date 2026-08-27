import { useState } from 'react';
import { Button, Card } from '../../ui/components';
import { calculateLiveBillBalances } from '../../lib/liveBillBalances';
import type { LiveSettlement, LiveBill, LiveSession } from '../../schemas/live.schema';

interface JoinerSettlementSummaryProps {
  settlement: LiveSettlement | null;
  myPersonId: string;
  nameFor: (personId: string) => string;
  bills: LiveBill[];
  people: LiveSession['people'];
}

interface MyBillLineProps {
  bill: LiveBill;
  people: LiveSession['people'];
  myPersonId: string;
  nameFor: (personId: string) => string;
}

// This bill's line for the joiner's own balance only, e.g. "Dinner: you owe
// Alice 500" / "Dinner: you're owed 200" — mirrors the creator's
// BillBreakdown (SessionSettlementPage.tsx) but filtered to myPersonId, same
// as the aggregate view below already does for the session-wide total.
const MyBillLine = ({ bill, people, myPersonId, nameFor }: MyBillLineProps) => {
  const mine = calculateLiveBillBalances(bill, people).find((b) => b.personId === myPersonId);
  if (!mine || Math.abs(mine.amount) <= 0.005) return null;

  return (
    <li className="text-sm text-zinc-700 dark:text-zinc-300 transition-colors">
      <span className="font-medium">{bill.title}</span>:{' '}
      {mine.amount > 0 ? (
        <>you're owed {mine.amount.toFixed(2)}</>
      ) : (
        <>
          you owe <span className="font-medium">{bill.paidByPersonId ? nameFor(bill.paidByPersonId) : 'someone'}</span> {(-mine.amount).toFixed(2)}
        </>
      )}
    </li>
  );
};

// Personal view of the shared settlement: only the lines that involve this
// joiner, not the full who-owes-who table (that's the creator's view). No
// currency symbol shown — a session's bills can each have their own
// currency, and LiveSettlement's amounts aren't currency-tagged (see
// LiveSessionPanel's settlement view, which does the same). Basic mode
// mirrors that; Detailed adds a per-bill line for just this joiner (e.g. "I
// paid Bill A so I'm owed 500, Bill B someone else paid so I owe them
// 1000 — net: I owe 500").
const JoinerSettlementSummary = ({ settlement, myPersonId, nameFor, bills, people }: JoinerSettlementSummaryProps) => {
  const [viewMode, setViewMode] = useState<'basic' | 'detailed'>('basic');

  if (!settlement) return null;

  const myTransactions = settlement.transactions.filter((t) => t.from === myPersonId || t.to === myPersonId);
  const myBalance = settlement.balances.find((b) => b.personId === myPersonId);

  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-zinc-800 dark:text-white transition-colors">Your settlement</h3>
        <div className="flex gap-1">
          <Button size="sm" variant={viewMode === 'basic' ? 'primary' : 'secondary'} onClick={() => setViewMode('basic')}>
            Basic
          </Button>
          <Button size="sm" variant={viewMode === 'detailed' ? 'primary' : 'secondary'} onClick={() => setViewMode('detailed')}>
            Detailed
          </Button>
        </div>
      </div>

      {viewMode === 'basic' ? (
        myTransactions.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {myBalance && Math.abs(myBalance.amount) > 0.005 ? 'Balances are still being worked out.' : "You're settled up."}
          </p>
        ) : (
          <ul className="space-y-1">
            {myTransactions.map((t, i) => (
              <li key={i} className="text-sm text-zinc-700 dark:text-zinc-300 transition-colors">
                {t.from === myPersonId ? (
                  <>
                    You owe <span className="font-medium">{nameFor(t.to)}</span> {t.amount.toFixed(2)}
                  </>
                ) : (
                  <>
                    <span className="font-medium">{nameFor(t.from)}</span> owes you {t.amount.toFixed(2)}
                  </>
                )}
              </li>
            ))}
          </ul>
        )
      ) : (
        <ul className="space-y-1">
          {bills.map((bill) => (
            <MyBillLine key={bill.id} bill={bill} people={people} myPersonId={myPersonId} nameFor={nameFor} />
          ))}
        </ul>
      )}
    </Card>
  );
};

export default JoinerSettlementSummary;
