import { useEffect, useState, type MouseEvent } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useShallow } from 'zustand/shallow';
import useSessionStore from '../sessionStore';
import { Button, Card, Alert, Spinner, Modal, SearchSelect } from '../ui/components';
import EditableTitle from '../Components/EditableTitle';
import GoLiveSection from '../Components/GoLiveSection';
import LiveSessionPanel from '../Components/LiveSessionPanel';
import PeopleSection from '../Components/PeopleSection';
import { scanBillReceipt } from '../lib/receiptScan';
import type { Bill } from '../schemas/session.schema';
import type { Person } from '../schemas/bill.schema';

const SCAN_ERROR_COPY: Record<'offline' | 'failed', string> = {
  offline: 'Scanning service is unreachable. Check your connection and try again.',
  failed: "Couldn't read that receipt. Try again, or dismiss and enter items manually.",
};

interface PaidByEditModalProps {
  bill: Bill | null;
  people: Person[];
  onClose: () => void;
  onSave: (personId: string | null) => void;
}

// Req 3: quick-edit "Paid by" from the session home page's bill card,
// instead of having to open the bill and step through the wizard.
const PaidByEditModal = ({ bill, people, onClose, onSave }: PaidByEditModalProps) => (
  <Modal isOpen={Boolean(bill)} onClose={onClose} title={`Paid by — ${bill?.title ?? ''}`}>
    <SearchSelect
      value={bill?.paidByPersonId ?? ''}
      onChange={(value) => {
        onSave(value || null);
        onClose();
      }}
      placeholder="No one selected"
      searchPlaceholder="Search people..."
      options={[{ value: '', label: 'No one' }, ...people.map((p) => ({ value: p.id, label: p.name }))]}
    />
    <div className="flex justify-end mt-4">
      <Button variant="secondary" onClick={onClose}>
        Close
      </Button>
    </div>
  </Modal>
);

const SessionHomePage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const autoExpandGoLive = Boolean((location.state as { goLive?: boolean } | null)?.goLive);

  const session = useSessionStore(useShallow((s) => (sessionId ? s.sessions.find((sess) => sess.id === sessionId) : undefined)));
  const { addBill, setSessionTitle, setCurrentSession, setBillPaidBy } = useSessionStore(
    useShallow((s) => ({
      addBill: s.addBill,
      setSessionTitle: s.setSessionTitle,
      setCurrentSession: s.setCurrentSession,
      setBillPaidBy: s.setBillPaidBy,
    }))
  );

  const [paidByEditBillId, setPaidByEditBillId] = useState<string | null>(null);

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

      <PeopleSection session={session} />

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-zinc-800 dark:text-white transition-colors">Bills</h2>
        <Button onClick={handleAddBill}>Add Bill</Button>
      </div>

      {session.bills.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400 mb-6">No bills yet. Add one to get started.</p>
      ) : (
        <ul className="space-y-2 mb-6" data-testid="bill-list">
          {session.bills.map((bill) => {
            const hasUnclaimedItems = bill.items.some((item) => item.consumedBy.length === 0);
            return (
            <li key={bill.id}>
              <Card className="mb-0 p-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700" onClick={() => navigate(`/session/${sessionId}/bill/${bill.id}`)}>
                <div className="flex justify-between items-center gap-2">
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
                    {hasUnclaimedItems && (
                      <span className="inline-block mt-1 text-xs font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        Unclaimed items
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPaidByEditBillId(bill.id);
                    }}
                    className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors shrink-0"
                  >
                    Paid by {session.people.find((p) => p.id === bill.paidByPersonId)?.name || '—'}
                  </button>
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
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        <Button variant="secondary" onClick={() => navigate(`/session/${sessionId}/settlement`)}>
          View Settlement
        </Button>
      </div>

      <GoLiveSection session={session} autoExpand={autoExpandGoLive} />
      {session.isLive && (
        <div className="mt-4">
          <LiveSessionPanel session={session} />
        </div>
      )}

      <PaidByEditModal
        bill={session.bills.find((b) => b.id === paidByEditBillId) ?? null}
        people={session.people}
        onClose={() => setPaidByEditBillId(null)}
        onSave={(personId) => {
          if (paidByEditBillId) setBillPaidBy(sessionId, paidByEditBillId, personId);
        }}
      />
    </div>
  );
};

export default SessionHomePage;
