import { useEffect, useRef, useState } from 'react';
import useSessionStore from '../sessionStore';
import { getLiveSession, listJoiners, approveJoiner, disapproveJoiner, LIVE_SERVER_URL } from '../lib/liveApi';
import { connectLiveSync, type LiveSyncStatus } from '../lib/liveSync';
import { Button, Card } from '../ui/components';
import type { Session } from '../schemas/session.schema';
import type { LiveJoiner } from '../schemas/live.schema';

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

  const code = session.liveCode;
  const creatorToken = session.liveCreatorToken;
  const sessionId = session.id;

  // Avoids stale closures inside connectLiveSync's callbacks without
  // re-subscribing every render.
  const refreshRef = useRef<() => void>(() => {});
  refreshRef.current = () => {
    if (!code) return;
    getLiveSession(code)
      .then((liveSession) => mergeLiveSnapshot(sessionId, liveSession))
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

  const pending = joiners.filter((j) => j.status === 'pending');
  const decided = joiners.filter((j) => j.status !== 'pending');

  return (
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
  );
};

export default LiveSessionPanel;
