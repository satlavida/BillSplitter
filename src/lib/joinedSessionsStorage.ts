// Maintains the index that joinerStorage.ts deliberately doesn't: a list of
// every live session code this browser has joined (as a joiner, not
// creator), so SessionsListPage can show "sessions I've joined" alongside
// the locally-created ones in sessionStore. The server has no record of
// this by itself (see server/internal/api/session_handlers.go's
// GetSessionsStatus doc comment) — it's purely a client-side index, kept in
// sync with joinerStorage's per-code joinerId/token via JoinPage.tsx.
const STORAGE_KEY = 'billsplitter-joined-sessions';

export interface JoinedSession {
  code: string;
  title: string;
  myName: string;
  personId: string;
  joinedAt: string;
}

function readAll(): JoinedSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(sessions: JoinedSession[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Private browsing / storage full / disabled — the joined-sessions list
    // just won't persist, same degradation as joinerStorage.ts.
  }
}

export function listJoinedSessions(): JoinedSession[] {
  return readAll();
}

// Upserts by code — called once a join succeeds or is restored (JoinPage.tsx),
// so re-joining/refreshing just refreshes title/name/personId in place.
export function recordJoinedSession(entry: Omit<JoinedSession, 'joinedAt'>): void {
  const all = readAll();
  const existing = all.find((s) => s.code === entry.code);
  const next: JoinedSession = { ...entry, joinedAt: existing?.joinedAt ?? new Date().toISOString() };
  writeAll([...all.filter((s) => s.code !== entry.code), next]);
}

export function removeJoinedSession(code: string): void {
  writeAll(readAll().filter((s) => s.code !== code));
}
