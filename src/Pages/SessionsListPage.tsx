import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/shallow';
import useSessionStore from '../sessionStore';
import { Button, Card, Alert } from '../ui/components';
import FileImport from '../Components/BillHistory/FileImport';
import { listJoinedSessions, removeJoinedSession, type JoinedSession } from '../lib/joinedSessionsStorage';
import { getSessionsStatus } from '../lib/liveApi';
import type { SessionStatus } from '../schemas/live.schema';
import { formatRelativeTime } from '../lib/formatRelativeTime';

const STATUS_LABEL: Record<SessionStatus['status'], string> = {
  active: 'Active',
  settled: 'Settled',
  deleted: 'No longer available',
};

const STATUS_BADGE_CLASS: Record<SessionStatus['status'], string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  settled: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300',
  deleted: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

// "Sessions I've joined" section — separate from sessionStore's Session[]
// (which is exclusively locally-created sessions this browser owns), backed
// by joinedSessionsStorage.ts's local index and reconciled against the
// server's batch status endpoint on mount.
const JoinedSessionsSection = () => {
  const [entries, setEntries] = useState<JoinedSession[]>([]);
  const [statuses, setStatuses] = useState<Record<string, SessionStatus>>({});
  const [loadingStatus, setLoadingStatus] = useState(false);

  useEffect(() => {
    const stored = listJoinedSessions();
    setEntries(stored);
    if (stored.length === 0) return;

    let cancelled = false;
    setLoadingStatus(true);
    getSessionsStatus(stored.map((s) => s.code))
      .then((results) => {
        if (cancelled) return;
        setStatuses(Object.fromEntries(results.map((r) => [r.code, r])));
      })
      .catch(() => {
        // Status is a nice-to-have overlay — leave entries showing with no
        // badge rather than failing the whole section.
      })
      .finally(() => {
        if (!cancelled) setLoadingStatus(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleRemove = (code: string) => {
    removeJoinedSession(code);
    setEntries((prev) => prev.filter((e) => e.code !== code));
  };

  if (entries.length === 0) return null;

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-zinc-800 dark:text-white mb-2 transition-colors">Sessions You've Joined</h3>
      <ul className="space-y-2">
        {entries.map((entry) => {
          const status = statuses[entry.code];
          return (
            <li key={entry.code}>
              <Card className="mb-0">
                <div className="flex justify-between items-center gap-2">
                  <div className="min-w-0">
                    {status?.status === 'deleted' ? (
                      <span className="font-medium text-zinc-500 dark:text-zinc-400">{status.title || entry.title}</span>
                    ) : (
                      <Link to={`/join/${entry.code}`} className="font-medium text-zinc-800 dark:text-white hover:underline transition-colors">
                        {status?.title || entry.title}
                      </Link>
                    )}
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 transition-colors">
                      Joined as {entry.myName} · {formatRelativeTime(entry.joinedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {status && (
                      <span className={`text-xs py-1 px-2 rounded-full transition-colors ${STATUS_BADGE_CLASS[status.status]}`}>
                        {STATUS_LABEL[status.status]}
                      </span>
                    )}
                    {!status && loadingStatus && <span className="text-xs text-zinc-400">Checking…</span>}
                    <Button size="sm" variant="secondary" onClick={() => handleRemove(entry.code)}>
                      Remove
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const SessionsListPage = () => {
  const navigate = useNavigate();
  const sessions = useSessionStore(useShallow((s) => s.sessions));
  const { createSession, deleteSession, exportSession, importSession } = useSessionStore(
    useShallow((s) => ({
      createSession: s.createSession,
      deleteSession: s.deleteSession,
      exportSession: s.exportSession,
      importSession: s.importSession,
    }))
  );
  const currentSessionId = useSessionStore((s) => s.currentSessionId);
  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  const handleCreate = () => {
    const session = createSession();
    navigate(`/session/${session.id}`);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this session? This cannot be undone.')) {
      deleteSession(id);
    }
  };

  const handleExport = (id: string) => {
    const json = exportSession(id);
    if (!json) return;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${id}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  };

  const handleImport = (content: string) => {
    setImportError(null);
    setImportSuccess(false);
    const result = importSession(content);
    if (result.success) {
      setImportSuccess(true);
    } else {
      setImportError(result.error || 'Failed to import session');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-zinc-800 dark:text-white transition-colors">Sessions</h2>
        <Button onClick={handleCreate}>New Session</Button>
      </div>

      {currentSession && (
        <Link
          to={`/session/${currentSession.id}`}
          className="mb-4 flex items-center justify-between gap-2 p-3 rounded-md bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
        >
          <span className="text-sm text-blue-700 dark:text-blue-300">
            Continue current session: <span className="font-medium">{currentSession.title}</span>
          </span>
          <span className="text-blue-600 dark:text-blue-400" aria-hidden="true">
            →
          </span>
        </Link>
      )}

      {importError && <Alert type="error" className="mb-4">{importError}</Alert>}
      {importSuccess && <Alert type="success" className="mb-4">Session imported successfully!</Alert>}

      <JoinedSessionsSection />

      {sessions.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400 mb-6">No sessions yet. Create one to get started.</p>
      ) : (
        <ul className="space-y-2 mb-6">
          {sessions.map((session) => (
            <li key={session.id}>
              <Card className="mb-0">
                <div className="flex justify-between items-center">
                  <Link to={`/session/${session.id}`} className="font-medium text-zinc-800 dark:text-white hover:underline transition-colors">
                    {session.title}
                  </Link>
                  <div className="flex gap-2">
                    {session.isLive ? (
                      <Button size="sm" variant="secondary" onClick={() => navigate(`/session/${session.id}`)}>
                        Live
                      </Button>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => navigate(`/session/${session.id}`, { state: { goLive: true } })}>
                        Go Live
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => handleExport(session.id)}>
                      Export
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(session.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 transition-colors">
                  {session.bills.length} bill{session.bills.length !== 1 ? 's' : ''} · {session.people.length} people
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <div>
        <h3 className="text-lg font-semibold text-zinc-800 dark:text-white mb-2 transition-colors">Import Session</h3>
        <FileImport onImport={handleImport} buttonText="Import Session" />
      </div>
    </div>
  );
};

export default SessionsListPage;
