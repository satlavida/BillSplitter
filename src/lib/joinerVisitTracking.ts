// Tracks which live bills a joiner has actually opened, purely client-side
// (localStorage), so JoinerBillList.tsx can badge the ones they haven't
// looked at yet — the joiner-side equivalent of the creator's "Things to
// Take Care of" section (ThingsToTakeCareOf.tsx), but scoped to "have I even
// been here" rather than a full claim-completeness check, since a joiner
// only ever sees their own claims, not everyone else's incompleteness.
// Keyed by `code:billId`, same try/catch-swallow resilience as
// joinerStorage.ts/joinedSessionsStorage.ts for private-browsing/storage-
// disabled environments.
const STORAGE_PREFIX = 'billsplitter-joiner-visited:';

export function markBillVisited(code: string, billId: string): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + code + ':' + billId, '1');
  } catch {
    // Private browsing / storage full / disabled — the badge just won't
    // clear after visiting, which is a cosmetic-only downside.
  }
}

export function hasBillBeenVisited(code: string, billId: string): boolean {
  try {
    return localStorage.getItem(STORAGE_PREFIX + code + ':' + billId) === '1';
  } catch {
    return false;
  }
}
