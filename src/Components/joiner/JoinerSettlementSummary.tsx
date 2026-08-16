import { Card } from '../../ui/components';
import type { LiveSettlement } from '../../schemas/live.schema';

interface JoinerSettlementSummaryProps {
  settlement: LiveSettlement | null;
  myPersonId: string;
  nameFor: (personId: string) => string;
}

// Personal view of the shared settlement: only the lines that involve this
// joiner, not the full who-owes-who table (that's the creator's view). No
// currency symbol shown — a session's bills can each have their own
// currency, and LiveSettlement's amounts aren't currency-tagged (see
// LiveSessionPanel's settlement view, which does the same).
const JoinerSettlementSummary = ({ settlement, myPersonId, nameFor }: JoinerSettlementSummaryProps) => {
  if (!settlement) return null;

  const myTransactions = settlement.transactions.filter((t) => t.from === myPersonId || t.to === myPersonId);
  const myBalance = settlement.balances.find((b) => b.personId === myPersonId);

  if (myTransactions.length === 0) {
    return (
      <Card>
        <h3 className="font-medium mb-1 text-zinc-800 dark:text-white transition-colors">Your settlement</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {myBalance && Math.abs(myBalance.amount) > 0.005 ? 'Balances are still being worked out.' : "You're settled up."}
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="font-medium mb-2 text-zinc-800 dark:text-white transition-colors">Your settlement</h3>
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
    </Card>
  );
};

export default JoinerSettlementSummary;
