import { useEffect, useState, type MouseEvent } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useShallow } from 'zustand/shallow';
import useSessionStore from '../sessionStore';
import { Button, Card, Alert, Spinner, Modal, SearchSelect, BackLink, IconButton, Heading } from '../ui/components';
import EditableTitle from '../Components/EditableTitle';
import GoLiveSection from '../Components/GoLiveSection';
import LiveSessionPanel from '../Components/LiveSessionPanel';
import PeopleSection from '../Components/PeopleSection';
import SessionSettingsModal from '../Components/SessionSettingsModal';
import ThingsToTakeCareOf from '../Components/ThingsToTakeCareOf';
import UpiNudge from '../Components/UpiNudge';
import PaymentsSection from '../Components/Payments/PaymentsSection';
import { calculateSettlement, isSessionSettledByPayments } from '../lib/settlement';
import { scanBillReceipt } from '../lib/receiptScan';
import { resolveSelfPersonId } from '../lib/selfPerson';
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
  const { addBill, deleteBill, setSessionTitle, setCurrentSession, setBillPaidBy, setSessionCurrency, setRequirePaymentVerification, updatePerson } =
    useSessionStore(
      useShallow((s) => ({
        addBill: s.addBill,
        deleteBill: s.deleteBill,
        setSessionTitle: s.setSessionTitle,
        setCurrentSession: s.setCurrentSession,
        setBillPaidBy: s.setBillPaidBy,
        setSessionCurrency: s.setSessionCurrency,
        setRequirePaymentVerification: s.setRequirePaymentVerification,
        updatePerson: s.updatePerson,
      }))
    );

  const [paidByEditBillId, setPaidByEditBillId] = useState<string | null>(null);
  const [sessionSettingsOpen, setSessionSettingsOpen] = useState(false);

  useEffect(() => {
    if (sessionId) setCurrentSession(sessionId);
  }, [sessionId, setCurrentSession]);

  if (!sessionId || !session) {
    return (
      <div>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">Session not found.</p>
        <BackLink to="/sessions">Back to sessions</BackLink>
      </div>
    );
  }

  const handleAddBill = () => {
    const bill = addBill(sessionId);
    if (bill) navigate(`/session/${sessionId}/bill/${bill.id}`);
  };

  // Creates an empty bill then lands directly in its Items step with the
  // scan modal already open (ScanReceiptButton.tsx's autoOpenScan nav-state
  // effect), rather than making the user create a bill and then find/click
  // Scan Receipt themselves.
  const handleScanNewBill = () => {
    // If we can tell who's scanning (auto-add-self matches an existing
    // session person), default the bill's payer to them — mirrors the same
    // default applied on the joiner side (JoinerScanReceiptButton.tsx).
    const bill = addBill(sessionId, { paidByPersonId: resolveSelfPersonId(session.people) });
    if (bill) navigate(`/session/${sessionId}/bill/${bill.id}/step/1`, { state: { autoOpenScan: true } });
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

  // Whether the creator (if they've picked their own identity) is currently
  // owed money — drives the UpiNudge below. See architecture/payments.md.
  const { balances } = calculateSettlement(session.bills, session.people, session.currency, session.payments);
  const creatorPerson = session.people.find((p) => p.id === session.creatorPersonId);
  const creatorOwedMoney = (balances.find((b) => b.personId === session.creatorPersonId)?.amount ?? 0) > 0.005;

  const paymentsSettled = isSessionSettledByPayments(session.bills, session.people, session.currency, session.payments);
  const paymentsSection = <PaymentsSection session={session} />;

  // Removes the bill locally immediately; if the session is live, also
  // soft-deletes it server-side (deleteBill's internal push) so it
  // disappears for joiners too, but stays recoverable by the creator via
  // the Activity Log's Restore action until permanently removed there.
  const handleDeleteBill = (e: MouseEvent, billId: string, title: string) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${title}"? ${session.isLive ? 'You can restore it later from the Activity Log.' : "This can't be undone."}`)) return;
    deleteBill(sessionId, billId);
  };

  return (
    <div>
      <div className="flex justify-between items-start gap-2">
        <EditableTitle title={session.title} onSave={(title) => setSessionTitle(sessionId, title)} placeholder="Untitled Session" />
        <IconButton
          onClick={() => setSessionSettingsOpen(true)}
          aria-label="Session Settings"
          title="Session Settings"
          className="shrink-0"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
      </div>

      <PeopleSection session={session} />

      {creatorPerson && (
        <UpiNudge
          owedMoney={creatorOwedMoney}
          myPersonUpiId={creatorPerson.upiId}
          onSave={async (upiId) => updatePerson(sessionId, creatorPerson.id, { upiId })}
        />
      )}

      <ThingsToTakeCareOf session={session} />

      {paymentsSettled && paymentsSection}

      <div className="flex justify-between items-center mb-4">
        <Heading margin="none">Bills</Heading>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleScanNewBill}>Scan New Bill</Button>
          <Button onClick={handleAddBill}>Add Bill</Button>
        </div>
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
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPaidByEditBillId(bill.id);
                      }}
                    >
                      Paid by {session.people.find((p) => p.id === bill.paidByPersonId)?.name || '—'}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={(e) => handleDeleteBill(e, bill.id, bill.title)}
                      aria-label={`Delete ${bill.title}`}
                      title="Delete bill"
                    >
                      Delete
                    </Button>
                  </div>
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

      {!paymentsSettled && paymentsSection}

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

      <SessionSettingsModal
        session={session}
        isOpen={sessionSettingsOpen}
        onClose={() => setSessionSettingsOpen(false)}
        onCurrencyChange={(currency) => setSessionCurrency(sessionId, currency)}
        onRequirePaymentVerificationChange={(value) => setRequirePaymentVerification(sessionId, value)}
      />
    </div>
  );
};

export default SessionHomePage;
