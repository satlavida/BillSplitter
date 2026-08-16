import { useEffect, useRef, useState } from 'react';
import { getLiveSession, getLiveSettlement, LIVE_SERVER_URL } from '../../lib/liveApi';
import { connectLiveSync, type LiveEvent } from '../../lib/liveSync';
import { Alert } from '../../ui/components';
import JoinerBillList from './JoinerBillList';
import JoinerSettlementSummary from './JoinerSettlementSummary';
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
  const [session, setSession] = useState<LiveSession | null>(null);
  const [settlement, setSettlement] = useState<LiveSettlement | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Passed down to JoinerItemRow so a joiner's own pending claim can clear
  // itself on claim.rejected — a rejected claim just disappears from the
  // server's state (no allocation was ever created), so there's no other
  // signal distinguishing "still pending" from "the creator rejected it".
  // Only fires over the real SSE connection; a joiner degraded to polling
  // (see connectLiveSync's fallback) won't get this until claim.approved
  // for a *different* reason (myValue's own poll-driven update) or a
  // manual refresh — a known gap in the polling fallback.
  const [lastEvent, setLastEvent] = useState<LiveEvent | null>(null);

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
      onEvent: (event) => {
        setLastEvent(event);
        refreshRef.current();
      },
      onPoll: () => refreshRef.current(),
    });
    return () => handle.disconnect();
  }, [code]);

  if (!session) {
    return <p className="text-zinc-600 dark:text-zinc-400 transition-colors">Loading session…</p>;
  }

  const nameFor = (personId: string) => session.people.find((p) => p.id === personId)?.name ?? 'Someone';

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1 text-zinc-800 dark:text-white transition-colors">{session.title}</h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">You're in! Add items or claim what's yours.</p>

      {session.isSettled && (
        <Alert type="info" className="mb-4">
          The host has settled this session — items are read-only now.
        </Alert>
      )}

      {error && <Alert type="error" className="mb-4">{error}</Alert>}

      <JoinerBillList
        code={code}
        bills={session.bills}
        myPersonId={myPersonId}
        joinerToken={joinerToken}
        nameFor={nameFor}
        disabled={session.isSettled}
        onChanged={refreshRef.current}
        lastEvent={lastEvent}
      />

      <JoinerSettlementSummary settlement={settlement} myPersonId={myPersonId} nameFor={nameFor} />
    </div>
  );
};

export default JoinerSessionView;
