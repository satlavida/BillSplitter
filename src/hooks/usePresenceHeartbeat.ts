import { useEffect } from 'react';
import { sendPresenceHeartbeat } from '../lib/liveApi';

// Req 3: while a joiner's view is mounted and the session is live, tells
// the server "I'm still here" every 1.5s so presence.Tracker can drive both
// the creator's online indicator (PeopleSection) and the identity
// reclaim-lock (see server/internal/presence). Silently drops failures —
// a missed heartbeat just means this joiner is shown offline a bit sooner,
// not worth surfacing as an error. Keep in sync with the server's
// presence.OnlineThreshold, which must stay comfortably above this interval.
const HEARTBEAT_INTERVAL_MS = 1500;

export function usePresenceHeartbeat(code: string | null, personId: string | null, joinerToken: string | null) {
  useEffect(() => {
    if (!code || !personId || !joinerToken) return;

    const tick = () => {
      sendPresenceHeartbeat(code, personId, joinerToken).catch(() => {});
    };
    tick();
    const interval = setInterval(tick, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [code, personId, joinerToken]);
}
