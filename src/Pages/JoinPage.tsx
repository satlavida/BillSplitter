import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getLiveSession, joinLiveSession, LiveApiError } from '../lib/liveApi';
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

  if (joiner) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold mb-2 text-zinc-800 dark:text-white transition-colors">{session.title}</h2>
        {joiner.status === 'pending' ? (
          <>
            <p className="text-zinc-600 dark:text-zinc-400 mb-2 transition-colors">Waiting for the host to approve you.</p>
            <p className="text-zinc-800 dark:text-white transition-colors">
              Tell the host your code: <span className="font-mono font-semibold text-lg">{joiner.approvalCode}</span>
            </p>
          </>
        ) : (
          <p className="text-zinc-600 dark:text-zinc-400 transition-colors">You're in! Live item claiming is coming in a future update.</p>
        )}
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
