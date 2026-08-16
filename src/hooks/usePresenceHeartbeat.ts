import { useEffect } from 'react';
import { sendPresenceHeartbeat } from '../lib/liveApi';

// Req 3: while a joiner's view is mounted and the session is live, tells
// the server "I'm still here" every 500ms so presence.Tracker can drive
// both the creator's online indicator (PeopleSection) and the identity
// reclaim-lock (see server/internal/presence). Silently drops failures —
// a missed heartbeat just means this joiner is shown offline a bit sooner,
// not worth surfacing as an error.
export function usePresenceHeartbeat(code: string | null, personId: string | null, joinerToken: string | null) {
  useEffect(() => {
    if (!code || !personId || !joinerToken) return;

    const tick = () => {
      sendPresenceHeartbeat(code, personId, joinerToken).catch(() => {});
    };
    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [code, personId, joinerToken]);
}
