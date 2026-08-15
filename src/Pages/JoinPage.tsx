import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getLiveSession, joinLiveSession, getJoiner, claimItem, LiveApiError, LIVE_SERVER_URL } from '../lib/liveApi';
import { connectLiveSync } from '../lib/liveSync';
import { getStoredJoinerId, setStoredJoinerId, clearStoredJoinerId } from '../lib/joinerStorage';
import type { LiveSession, LiveJoiner } from '../schemas/live.schema';
import { Button, Card, Alert } from '../ui/components';

type LoadState = 'loading' | 'ready' | 'not-found' | 'error';

/**
 * Live-session join flow (planv3.md 3.10): loads the session's public state
 * by code, lets the joiner pick an existing person or enter a new name,
 * then shows a pending-approval state (with the 2-digit code) or immediate
 * admission depending on the session's join_mode.
 */
const JoinPage = () => {
  const { code } = useParams<{ code: string }>();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [session, setSession] = useState<LiveSession | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joiner, setJoiner] = useState<LiveJoiner | null>(null);
  const [claimingItemId, setClaimingItemId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  // Items with a claim awaiting the host's approval (claims_require_approval
  // mode). Not reflected in item.consumedBy until approved, so tracked
  // locally to avoid letting this joiner double-submit while waiting.
  const [pendingItemIds, setPendingItemIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!code) return;
    let cancelled = false;

    getLiveSession(code)
      .then((sess) => {
        if (cancelled) return;
        setSession(sess);
        setLoadState('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadState(err instanceof LiveApiError && err.status === 404 ? 'not-found' : 'error');
      });

    return () => {
      cancelled = true;
    };
  }, [code]);

  // Restore this browser's place in the session on load/refresh, if we've
  // joined before (see joinerStorage.ts).
  useEffect(() => {
    if (!code) return;
    const storedId = getStoredJoinerId(code);
    if (!storedId) return;
    let cancelled = false;

    getJoiner(code, storedId)
      .then((restored) => {
        if (cancelled) return;
        if (restored.status === 'disapproved') {
          clearStoredJoinerId(code);
          return;
        }
        setJoiner(restored);
      })
      .catch(() => {
        // Stored joiner no longer exists (session purged, etc.) — clear so
        // this doesn't keep failing on every future visit.
        clearStoredJoinerId(code);
      });

    return () => {
      cancelled = true;
    };
  }, [code]);

  // While pending, poll for the creator's approve/disapprove decision —
  // there's no push channel a not-yet-admitted joiner can subscribe to, so
  // this is a plain interval rather than connectLiveSync.
  useEffect(() => {
    if (!code || !joiner || joiner.status !== 'pending') return;
    const joinerId = joiner.id;
    const interval = setInterval(() => {
      getJoiner(code, joinerId)
        .then((updated) => {
          if (updated.status === 'disapproved') clearStoredJoinerId(code);
          if (updated.status !== 'pending') setJoiner(updated);
        })
        .catch(() => {
          // Transient polling failures aren't worth surfacing — retried
          // on the next tick.
        });
    }, 3000);
    return () => clearInterval(interval);
  }, [code, joiner]);

  // Once admitted, keep the bill/item list live so claims made by this
  // joiner or anyone else show up without a manual reload.
  const refreshRef = useRef<() => void>(() => {});
  refreshRef.current = () => {
    if (!code) return;
    getLiveSession(code)
      .then(setSession)
      .catch(() => {
        // Transient refresh failures aren't worth surfacing — the next
        // poll/event will retry.
      });
  };

  useEffect(() => {
    if (!code || !joiner || joiner.status !== 'approved') return;
    const handle = connectLiveSync(code, {
      baseUrl: LIVE_SERVER_URL,
      onStatusChange: () => {},
      onEvent: () => refreshRef.current(),
      onPoll: () => refreshRef.current(),
    });
    return () => handle.disconnect();
  }, [code, joiner]);

  if (!code) return null;

  if (loadState === 'loading') {
    return <p className="text-zinc-600 dark:text-zinc-400 transition-colors">Loading session…</p>;
  }

  if (loadState === 'not-found') {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold mb-2 text-zinc-800 dark:text-white transition-colors">Session not found</h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4 transition-colors">The code "{code}" doesn't match a live session.</p>
        <Link to="/" className="text-blue-600 dark:text-blue-400 hover:underline">
          Go home
        </Link>
      </div>
    );
  }

  if (loadState === 'error' || !session) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold mb-2 text-zinc-800 dark:text-white transition-colors">Couldn't reach the live server</h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4 transition-colors">Check your connection and try again.</p>
        <Link to="/" className="text-blue-600 dark:text-blue-400 hover:underline">
          Go home
        </Link>
      </div>
    );
  }

  if (joiner && joiner.status === 'pending') {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold mb-2 text-zinc-800 dark:text-white transition-colors">{session.title}</h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-2 transition-colors">Waiting for the host to approve you.</p>
        <p className="text-zinc-800 dark:text-white transition-colors">
          Tell the host your code: <span className="font-mono font-semibold text-lg">{joiner.approvalCode}</span>
        </p>
      </div>
    );
  }

  if (joiner && joiner.status === 'disapproved') {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold mb-2 text-zinc-800 dark:text-white transition-colors">{session.title}</h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4 transition-colors">The host didn't approve your request to join.</p>
        <Button onClick={() => setJoiner(null)}>Try again</Button>
      </div>
    );
  }

  if (joiner && joiner.status === 'approved') {
    const myPersonId = joiner.personId;
    const nameFor = (personId: string) => session.people.find((p) => p.id === personId)?.name ?? 'Someone';

    const handleClaim = async (billId: string, itemId: string) => {
      if (!myPersonId) return;
      setClaimingItemId(itemId);
      setClaimError(null);
      try {
        const result = await claimItem(code, billId, itemId, myPersonId);
        if (result.status === 'pending') {
          setPendingItemIds((prev) => new Set(prev).add(itemId));
        }
        refreshRef.current();
      } catch (err) {
        setClaimError(err instanceof LiveApiError ? err.message : 'Failed to claim item');
      } finally {
        setClaimingItemId(null);
      }
    };

    return (
      <div>
        <h2 className="text-xl font-semibold mb-1 text-zinc-800 dark:text-white transition-colors">{session.title}</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">You're in! Tap an item to claim it.</p>

        {session.isSettled && (
          <Alert type="info" className="mb-4">
            The host has settled this session — items are read-only now.
          </Alert>
        )}

        {claimError && <Alert type="error" className="mb-4">{claimError}</Alert>}

        {session.bills.length === 0 && <p className="text-zinc-500 dark:text-zinc-400">No bills yet.</p>}

        {session.bills.map((bill) => (
          <Card key={bill.id} className="mb-3">
            <h3 className="font-medium mb-2 text-zinc-800 dark:text-white transition-colors">{bill.title}</h3>
            {bill.imageRefKey && (
              <img
                src={`${LIVE_SERVER_URL}/api/images/${bill.imageRefKey}`}
                alt="Receipt"
                className="mb-3 max-h-48 rounded border border-zinc-200 dark:border-zinc-700"
              />
            )}
            {bill.items.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">No items yet.</p>
            ) : (
              <ul className="space-y-2">
                {bill.items.map((item) => {
                  const claimedByMe = myPersonId ? item.consumedBy.some((c) => c.personId === myPersonId) : false;
                  const isPending = !claimedByMe && pendingItemIds.has(item.id);
                  return (
                    <li key={item.id} className="flex justify-between items-center">
                      <div>
                        <span className="text-zinc-800 dark:text-white transition-colors">{item.name}</span>
                        <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                          {bill.currency} {item.price.toFixed(2)}
                        </span>
                        {item.consumedBy.length > 0 && (
                          <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                            Claimed by {item.consumedBy.map((c) => nameFor(c.personId)).join(', ')}
                          </span>
                        )}
                        {isPending && <span className="block text-xs text-amber-600 dark:text-amber-400">Awaiting host approval…</span>}
                      </div>
                      <Button
                        size="sm"
                        variant={claimedByMe ? 'secondary' : 'primary'}
                        disabled={claimedByMe || isPending || claimingItemId === item.id || !myPersonId || session.isSettled}
                        onClick={() => handleClaim(bill.id, item.id)}
                      >
                        {claimedByMe ? 'Claimed' : isPending ? 'Pending' : claimingItemId === item.id ? 'Claiming…' : 'Claim'}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        ))}
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!selectedPersonId && !name.trim()) {
      setError('Enter your name or pick an existing person');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await joinLiveSession(code, name.trim(), selectedPersonId || null);
      setStoredJoinerId(code, result.id);
      setJoiner(result);
    } catch (err) {
      setError(err instanceof LiveApiError ? err.message : 'Failed to join');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 text-zinc-800 dark:text-white transition-colors">Join {session.title}</h2>

      {error && <Alert type="error" className="mb-4">{error}</Alert>}

      <Card>
        {session.people.length > 0 && (
          <div className="mb-3">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">I am…</label>
            <select
              value={selectedPersonId}
              onChange={(e) => {
                setSelectedPersonId(e.target.value);
                if (e.target.value) setName('');
              }}
              className="w-full p-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-800 dark:text-white"
            >
              <option value="">Someone new</option>
              {session.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {!selectedPersonId && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Your name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full p-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white"
            />
          </div>
        )}

        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Joining…' : 'Join'}
        </Button>
      </Card>
    </div>
  );
};

export default JoinPage;
