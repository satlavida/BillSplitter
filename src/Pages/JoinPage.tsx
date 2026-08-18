import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getLiveSession, joinLiveSession, getJoiner, LiveApiError } from '../lib/liveApi';
import { getStoredJoinerId, setStoredJoinerId, clearStoredJoinerId, getStoredJoinerToken, setStoredJoinerToken } from '../lib/joinerStorage';
import { recordJoinedSession } from '../lib/joinedSessionsStorage';
import JoinerSessionView from '../Components/joiner/JoinerSessionView';
import type { LiveSession, LiveJoiner } from '../schemas/live.schema';
import { Button, Card, Alert, SearchSelect } from '../ui/components';

// Captures a joiner's secret token into storage the moment it's observed —
// the server only ever includes it once (see live.schema.ts's LiveJoiner
// .token comment), so every response that might carry it must be checked.
const captureToken = (code: string, joiner: LiveJoiner) => {
  if (joiner.token) setStoredJoinerToken(code, joiner.token);
};

type LoadState = 'loading' | 'ready' | 'not-found' | 'error';

/**
 * Live-session join flow (planv3.md 3.10): loads the session's public state
 * by code, lets the joiner pick an existing person or enter a new name,
 * then shows a pending-approval state (with the 2-digit code) or immediate
 * admission depending on the session's join_mode. Once approved, hands off
 * to JoinerSessionView for the actual in-session experience.
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
        captureToken(code, restored);
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
  // this is a plain interval rather than connectLiveSync. This is also the
  // moment an approval_code-mode joiner's token first arrives (see
  // GetJoiner's one-time reveal).
  useEffect(() => {
    if (!code || !joiner || joiner.status !== 'pending') return;
    const joinerId = joiner.id;
    const interval = setInterval(() => {
      getJoiner(code, joinerId)
        .then((updated) => {
          if (updated.status === 'disapproved') clearStoredJoinerId(code);
          if (updated.status !== 'pending') {
            captureToken(code, updated);
            setJoiner(updated);
          }
        })
        .catch(() => {
          // Transient polling failures aren't worth surfacing — retried
          // on the next tick.
        });
    }, 3000);
    return () => clearInterval(interval);
  }, [code, joiner]);

  // Records/refreshes this browser's entry in the "sessions I've joined"
  // index (joinedSessionsStorage.ts) whenever we know who we are here —
  // covers a fresh join, a restored joiner on refresh, and the moment a
  // pending request gets approved/renamed.
  useEffect(() => {
    if (!code || !session || !joiner || joiner.status === 'disapproved' || !joiner.personId) return;
    recordJoinedSession({ code, title: session.title, myName: joiner.name, personId: joiner.personId });
  }, [code, session, joiner]);

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
    const joinerToken = getStoredJoinerToken(code);

    if (!myPersonId || !joinerToken) {
      // Shouldn't happen on a normal join, but guards against a stale
      // pre-token-migration joiner (see migrations/0003's header comment) —
      // no way to authenticate their claims, so ask them to rejoin.
      return (
        <div className="text-center py-8">
          <h2 className="text-xl font-semibold mb-2 text-zinc-800 dark:text-white transition-colors">{session.title}</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4 transition-colors">Your session needs a fresh join to continue.</p>
          <Button
            onClick={() => {
              clearStoredJoinerId(code);
              setJoiner(null);
            }}
          >
            Rejoin
          </Button>
        </div>
      );
    }

    return <JoinerSessionView code={code} myPersonId={myPersonId} joinerToken={joinerToken} />;
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
      captureToken(code, result);
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
        {session.people.some((p) => p.id !== session.creatorPersonId) && (
          <div className="mb-3">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">I am…</label>
            <SearchSelect
              value={selectedPersonId}
              onChange={(value) => {
                setSelectedPersonId(value);
                if (value) setName('');
              }}
              placeholder="Someone new"
              searchPlaceholder="Search people..."
              options={[
                { value: '', label: 'Someone new' },
                // Never present the creator's identity as claimable —
                // joining "as" them would let a joiner masquerade as the
                // session owner (creator-only actions gate on
                // creatorPersonId, see GoLiveSection/LiveSessionPanel).
                ...session.people.filter((p) => p.id !== session.creatorPersonId).map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
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
