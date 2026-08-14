import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/shallow';
import useSessionStore from '../sessionStore';
import { Button, Card, Alert } from '../ui/components';
import FileImport from '../Components/BillHistory/FileImport';

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

      {importError && <Alert type="error" className="mb-4">{importError}</Alert>}
      {importSuccess && <Alert type="success" className="mb-4">Session imported successfully!</Alert>}

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
