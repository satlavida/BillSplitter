// Persists which joiner id this browser is, per live session code, so a
// joiner who refreshes /join/:code (or closes and reopens the tab) doesn't
// lose their place and have to rejoin from scratch. Deliberately not part
// of sessionStore — joiners don't get their own persisted app session, this
// is just "who am I in this one live session".
const STORAGE_PREFIX = 'billsplitter-joiner:';
// Separate key (rather than folding into the joiner-id value) to keep
// getStoredJoinerId/setStoredJoinerId's existing call sites unchanged.
const TOKEN_STORAGE_PREFIX = 'billsplitter-joiner-token:';

export function getStoredJoinerId(code: string): string | null {
  try {
    return localStorage.getItem(STORAGE_PREFIX + code);
  } catch {
    return null;
  }
}

export function setStoredJoinerId(code: string, joinerId: string): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + code, joinerId);
  } catch {
    // Private browsing / storage full / disabled — the joiner just won't
    // be restored on refresh, which is the pre-existing behavior anyway.
  }
}

export function clearStoredJoinerId(code: string): void {
  try {
    localStorage.removeItem(STORAGE_PREFIX + code);
    localStorage.removeItem(TOKEN_STORAGE_PREFIX + code);
  } catch {
    // ignore
  }
}

// The joiner's secret claim/unclaim token — see live.schema.ts's LiveJoiner
// .token and liveApi.ts's requireJoiner-gated calls. The server reveals this
// exactly once (the first response that observes status: 'approved'), so it
// must be captured into storage the moment it's seen.
export function getStoredJoinerToken(code: string): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_PREFIX + code);
  } catch {
    return null;
  }
}

export function setStoredJoinerToken(code: string, token: string): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_PREFIX + code, token);
  } catch {
    // Private browsing / storage full / disabled — this joiner just won't
    // be able to claim/unclaim/add-items after a refresh until they rejoin.
  }
}
