import { generateId } from '../lib/generateId';
import { LegacyBillStateSchema, type LegacyBillState } from '../schemas/legacy/billStoreV1.schema';
import { LegacyBillHistoryStateSchema } from '../schemas/legacy/billHistoryV1.schema';
import { SESSION_STORE_VERSION, type Session, type Bill } from '../schemas/session.schema';
import useSessionStore from '../sessionStore';

const OLD_BILL_KEY = 'billSplitter';
const OLD_HISTORY_KEY = 'billHistory';
const SESSION_KEY = 'billSplitterSession';

// zustand's persist middleware wraps state as {state: {...}, version: N} -
// unwrap that envelope to get at the raw state shape.
const readPersistedState = (key: string): unknown => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    return parsed?.state;
  } catch (error) {
    console.error(`Failed to read legacy localStorage key "${key}":`, error);
    return undefined;
  }
};

const billStateToBill = (billState: LegacyBillState, fallbackTitle: string, fallbackDate: string): Bill => ({
  id: billState.billId || generateId(),
  title: billState.title || fallbackTitle,
  date: fallbackDate,
  items: billState.items,
  taxAmount: billState.taxAmount,
  currency: billState.currency,
  paidByPersonId: null,
  receiptImage: null,
  splitStateVersion: SESSION_STORE_VERSION,
});

/**
 * Pure transform: legacy billHistory entries + an optional legacy "active,
 * not-yet-saved" billStore blob -> Session[]. Each old history entry (one
 * bill each, since pre-v3 data has no multi-bill grouping) becomes one new
 * Session containing exactly one Bill. Exported separately from
 * runMigrationIfNeeded so it's testable without touching localStorage or
 * the sessionStore.
 */
export const buildSessionsFromLegacyData = (historyRaw: unknown, activeBillRaw: unknown): Session[] => {
  const sessions: Session[] = [];
  const now = new Date().toISOString();

  const historyResult = LegacyBillHistoryStateSchema.safeParse(historyRaw);
  if (historyResult.success) {
    historyResult.data.bills.forEach((entry) => {
      const bill = billStateToBill(entry.data, entry.title, entry.date);
      sessions.push({
        id: generateId(),
        title: entry.title || 'Untitled Session',
        createdAt: entry.date,
        updatedAt: entry.date,
        people: entry.data.people,
        bills: [bill],
        currentBillId: bill.id,
        isLive: false,
        liveCode: null,
        liveCreatorToken: null,
      });
    });
  } else if (historyRaw !== undefined) {
    console.error('Failed to migrate legacy billHistory data:', historyResult.error);
  }

  // If there's an unsaved active bill with real data that isn't already
  // represented in history, wrap it as one more standalone session so it
  // isn't silently dropped.
  const activeResult = LegacyBillStateSchema.safeParse(activeBillRaw);
  if (activeResult.success) {
    const active = activeResult.data;
    const hasData = active.people.length > 0 || active.items.length > 0;
    const alreadyInHistory = Boolean(active.billId) && sessions.some((s) => s.bills.some((b) => b.id === active.billId));
    if (hasData && !alreadyInHistory) {
      const bill = billStateToBill(active, active.title || 'Untitled Bill', now);
      sessions.push({
        id: generateId(),
        title: active.title || 'Untitled Session',
        createdAt: now,
        updatedAt: now,
        people: active.people,
        bills: [bill],
        currentBillId: bill.id,
        isLive: false,
        liveCode: null,
        liveCreatorToken: null,
      });
    }
  } else if (activeBillRaw !== undefined) {
    console.error('Failed to migrate legacy active bill data:', activeResult.error);
  }

  return sessions;
};

/**
 * Runs once on app boot, keyed off absence of sessionStore's own
 * localStorage key (so it never re-runs once migrated, and never runs at
 * all for a fresh v3 install with no legacy data). Old keys are left
 * untouched as a cheap safety net in case this has a bug.
 */
export const runMigrationIfNeeded = (): void => {
  if (typeof localStorage === 'undefined') return;
  if (localStorage.getItem(SESSION_KEY)) return; // already migrated, or a fresh v3-only user

  const historyRaw = readPersistedState(OLD_HISTORY_KEY);
  const activeBillRaw = readPersistedState(OLD_BILL_KEY);

  if (historyRaw === undefined && activeBillRaw === undefined) return; // nothing to migrate

  const sessions = buildSessionsFromLegacyData(historyRaw, activeBillRaw);
  if (sessions.length === 0) return;

  useSessionStore.setState({ sessions, migratedFromV1: true });
};
