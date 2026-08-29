import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLiveSession, getLiveSettlement, addLiveBill, LIVE_SERVER_URL } from '../../lib/liveApi';
import { connectLiveSync } from '../../lib/liveSync';
import { usePresenceHeartbeat } from '../../hooks/usePresenceHeartbeat';
import { generateId } from '../../lib/generateId';
import { Alert, Button } from '../../ui/components';
import JoinerBillList from './JoinerBillList';
import JoinerSettlementSummary from './JoinerSettlementSummary';
import JoinerUpiNudge from './JoinerUpiNudge';
import type { LiveSession, LiveSettlement } from '../../schemas/live.schema';

interface JoinerSessionViewProps {
  code: string;
  myPersonId: string;
  joinerToken: string;
}

// The full in-session joiner experience, once admitted: live bill list
// (view/add items/claim-unclaim) plus a personal settlement summary. Owns
// its own session fetch + live-sync subscription, independent of JoinPage's
// pre-approval state.
const JoinerSessionView = ({ code, myPersonId, joinerToken }: JoinerSessionViewProps) => {
  const navigate = useNavigate();
  const [session, setSession] = useState<LiveSession | null>(null);
  const [settlement, setSettlement] = useState<LiveSettlement | null>(null);
  const [error, setError] = useState<string | null>(null);

  usePresenceHeartbeat(code, myPersonId, joinerToken);

  const refreshRef = useRef<() => void>(() => {});
  refreshRef.current = () => {
    getLiveSession(code)
      .then(setSession)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load session'));
    getLiveSettlement(code)
      .then(setSettlement)
      .catch(() => {
        // Settlement is a secondary view — a transient failure here isn't
        // worth surfacing over the primary bill list's own error state.
      });
  };

  useEffect(() => {
    refreshRef.current();
    const handle = connectLiveSync(code, {
      baseUrl: LIVE_SERVER_URL,
      onStatusChange: () => {},
      onEvent: () => refreshRef.current(),
      onPoll: () => refreshRef.current(),
    });
    return () => handle.disconnect();
  }, [code]);

  if (!session) {
    return <p className="text-zinc-600 dark:text-zinc-400 transition-colors">Loading session…</p>;
  }

  const nameFor = (personId: string) => session.people.find((p) => p.id === personId)?.name ?? 'Someone';
  const readOnly = session.isSettled || session.permissionMode === 'read_only';

  // Mirrors SessionHomePage.tsx's handleAddBill/handleScanNewBill for the
  // creator, but pushes straight to the live server (addLiveBill) since a
  // joiner has no local sessionStore to create the bill in first. The
  // client-supplied id lets the newly-created bill be navigated to
  // immediately without waiting for a refetch.
  const handleAddBill = async () => {
    const id = generateId();
    try {
      await addLiveBill(code, { id, title: 'Untitled Bill', currency: session.currency, taxAmount: 0 }, joinerToken);
      navigate(`/join/${code}/bills/${id}/step/1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add bill');
    }
  };

  // Same as handleAddBill, but lands directly on step 1 with the scan modal
  // already open (JoinerBillEditorPage.tsx's autoOpenScan nav-state flag).
  const handleScanNewBill = async () => {
    const id = generateId();
    try {
      await addLiveBill(code, { id, title: 'Untitled Bill', currency: session.currency, taxAmount: 0 }, joinerToken);
      navigate(`/join/${code}/bills/${id}/step/1`, { state: { autoOpenScan: true } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add bill');
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1 text-zinc-800 dark:text-white transition-colors">{session.title}</h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
        {session.permissionMode === 'read_only' ? "You're in! You can view the host's changes here." : "You're in! Add items or claim what's yours."}
      </p>

      {session.isSettled && (
        <Alert type="info" className="mb-4">
          The host has settled this session — items are read-only now.
        </Alert>
      )}

      {error && <Alert type="error" className="mb-4">{error}</Alert>}

      <JoinerUpiNudge
        code={code}
        myPersonId={myPersonId}
        myPersonUpiId={session.people.find((p) => p.id === myPersonId)?.upiId ?? ''}
        joinerToken={joinerToken}
        settlement={settlement}
        onSaved={refreshRef.current}
      />

      {!readOnly && (
        <div className="flex justify-end gap-2 mb-2">
          <Button variant="secondary" size="sm" onClick={handleScanNewBill}>
            Scan New Bill
          </Button>
          <Button size="sm" onClick={handleAddBill}>
            Add Bill
          </Button>
        </div>
      )}

      <JoinerBillList code={code} bills={session.bills} myPersonId={myPersonId} joinerToken={joinerToken} disabled={readOnly} onChanged={refreshRef.current} />

      <div className="mt-4">
        <JoinerSettlementSummary settlement={settlement} myPersonId={myPersonId} nameFor={nameFor} bills={session.bills} people={session.people} />
      </div>
    </div>
  );
};

export default JoinerSessionView;
