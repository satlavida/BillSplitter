import { useParams, Link } from 'react-router-dom';
import { useShallow } from 'zustand/shallow';
import useSessionStore from '../sessionStore';
import { calculateSettlement } from '../lib/settlement';
import { useFormatCurrency } from '../currencyStore';
import { Card } from '../ui/components';

const SessionSettlementPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const session = useSessionStore(useShallow((s) => (sessionId ? s.sessions.find((sess) => sess.id === sessionId) : undefined)));
  const formatCurrency = useFormatCurrency();

  if (!sessionId || !session) {
    return (
      <div>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">Session not found.</p>
        <Link to="/sessions" className="text-blue-600 dark:text-blue-400 hover:underline">
          Back to sessions
        </Link>
      </div>
    );
  }

  const { balances, transactions } = calculateSettlement(session.bills, session.people);
  const nameFor = (id: string) => session.people.find((p) => p.id === id)?.name || 'Unknown';

  return (
    <div>
      <div className="mb-4 no-print">
        <Link to={`/session/${sessionId}`} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
          ← Back to Session
        </Link>
      </div>
      <h2 className="text-xl font-semibold mb-4 text-zinc-800 dark:text-white transition-colors">Settlement</h2>

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
    </div>
  );
};

export default SessionSettlementPage;
