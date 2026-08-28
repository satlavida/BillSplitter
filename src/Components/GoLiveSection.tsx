import { useState } from 'react';
import useSessionStore from '../sessionStore';
import useSettingsStore from '../settingsStore';
import { createLiveSession, deleteLiveSession, LiveApiError, LIVE_SERVER_URL } from '../lib/liveApi';
import { Button, Card, Alert, Dropdown } from '../ui/components';
import type { Session } from '../schemas/session.schema';

interface GoLiveSectionProps {
  session: Session;
  // Opens the configuration form immediately, e.g. when navigated here from
  // a "Go Live" button on the sessions list (req 2) rather than expanded
  // locally on this page.
  autoExpand?: boolean;
}

// "Go Live" seeds a server-side mirror of the current session (title +
// people) via the Go backend and shows the resulting join code/link. Going
// live never blocks or replaces the offline-first local session — see
// planv3.md 3.10.
// Sentinel option values for the creator-identity <select> — distinct from
// any real person id, and from '' (no selection).
const NEW_PERSON = '__new__';

const GoLiveSection = ({ session, autoExpand }: GoLiveSectionProps) => {
  const markSessionLive = useSessionStore((s) => s.markSessionLive);
  const unmarkSessionLive = useSessionStore((s) => s.unmarkSessionLive);
  const addPerson = useSessionStore((s) => s.addPerson);
  const [joinMode, setJoinMode] = useState<'approval_code' | 'open_link'>('approval_code');
  const [permissionMode, setPermissionMode] = useState<'edit' | 'read_only'>('edit');
  const [creatorPersonId, setCreatorPersonId] = useState<string>(() => {
    // If auto-add-self is on (Settings.tsx) and this session already has a
    // matching person (added via that same setting when the session was
    // created — see sessionStore.ts), preselect them instead of defaulting
    // to "I'm not in the list".
    const { autoAddSelf, selfName } = useSettingsStore.getState();
    const trimmedSelfName = selfName.trim();
    if (!autoAddSelf || !trimmedSelfName) return '';
    const match = session.people.find((p) => p.name.trim().toLowerCase() === trimmedSelfName.toLowerCase());
    return match?.id ?? '';
  });
  const [newPersonName, setNewPersonName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(Boolean(autoExpand));
  const [copied, setCopied] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleCopyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied by the browser — the read-only input
      // itself is still selectable/copyable manually, so this is a soft failure.
    }
  };

  if (session.isLive && session.liveCode) {
    const joinLink = `${window.location.origin}${window.location.pathname}#/join/${session.liveCode}`;
    const liveCode = session.liveCode;
    const creatorToken = session.liveCreatorToken;

    const handleDelete = async () => {
      if (!creatorToken) return;
      setDeleting(true);
      setError(null);
      try {
        await deleteLiveSession(liveCode, creatorToken);
        unmarkSessionLive(session.id);
      } catch (err) {
        if (err instanceof LiveApiError && err.status === 404) {
          // Already gone server-side (e.g. purged by the cleanup job) — treat
          // it as deleted so the user isn't stuck unable to Go Live again.
          unmarkSessionLive(session.id);
          setExpanded(true);
          setNotice('This session was not found online — it may have already been deleted. Your local data is intact and you can start a new live session.');
        } else {
          setError(err instanceof LiveApiError ? err.message : 'Failed to delete the online session');
        }
      } finally {
        setDeleting(false);
        setConfirmingDelete(false);
      }
    };

    return (
      <Card>
        <h3 className="font-medium mb-2 text-zinc-800 dark:text-white transition-colors">Live</h3>
        {error && <Alert type="error" className="mb-3">{error}</Alert>}
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
          Code: <span className="font-mono font-semibold">{session.liveCode}</span>
        </p>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Share link</label>
        <div className="flex gap-2 mb-4">
          <input
            readOnly
            value={joinLink}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-grow p-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-white font-mono text-sm"
          />
          <Button variant="secondary" onClick={() => void handleCopyLink(joinLink)}>
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>

        {confirmingDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Delete the online session? Your local data stays intact.</span>
            <Button size="sm" variant="danger" onClick={() => void handleDelete()} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Confirm Delete'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="danger" onClick={() => setConfirmingDelete(true)}>
            Delete Online Session
          </Button>
        )}
      </Card>
    );
  }

  const handleGoLive = async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      // Req 7: the creator can claim an existing person as themselves, or
      // add a brand new one on the spot — either way it must be included in
      // the people array the live session is seeded with.
      let people = session.people;
      let resolvedCreatorPersonId: string | null = creatorPersonId || null;
      if (creatorPersonId === NEW_PERSON) {
        const trimmed = newPersonName.trim();
        if (!trimmed) {
          setError('Enter a name for yourself, or pick an existing person.');
          setLoading(false);
          return;
        }
        const created = addPerson(session.id, trimmed);
        if (!created) {
          setError('Failed to add your person.');
          setLoading(false);
          return;
        }
        resolvedCreatorPersonId = created.id;
        people = [...session.people, created];
      }

      const result = await createLiveSession(session.title, people, joinMode, 'free_select', permissionMode, resolvedCreatorPersonId, session.currency);
      markSessionLive(session.id, result.code, result.creatorToken);
    } catch (err) {
      setError(err instanceof LiveApiError ? err.message : `Could not reach the live server (${LIVE_SERVER_URL}). Is it running?`);
    } finally {
      setLoading(false);
    }
  };

  if (!expanded) {
    return (
      <Button variant="secondary" onClick={() => setExpanded(true)}>
        Go Live
      </Button>
    );
  }

  return (
    <Card>
      <h3 className="font-medium mb-3 text-zinc-800 dark:text-white transition-colors">Go Live</h3>
      {notice && <Alert type="info" className="mb-3">{notice}</Alert>}
      {error && <Alert type="error" className="mb-3">{error}</Alert>}

      <div className="mb-3">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">How can people join?</label>
        <Dropdown
          value={joinMode}
          onChange={(e) => setJoinMode(e.target.value as typeof joinMode)}
          options={[
            { value: 'approval_code', label: 'Approval required (you approve each joiner)' },
            { value: 'open_link', label: 'Open link (anyone with the link joins instantly)' },
          ]}
        />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Joiner permissions</label>
        <Dropdown
          value={permissionMode}
          onChange={(e) => setPermissionMode(e.target.value as typeof permissionMode)}
          options={[
            { value: 'edit', label: 'Edit (joiners can add and claim items directly)' },
            { value: 'read_only', label: 'Read-only (joiners can only view your changes)' },
          ]}
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Which person are you?</label>
        <Dropdown
          value={creatorPersonId}
          onChange={(e) => setCreatorPersonId(e.target.value)}
          options={[
            { value: '', label: "I'm not in the list (no one can join as me)" },
            ...session.people.map((p) => ({ value: p.id, label: p.name })),
            { value: NEW_PERSON, label: 'Add myself as a new person…' },
          ]}
        />
        {creatorPersonId === NEW_PERSON && (
          <input
            type="text"
            value={newPersonName}
            onChange={(e) => setNewPersonName(e.target.value)}
            placeholder="Your name"
            className="mt-2 w-full p-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-800 dark:text-white"
          />
        )}
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">No one else will be able to join as this person (req 8).</p>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleGoLive} disabled={loading}>
          {loading ? 'Starting…' : 'Start Live Session'}
        </Button>
        <Button variant="secondary" onClick={() => setExpanded(false)} disabled={loading}>
          Cancel
        </Button>
      </div>
    </Card>
  );
};

export default GoLiveSection;
