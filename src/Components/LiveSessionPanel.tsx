import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import useSessionStore from '../sessionStore';
import { getLiveSession, listJoiners, approveJoiner, disapproveJoiner, settleLiveSession, getLiveSettlement, getActivityLog, LIVE_SERVER_URL } from '../lib/liveApi';
import { connectLiveSync, createStaleResponseGuard, type LiveSyncStatus } from '../lib/liveSync';
import { formatActivityLine } from '../lib/activityLine';
import useToastStore from '../toastStore';
import { Button, Card } from '../ui/components';
import type { Session } from '../schemas/session.schema';
import type { LiveJoiner, LiveSettlement } from '../schemas/live.schema';

// Diffs a freshly-fetched joiners list against the previous one and pushes
// a toast for anything a viewer would want to notice without having this
// panel open: a brand-new joiner (pending approval, or already admitted in
// open_link mode) or a formerly-pending one getting approved/declined.
const toastJoinerChanges = (previous: LiveJoiner[], next: LiveJoiner[], pushToast: (message: string, kind?: 'info' | 'success' | 'error') => void) => {
  const previousById = new Map(previous.map((j) => [j.id, j]));
  for (const joiner of next) {
    const before = previousById.get(joiner.id);
    if (!before) {
      if (joiner.status === 'approved') pushToast(`${joiner.name} joined`, 'success');
      else if (joiner.status === 'pending') pushToast(`${joiner.name} wants to join`, 'info');
      continue;
    }
    if (before.status === joiner.status) continue;
    if (joiner.status === 'approved') pushToast(`${joiner.name} joined`, 'success');
    else if (joiner.status === 'disapproved') pushToast(`${joiner.name}'s request was declined`, 'info');
  }
};

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
  const pushToast = useToastStore((s) => s.pushToast);

  const code = session.liveCode;
  const creatorToken = session.liveCreatorToken;
  const sessionId = session.id;

  // Avoids stale closures inside connectLiveSync's callbacks without
  // re-subscribing every render.
  const refreshRef = useRef<() => void>(() => {});
  // See createStaleResponseGuard's comment: a burst of SSE events from a
  // single edit can trigger overlapping getLiveSession() calls that
  // resolve out of order — this guard keeps only the latest-issued one's
  // result. One instance for the component's lifetime, not per-render.
  const staleGuardRef = useRef(createStaleResponseGuard());
  // Previous joiners list, for diffing new/changed entries into toasts
  // (toastJoinerChanges) without waiting for a state update to land.
  const joinersRef = useRef<LiveJoiner[]>([]);
  // Whether the joiners list has been fetched at least once since this
  // component mounted — like lastToastedActivityIdRef below, this stops the
  // first fetch after a remount (joinersRef always starts at []) from
  // re-toasting "X joined" for every already-approved joiner.
  const hasLoadedJoinersRef = useRef(false);
  // Newest activity entry id already surfaced as a toast, so the first
  // fetch after mount (which may already have history) doesn't toast every
  // pre-existing entry — only genuinely new ones from here on.
  const lastToastedActivityIdRef = useRef<number | null>(null);
  refreshRef.current = () => {
    if (!code) return;
    staleGuardRef.current(getLiveSession(code), (liveSession) => {
      mergeLiveSnapshot(sessionId, liveSession);
      setIsSettled(liveSession.isSettled);
    }).catch((err) => setError(err instanceof Error ? err.message : 'Failed to sync live session'));

    if (creatorToken) {
      listJoiners(code, creatorToken)
        .then((next) => {
          if (hasLoadedJoinersRef.current) {
            toastJoinerChanges(joinersRef.current, next, pushToast);
          } else {
            hasLoadedJoinersRef.current = true;
          }
          joinersRef.current = next;
          setJoiners(next);
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load joiners'));
    }

    // Fetched unconditionally (not gated on isSettled) — settlement is
    // computed from claims regardless of settled state (server/internal/api
    // /settlement.go), so "who pays whom" should stay visible whether or
    // not the session has been settled, and survive a reload/remount
    // instead of only appearing right after clicking Settle Up.
    getLiveSettlement(code)
      .then(setSettlement)
      .catch(() => {
        // Best-effort — the settle-up card just won't show a transaction
        // list this refresh, retried on the next SSE event/poll.
      });
  };

  // Refetches the activity log only in response to an activity.created SSE
  // event (not on every poll/refresh — this is a separate, creator-token-
  // gated endpoint, not worth hitting on every tick) and toasts the newest
  // entry, e.g. "Dana claimed 2 parts of Pizza". Ref-wrapped like
  // refreshRef above, so the effect below doesn't need it in its deps.
  const toastLatestActivityRef = useRef<() => void>(() => {});
  toastLatestActivityRef.current = () => {
    if (!code || !creatorToken) return;
    getActivityLog(code, creatorToken)
      .then((entries) => {
        const newest = entries[0];
        if (!newest) return;
        if (lastToastedActivityIdRef.current === null) {
          // First load after mount — record where we are without toasting
          // the whole pre-existing history.
          lastToastedActivityIdRef.current = newest.id;
          return;
        }
        if (newest.id !== lastToastedActivityIdRef.current) {
          lastToastedActivityIdRef.current = newest.id;
          pushToast(formatActivityLine(newest));
        }
      })
      .catch(() => {
        // Best-effort, matching this component's other secondary fetches.
      });
  };

  useEffect(() => {
    if (!code) return;

    const handle = connectLiveSync(code, {
      baseUrl: LIVE_SERVER_URL,
      onStatusChange: setSyncStatus,
      onEvent: (event) => {
        refreshRef.current();
        if (event.kind === 'activity.created') toastLatestActivityRef.current();
      },
      onPoll: () => refreshRef.current(),
    });
    refreshRef.current();
    toastLatestActivityRef.current();

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
      refreshRef.current();
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

        {isSettled && <p className="text-sm text-green-700 dark:text-green-400 mb-2">This session has been settled.</p>}

        {/* Who-pays-whom stays visible whether or not the session has been
            settled — settlement is computed from claims either way (see
            refreshRef.current above), it isn't something settling unlocks. */}
        {settlement && settlement.transactions.length > 0 && (
          <ul className="space-y-1 mb-2">
            {settlement.transactions.map((t, i) => (
              <li key={i} className="text-sm text-zinc-700 dark:text-zinc-300">
                {nameFor(t.from)} owes {nameFor(t.to)} {t.amount.toFixed(2)}
              </li>
            ))}
          </ul>
        )}
        {settlement && settlement.transactions.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">Everyone's settled up — no transactions needed.</p>
        )}

        {!isSettled &&
          (creatorToken ? (
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
          ))}
      </Card>

      <Card>
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-medium text-zinc-800 dark:text-white transition-colors">Joiners</h3>
          <div className="flex items-center gap-3">
            {creatorToken && (
              <Link to={`/session/${sessionId}/activity`} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                Activity log
              </Link>
            )}
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{statusLabel[syncStatus]}</span>
          </div>
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
