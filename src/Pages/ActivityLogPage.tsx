import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useShallow } from 'zustand/shallow';
import useSessionStore from '../sessionStore';
import { getActivityLog, LIVE_SERVER_URL } from '../lib/liveApi';
import { connectLiveSync } from '../lib/liveSync';
import { Card, Alert } from '../ui/components';
import type { LiveActivityEntry } from '../schemas/live.schema';

// Creator-only claim/unclaim history for a live session (requirement 6:
// "satyajeet claimed 2 parts of pizza" style audit log). Gated on holding
// the creator token, same as LiveSessionPanel's Settle Up / joiners view.
const ActivityLogPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const session = useSessionStore(useShallow((s) => (sessionId ? s.sessions.find((sess) => sess.id === sessionId) : undefined)));
  const [entries, setEntries] = useState<LiveActivityEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const code = session?.liveCode;
  const creatorToken = session?.liveCreatorToken;

  const refreshRef = useRef<() => void>(() => {});
  refreshRef.current = () => {
    if (!code || !creatorToken) return;
    getActivityLog(code, creatorToken)
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load activity log'));
  };

  useEffect(() => {
    if (!code) return;
    refreshRef.current();
    const handle = connectLiveSync(code, {
      baseUrl: LIVE_SERVER_URL,
      onStatusChange: () => {},
      onEvent: (event) => {
        if (event.kind === 'activity.created') refreshRef.current();
      },
      onPoll: () => refreshRef.current(),
    });
    return () => handle.disconnect();
  }, [code, creatorToken]);

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

  if (!code || !creatorToken) {
    return (
      <div>
        <div className="mb-4">
          <Link to={`/session/${sessionId}`} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            ← Back to Session
          </Link>
        </div>
        <p className="text-zinc-600 dark:text-zinc-400">Only the creator of a live session can view its activity log.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Link to={`/session/${sessionId}`} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
          ← Back to Session
        </Link>
      </div>
      <h2 className="text-xl font-semibold mb-4 text-zinc-800 dark:text-white transition-colors">Activity Log</h2>

      {error && <Alert type="error" className="mb-4">{error}</Alert>}

      <Card>
        {entries.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No claims or unclaims yet.</p>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => {
              const parts = Math.abs(entry.deltaValue);
              const partWord = `${parts} part${parts === 1 ? '' : 's'}`;
              const line = `${entry.personName} ${entry.action === 'claim' ? 'claimed' : 'unclaimed'} ${partWord} of ${entry.itemName}`;
              return (
                <li key={entry.id} className="text-sm text-zinc-700 dark:text-zinc-300 transition-colors">
                  <span>{line}</span>
                  <span className="block text-xs text-zinc-500 dark:text-zinc-400">{entry.createdAt}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
};

export default ActivityLogPage;
