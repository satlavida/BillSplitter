// Persists which joiner id this browser is, per live session code, so a
// joiner who refreshes /join/:code (or closes and reopens the tab) doesn't
// lose their place and have to rejoin from scratch. Deliberately not part
// of sessionStore — joiners don't get their own persisted app session, this
// is just "who am I in this one live session".
const STORAGE_PREFIX = 'billsplitter-joiner:';

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
  } catch {
    // ignore
  }
}
