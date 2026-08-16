import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useShallow } from 'zustand/shallow';
import useSessionStore from '../sessionStore';
import { getPendingClaims, approveClaim, rejectClaim, LiveApiError, LIVE_SERVER_URL } from '../lib/liveApi';
import { connectLiveSync } from '../lib/liveSync';
import { Card, Alert, Button } from '../ui/components';
import type { PendingClaim } from '../schemas/live.schema';

// Creator-only review queue for claims_require_approval mode — the only
// place a creator can discover and act on a pending claim; before this
// page, the server route existed but nothing in the app called it (see
// bill_handlers.go's ListPendingClaims/RejectClaim doc comments).
const ClaimApprovalPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const session = useSessionStore(useShallow((s) => (sessionId ? s.sessions.find((sess) => sess.id === sessionId) : undefined)));
  const [claims, setClaims] = useState<PendingClaim[]>([]);
  const [busyClaimId, setBusyClaimId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const code = session?.liveCode;
  const creatorToken = session?.liveCreatorToken;

  const refreshRef = useRef<() => void>(() => {});
  refreshRef.current = () => {
    if (!code || !creatorToken) return;
    getPendingClaims(code, creatorToken)
      .then(setClaims)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load pending claims'));
  };

  useEffect(() => {
    if (!code) return;
    refreshRef.current();
    const handle = connectLiveSync(code, {
      baseUrl: LIVE_SERVER_URL,
      onStatusChange: () => {},
      onEvent: (event) => {
        if (event.kind === 'claim.pending' || event.kind === 'claim.approved' || event.kind === 'claim.rejected') refreshRef.current();
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
        <p className="text-zinc-600 dark:text-zinc-400">Only the creator of a live session can review pending claims.</p>
      </div>
    );
  }

  const handleApprove = async (claimId: string) => {
    setBusyClaimId(claimId);
    setError(null);
    try {
      await approveClaim(code, claimId, creatorToken);
      refreshRef.current();
    } catch (err) {
      setError(err instanceof LiveApiError ? err.message : 'Failed to approve claim');
    } finally {
      setBusyClaimId(null);
    }
  };

  const handleReject = async (claimId: string) => {
    setBusyClaimId(claimId);
    setError(null);
    try {
      await rejectClaim(code, claimId, creatorToken);
      refreshRef.current();
    } catch (err) {
      setError(err instanceof LiveApiError ? err.message : 'Failed to reject claim');
    } finally {
      setBusyClaimId(null);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <Link to={`/session/${sessionId}`} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
          ← Back to Session
        </Link>
      </div>
      <h2 className="text-xl font-semibold mb-4 text-zinc-800 dark:text-white transition-colors">Pending Claims</h2>

      {error && <Alert type="error" className="mb-4">{error}</Alert>}

      <Card>
        {claims.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No claims awaiting approval.</p>
        ) : (
          <ul className="space-y-2">
            {claims.map((claim) => (
              <li key={claim.id} className="flex justify-between items-center gap-2">
                <span className="text-sm text-zinc-800 dark:text-white transition-colors">
                  {claim.personName} wants {claim.value} part{claim.value === 1 ? '' : 's'} of {claim.itemName}
                </span>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" onClick={() => handleApprove(claim.id)} disabled={busyClaimId === claim.id}>
                    Approve
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => handleReject(claim.id)} disabled={busyClaimId === claim.id}>
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};

export default ClaimApprovalPage;
