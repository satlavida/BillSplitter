import { useEffect, useRef, useState } from 'react';
import useSessionStore from '../sessionStore';
import { getLiveSession, listJoiners, approveJoiner, disapproveJoiner, settleLiveSession, getLiveSettlement, LIVE_SERVER_URL } from '../lib/liveApi';
import { connectLiveSync, type LiveSyncStatus } from '../lib/liveSync';
import { Button, Card } from '../ui/components';
import type { Session } from '../schemas/session.schema';
import type { LiveJoiner, LiveSettlement } from '../schemas/live.schema';

interface LiveSessionPanelProps {
  session: Session;
}

const statusLabel: Record<LiveSyncStatus, string> = {
  live: 'Live',
  reconnecting: 'Reconnecting…',
  polling: 'Polling',
};

// Creator-side live view (planv3.md 3.10): subscribes to the session's SSE
// stream (falling back to polling), pulls the latest snapshot on every
// event, merges it into sessionStore by entity id, and surfaces pending
// joiners for the creator to approve/disapprove.
const LiveSessionPanel = ({ session }: LiveSessionPanelProps) => {
  const mergeLiveSnapshot = useSessionStore((s) => s.mergeLiveSnapshot);
  const [syncStatus, setSyncStatus] = useState<LiveSyncStatus>('reconnecting');
  const [joiners, setJoiners] = useState<LiveJoiner[]>([]);
  const [busyJoinerId, setBusyJoinerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSettled, setIsSettled] = useState(false);
  const [confirmingSettle, setConfirmingSettle] = useState(false);
  const [settling, setSettling] = useState(false);
  const [settlement, setSettlement] = useState<LiveSettlement | null>(null);

  const code = session.liveCode;
  const creatorToken = session.liveCreatorToken;
  const sessionId = session.id;

  // Avoids stale closures inside connectLiveSync's callbacks without
  // re-subscribing every render.
  const refreshRef = useRef<() => void>(() => {});
  refreshRef.current = () => {
    if (!code) return;
    getLiveSession(code)
      .then((liveSession) => {
        mergeLiveSnapshot(sessionId, liveSession);
        setIsSettled(liveSession.isSettled);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to sync live session'));

    if (creatorToken) {
      listJoiners(code, creatorToken)
        .then(setJoiners)
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load joiners'));
    }
  };

  useEffect(() => {
    if (!code) return;

    const handle = connectLiveSync(code, {
      baseUrl: LIVE_SERVER_URL,
      onStatusChange: setSyncStatus,
      onEvent: () => refreshRef.current(),
      onPoll: () => refreshRef.current(),
    });
    refreshRef.current();

    return () => handle.disconnect();
  }, [code, creatorToken, sessionId]);

  if (!code) return null;

  const handleApprove = async (joinerId: string) => {
    if (!creatorToken) return;
    setBusyJoinerId(joinerId);
    setError(null);
    try {
      await approveJoiner(code, joinerId, creatorToken);
      refreshRef.current();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve joiner');
    } finally {
      setBusyJoinerId(null);
    }
  };

  const handleDisapprove = async (joinerId: string) => {
    if (!creatorToken) return;
    setBusyJoinerId(joinerId);
    setError(null);
    try {
      await disapproveJoiner(code, joinerId, creatorToken);
      refreshRef.current();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disapprove joiner');
    } finally {
      setBusyJoinerId(null);
    }
  };

  const handleSettle = async () => {
    if (!creatorToken) return;
    setSettling(true);
    setError(null);
    try {
      await settleLiveSession(code, creatorToken);
      setIsSettled(true);
      setConfirmingSettle(false);
      const result = await getLiveSettlement(code);
      setSettlement(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to settle session');
    } finally {
      setSettling(false);
    }
  };

  const pending = joiners.filter((j) => j.status === 'pending');
  const decided = joiners.filter((j) => j.status !== 'pending');
  const nameFor = (personId: string) => session.people.find((p) => p.id === personId)?.name ?? 'Someone';

  return (
    <>
      <Card className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-medium text-zinc-800 dark:text-white transition-colors">Settle Up</h3>
          {creatorToken && !isSettled && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Locks the session and starts a 48h cleanup window</span>
          )}
        </div>

        {isSettled ? (
          <>
            <p className="text-sm text-green-700 dark:text-green-400 mb-2">This session has been settled.</p>
            {settlement && settlement.transactions.length > 0 && (
              <ul className="space-y-1">
                {settlement.transactions.map((t, i) => (
                  <li key={i} className="text-sm text-zinc-700 dark:text-zinc-300">
                    {nameFor(t.from)} owes {nameFor(t.to)} {t.amount.toFixed(2)}
                  </li>
                ))}
              </ul>
            )}
            {settlement && settlement.transactions.length === 0 && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Everyone's settled up — no transactions needed.</p>
            )}
          </>
        ) : creatorToken ? (
          confirmingSettle ? (
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="danger" onClick={handleSettle} disabled={settling}>
                {settling ? 'Settling…' : 'Confirm Settle'}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setConfirmingSettle(false)} disabled={settling}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => setConfirmingSettle(true)}>
              Settle Up
            </Button>
          )
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Not settled yet.</p>
        )}
      </Card>

      <Card>
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-medium text-zinc-800 dark:text-white transition-colors">Joiners</h3>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{statusLabel[syncStatus]}</span>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400 mb-2">{error}</p>}

        {joiners.length === 0 && <p className="text-sm text-zinc-500 dark:text-zinc-400">No one has joined yet.</p>}

        {pending.length > 0 && (
          <ul className="space-y-2 mb-3">
            {pending.map((joiner) => (
              <li key={joiner.id} className="flex justify-between items-center">
                <span className="text-sm text-zinc-800 dark:text-white">
                  {joiner.name}
                  {joiner.approvalCode && <span className="ml-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">{joiner.approvalCode}</span>}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleApprove(joiner.id)} disabled={busyJoinerId === joiner.id}>
                    Approve
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => handleDisapprove(joiner.id)} disabled={busyJoinerId === joiner.id}>
                    Disapprove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {decided.length > 0 && (
          <ul className="space-y-1">
            {decided.map((joiner) => (
              <li key={joiner.id} className="text-sm text-zinc-500 dark:text-zinc-400 flex justify-between">
                <span>{joiner.name}</span>
                <span className="capitalize">{joiner.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
};

export default LiveSessionPanel;
