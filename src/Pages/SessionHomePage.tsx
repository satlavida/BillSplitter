import { useEffect, type MouseEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useShallow } from 'zustand/shallow';
import useSessionStore from '../sessionStore';
import { Button, Card, Alert, Spinner } from '../ui/components';
import EditableTitle from '../Components/EditableTitle';
import GoLiveSection from '../Components/GoLiveSection';
import LiveSessionPanel from '../Components/LiveSessionPanel';
import { scanBillReceipt } from '../lib/receiptScan';

const SCAN_ERROR_COPY: Record<'offline' | 'failed', string> = {
  offline: 'Scanning service is unreachable. Check your connection and try again.',
  failed: "Couldn't read that receipt. Try again, or dismiss and enter items manually.",
};

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

  const handleRetryScan = (e: MouseEvent, billId: string) => {
    e.stopPropagation();
    useSessionStore.getState().updateBill(sessionId, billId, { scanStatus: 'processing', scanError: null });
    void scanBillReceipt(sessionId, billId);
  };

  const handleDismissScanError = (e: MouseEvent, billId: string) => {
    e.stopPropagation();
    useSessionStore.getState().updateBill(sessionId, billId, { scanStatus: 'idle', scanError: null });
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
                    <span className="font-medium text-zinc-800 dark:text-white transition-colors flex items-center gap-2">
                      {bill.title}
                      {bill.scanStatus === 'processing' && (
                        <span title="Scanning receipt...">
                          <Spinner size="sm" />
                        </span>
                      )}
                    </span>
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
              {bill.scanStatus === 'error' && (
                <Alert type="warning" className="mt-1 mb-3">
                  <p className="mb-2">{SCAN_ERROR_COPY[bill.scanError ?? 'failed']}</p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={(e) => handleRetryScan(e, bill.id)}>
                      Retry
                    </Button>
                    <Button size="sm" variant="secondary" onClick={(e) => handleDismissScanError(e, bill.id)}>
                      Dismiss
                    </Button>
                  </div>
                </Alert>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        <Button variant="secondary" onClick={() => navigate(`/session/${sessionId}/settlement`)}>
          View Settlement
        </Button>
      </div>

      <GoLiveSection session={session} />
      {session.isLive && (
        <div className="mt-4">
          <LiveSessionPanel session={session} />
        </div>
      )}
    </div>
  );
};

export default SessionHomePage;
