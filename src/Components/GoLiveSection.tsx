import { useState } from 'react';
import useSessionStore from '../sessionStore';
import { createLiveSession, LiveApiError, LIVE_SERVER_URL } from '../lib/liveApi';
import { Button, Card, Alert } from '../ui/components';
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
const GoLiveSection = ({ session, autoExpand }: GoLiveSectionProps) => {
  const markSessionLive = useSessionStore((s) => s.markSessionLive);
  const [joinMode, setJoinMode] = useState<'approval_code' | 'open_link'>('approval_code');
  const [claimMode, setClaimMode] = useState<'free_select' | 'claims_require_approval'>('free_select');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(Boolean(autoExpand));
  const [copied, setCopied] = useState(false);

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
    return (
      <Card>
        <h3 className="font-medium mb-2 text-zinc-800 dark:text-white transition-colors">Live</h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
          Code: <span className="font-mono font-semibold">{session.liveCode}</span>
        </p>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Share link</label>
        <div className="flex gap-2">
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
      </Card>
    );
  }

  const handleGoLive = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await createLiveSession(session.title, session.people, joinMode, claimMode);
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
      {error && <Alert type="error" className="mb-3">{error}</Alert>}

      <div className="mb-3">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">How can people join?</label>
        <select
          value={joinMode}
          onChange={(e) => setJoinMode(e.target.value as typeof joinMode)}
          className="w-full p-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-800 dark:text-white"
        >
          <option value="approval_code">Approval required (you approve each joiner)</option>
          <option value="open_link">Open link (anyone with the link joins instantly)</option>
        </select>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Item claims</label>
        <select
          value={claimMode}
          onChange={(e) => setClaimMode(e.target.value as typeof claimMode)}
          className="w-full p-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-800 dark:text-white"
        >
          <option value="free_select">Free select (joiners claim items directly)</option>
          <option value="claims_require_approval">Require approval (you approve each claim)</option>
        </select>
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
