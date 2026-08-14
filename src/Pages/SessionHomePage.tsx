import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useShallow } from 'zustand/shallow';
import useSessionStore from '../sessionStore';
import { Button, Card } from '../ui/components';
import EditableTitle from '../Components/EditableTitle';

const SessionHomePage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const session = useSessionStore(useShallow((s) => (sessionId ? s.sessions.find((sess) => sess.id === sessionId) : undefined)));
  const { addBill, setSessionTitle, setCurrentSession } = useSessionStore(
    useShallow((s) => ({
      addBill: s.addBill,
      setSessionTitle: s.setSessionTitle,
      setCurrentSession: s.setCurrentSession,
    }))
  );

  useEffect(() => {
    if (sessionId) setCurrentSession(sessionId);
  }, [sessionId, setCurrentSession]);

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

  const handleAddBill = () => {
    const bill = addBill(sessionId);
    if (bill) navigate(`/session/${sessionId}/bill/${bill.id}`);
  };

  return (
    <div>
      <EditableTitle title={session.title} onSave={(title) => setSessionTitle(sessionId, title)} placeholder="Untitled Session" />

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-zinc-800 dark:text-white transition-colors">Bills</h2>
        <Button onClick={handleAddBill}>Add Bill</Button>
      </div>

      {session.bills.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400 mb-6">No bills yet. Add one to get started.</p>
      ) : (
        <ul className="space-y-2 mb-6">
          {session.bills.map((bill) => (
            <li key={bill.id}>
              <Card className="mb-0 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700" onClick={() => navigate(`/session/${sessionId}/bill/${bill.id}`)}>
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium text-zinc-800 dark:text-white transition-colors">{bill.title}</span>
                    <span className="block text-xs text-zinc-500 dark:text-zinc-400 transition-colors">
                      {new Date(bill.date).toLocaleDateString()}
                    </span>
                  </div>
                  {bill.paidByPersonId && (
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 transition-colors">
                      Paid by {session.people.find((p) => p.id === bill.paidByPersonId)?.name || '—'}
                    </span>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => navigate(`/session/${sessionId}/settlement`)}>
          View Settlement
        </Button>
        <Button variant="secondary" disabled title="Coming in a future update">
          Go Live
        </Button>
      </div>
    </div>
  );
};

export default SessionHomePage;
