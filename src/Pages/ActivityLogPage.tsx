import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useShallow } from 'zustand/shallow';
import useSessionStore from '../sessionStore';
import { getActivityLog, restoreLiveBill, permanentlyDeleteLiveBill, LIVE_SERVER_URL } from '../lib/liveApi';
import { connectLiveSync } from '../lib/liveSync';
import { formatRelativeTime } from '../lib/formatRelativeTime';
import { formatActivityLine } from '../lib/activityLine';
import { Card, Alert, Dropdown, Button, BackLink, Heading } from '../ui/components';
import type { LiveActivityEntry } from '../schemas/live.schema';

const ALL_PEOPLE = '__all__';
const ALL_ACTIONS = '__all__';

// Creator-only claim/unclaim history for a live session (requirement 6:
// "satyajeet claimed 2 parts of pizza" style audit log). Gated on holding
// the creator token, same as LiveSessionPanel's Settle Up / joiners view.
const ActivityLogPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const session = useSessionStore(useShallow((s) => (sessionId ? s.sessions.find((sess) => sess.id === sessionId) : undefined)));
  const [entries, setEntries] = useState<LiveActivityEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [personFilter, setPersonFilter] = useState(ALL_PEOPLE);
  const [actionFilter, setActionFilter] = useState(ALL_ACTIONS);
  // Tracks in-flight/errored restore/permanent-remove actions per activity
  // entry id, so a click disables just that entry's buttons rather than the
  // whole page, and a failure (e.g. someone already restored/removed it)
  // surfaces inline instead of silently doing nothing.
  const [billActionState, setBillActionState] = useState<Record<number, 'busy' | 'error'>>({});

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

  // Must run before any early return below (Rules of Hooks) — entries is
  // just [] on those render paths, so the memo is harmless there.
  const people = useMemo(() => Array.from(new Set(entries.map((e) => e.personName))).sort(), [entries]);

  if (!sessionId || !session) {
    return (
      <div>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">Session not found.</p>
        <BackLink to="/sessions">Back to sessions</BackLink>
      </div>
    );
  }

  if (!code || !creatorToken) {
    return (
      <div>
        <div className="mb-4">
          <BackLink to={`/session/${sessionId}`} className="text-sm">← Back to Session</BackLink>
        </div>
        <p className="text-zinc-600 dark:text-zinc-400">Only the creator of a live session can view its activity log.</p>
      </div>
    );
  }

  const handleRestore = async (entry: LiveActivityEntry) => {
    setBillActionState((prev) => ({ ...prev, [entry.id]: 'busy' }));
    try {
      await restoreLiveBill(code, entry.itemId, creatorToken);
      refreshRef.current();
    } catch {
      setBillActionState((prev) => ({ ...prev, [entry.id]: 'error' }));
    }
  };

  const handlePermanentlyRemove = async (entry: LiveActivityEntry) => {
    if (!window.confirm(`Permanently remove "${entry.itemName}"? This can't be undone.`)) return;
    setBillActionState((prev) => ({ ...prev, [entry.id]: 'busy' }));
    try {
      await permanentlyDeleteLiveBill(code, entry.itemId, creatorToken);
      refreshRef.current();
    } catch {
      setBillActionState((prev) => ({ ...prev, [entry.id]: 'error' }));
    }
  };

  const filteredEntries = entries.filter(
    (e) => (personFilter === ALL_PEOPLE || e.personName === personFilter) && (actionFilter === ALL_ACTIONS || e.action === actionFilter)
  );

  return (
    <div>
      <div className="mb-4">
        <BackLink to={`/session/${sessionId}`} className="text-sm">← Back to Session</BackLink>
      </div>
      <Heading>Activity Log</Heading>

      {error && <Alert type="error" className="mb-4">{error}</Alert>}

      {entries.length > 0 && (
        <div className="flex gap-2 mb-4">
          <Dropdown
            value={personFilter}
            onChange={(e) => setPersonFilter(e.target.value)}
            options={[{ value: ALL_PEOPLE, label: 'Everyone' }, ...people.map((name) => ({ value: name, label: name }))]}
          />
          <Dropdown
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            options={[
              { value: ALL_ACTIONS, label: 'All activity' },
              { value: 'claim', label: 'Claims only' },
              { value: 'unclaim', label: 'Unclaims only' },
              { value: 'edit_item', label: 'Item edits only' },
              { value: 'delete_item', label: 'Item removals only' },
              { value: 'delete_bill', label: 'Bill deletions only' },
              { value: 'restore_bill', label: 'Bill restores only' },
              { value: 'permanent_delete_bill', label: 'Permanent bill removals only' },
            ]}
          />
        </div>
      )}

      <Card>
        {entries.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No activity yet.</p>
        ) : filteredEntries.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No activity matches these filters.</p>
        ) : (
          <ul className="space-y-2" data-testid="activity-log-list">
            {filteredEntries.map((entry) => {
              const line = formatActivityLine(entry);
              const actionState = billActionState[entry.id];
              return (
                <li key={entry.id} className="text-sm text-zinc-700 dark:text-zinc-300 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span>{line}</span>
                      <span className="block text-xs text-zinc-500 dark:text-zinc-400">{formatRelativeTime(entry.createdAt)}</span>
                    </div>
                    {entry.action === 'delete_bill' && (
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="secondary" disabled={actionState === 'busy'} onClick={() => handleRestore(entry)}>
                          Restore
                        </Button>
                        <Button size="sm" variant="danger" disabled={actionState === 'busy'} onClick={() => handlePermanentlyRemove(entry)}>
                          Permanently Remove
                        </Button>
                      </div>
                    )}
                  </div>
                  {actionState === 'error' && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      Couldn't complete that action — the bill may have already been restored or permanently removed.
                    </p>
                  )}
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
