import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateId } from './lib/generateId';
import { SessionStoreStateSchema, SessionSchema, SESSION_STORE_VERSION, type Session, type Bill } from './schemas/session.schema';
import type { Item, Person, DiscountType, SplitType } from './schemas/bill.schema';
import type { LiveSession } from './schemas/live.schema';

// Dynamically imported (rather than a static import) so this module never
// pulls in liveApi.ts's `import.meta.env` reference at parse time — Jest's
// Babel/CJS transform can't handle that syntax at all, even in code paths
// that never execute (see liveSync.ts's baseUrl-as-parameter workaround for
// the same underlying issue). A dynamic import here is only ever resolved
// when actually pushing to a live session, which no unit test does.
const pushNewBillLive = (liveCode: string, bill: Pick<Bill, 'id' | 'title' | 'currency' | 'taxAmount'>) =>
  import('./lib/liveApi').then(({ addLiveBill }) => addLiveBill(liveCode, bill));

const pushNewItemLive = (liveCode: string, billId: string, item: Item) =>
  import('./lib/liveApi').then(({ addLiveItem }) => addLiveItem(liveCode, billId, item));

interface SessionStoreState {
  version: string;
  sessions: Session[];
  currentSessionId: string | null;
  migratedFromV1: boolean;
}

interface ImportResult {
  success: boolean;
  error?: string;
}

const newBillDefaults = (overrides?: Partial<Bill>): Bill => ({
  id: generateId(),
  title: overrides?.title || 'Untitled Bill',
  date: new Date().toISOString(),
  items: overrides?.items ?? [],
  taxAmount: overrides?.taxAmount ?? 0,
  currency: overrides?.currency ?? 'INR',
  paidByPersonId: overrides?.paidByPersonId ?? null,
  receiptImage: overrides?.receiptImage ?? null,
  splitStateVersion: SESSION_STORE_VERSION,
});

interface SessionStoreActions {
  createSession: (title?: string) => Session;
  deleteSession: (sessionId: string) => void;
  setCurrentSession: (sessionId: string) => void;
  getCurrentSession: () => Session | undefined;
  getSession: (sessionId: string) => Session | undefined;
  setSessionTitle: (sessionId: string, title: string) => void;

  addBill: (sessionId: string, billData?: Partial<Bill>) => Bill | undefined;
  updateBill: (sessionId: string, billId: string, data: Partial<Bill>) => void;
  deleteBill: (sessionId: string, billId: string) => void;
  setCurrentBill: (sessionId: string, billId: string) => void;
  getBill: (sessionId: string, billId: string) => Bill | undefined;
  setBillPaidBy: (sessionId: string, billId: string, personId: string | null) => void;
  setBillItems: (sessionId: string, billId: string, items: Item[]) => void;

  addPerson: (sessionId: string, name: string) => Person | undefined;
  removePerson: (sessionId: string, personId: string) => void;
  updatePerson: (sessionId: string, personId: string, name: string) => void;
  // Bulk replace of the shared people pool, used by the bill-editor scratch
  // store (billStore) to commit its locally-edited people list back.
  setSessionPeople: (sessionId: string, people: Person[]) => void;

  exportSession: (sessionId: string) => string | null;
  importSession: (jsonString: string) => ImportResult;

  // Marks a session as live once the creator's "Go Live" call to the server
  // succeeds — see src/lib/liveApi.ts's createLiveSession.
  markSessionLive: (sessionId: string, liveCode: string, liveCreatorToken: string) => void;

  // Merges a snapshot fetched from the Go live server (getLiveSession) into
  // this session by entity id, per planv3.md 3.10. Upserts people/bills/items
  // rather than replacing the arrays wholesale, so any of the creator's own
  // in-flight local edits to entities the server hasn't seen yet survive.
  mergeLiveSnapshot: (sessionId: string, liveSession: LiveSession) => void;
}

type SessionStore = SessionStoreState & SessionStoreActions;

const initialState: SessionStoreState = {
  version: SESSION_STORE_VERSION,
  sessions: [],
  currentSessionId: null,
  migratedFromV1: false,
};

const touchSession = (session: Session): Session => ({ ...session, updatedAt: new Date().toISOString() });

function upsertById<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const localById = new Map(local.map((entry) => [entry.id, entry]));
  for (const entry of remote) {
    localById.set(entry.id, { ...localById.get(entry.id), ...entry });
  }
  return Array.from(localById.values());
}

function mergeLiveBill(local: Bill | undefined, remote: LiveSession['bills'][number]): Bill {
  const items: Item[] = upsertById<Item>(
    local?.items ?? [],
    remote.items.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      discount: item.discount,
      discountType: item.discountType as DiscountType,
      splitType: item.splitType as SplitType,
      consumedBy: item.consumedBy,
    }))
  );

  return {
    id: remote.id,
    title: remote.title,
    date: remote.date,
    items,
    taxAmount: remote.taxAmount,
    currency: remote.currency,
    paidByPersonId: remote.paidByPersonId,
    receiptImage: local?.receiptImage ?? null,
    splitStateVersion: local?.splitStateVersion ?? SESSION_STORE_VERSION,
  };
}

function mergeLiveSessionInto(session: Session, liveSession: LiveSession): Session {
  const billsById = new Map(session.bills.map((b) => [b.id, b]));
  for (const remoteBill of liveSession.bills) {
    billsById.set(remoteBill.id, mergeLiveBill(billsById.get(remoteBill.id), remoteBill));
  }

  return touchSession({
    ...session,
    people: upsertById<Person>(session.people, liveSession.people),
    bills: Array.from(billsById.values()),
  });
}

const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      createSession: (title) => {
        const now = new Date().toISOString();
        const newSession: Session = {
          id: generateId(),
          title: title || 'Untitled Session',
          createdAt: now,
          updatedAt: now,
          people: [],
          bills: [],
          currentBillId: null,
          isLive: false,
          liveCode: null,
          liveCreatorToken: null,
        };

        set((state) => ({
          sessions: [...state.sessions, newSession],
          currentSessionId: newSession.id,
        }));

        return newSession;
      },

      deleteSession: (sessionId) =>
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== sessionId),
          currentSessionId: state.currentSessionId === sessionId ? null : state.currentSessionId,
        })),

      setCurrentSession: (sessionId) => set({ currentSessionId: sessionId }),

      getCurrentSession: () => {
        const state = get();
        return state.sessions.find((s) => s.id === state.currentSessionId);
      },

      getSession: (sessionId) => get().sessions.find((s) => s.id === sessionId),

      setSessionTitle: (sessionId, title) =>
        set((state) => ({
          sessions: state.sessions.map((s) => (s.id === sessionId ? touchSession({ ...s, title }) : s)),
        })),

      addBill: (sessionId, billData) => {
        const newBill = newBillDefaults(billData);
        let created = false;
        let liveCode: string | null = null;

        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== sessionId) return s;
            created = true;
            liveCode = s.isLive ? s.liveCode : null;
            return touchSession({ ...s, bills: [...s.bills, newBill], currentBillId: newBill.id });
          }),
        }));

        // Best-effort push to the live server (offline-first: a failed push
        // here doesn't block or roll back the local bill, it just means
        // joiners won't see it until the next successful sync).
        if (created && liveCode) {
          pushNewBillLive(liveCode, { id: newBill.id, title: newBill.title, currency: newBill.currency, taxAmount: newBill.taxAmount }).catch(() => {});
        }

        return created ? newBill : undefined;
      },

      updateBill: (sessionId, billId, data) => {
        const session = get().sessions.find((s) => s.id === sessionId);
        const previousItems = session?.bills.find((b) => b.id === billId)?.items;

        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== sessionId) return s;
            return touchSession({
              ...s,
              bills: s.bills.map((b) => (b.id === billId ? { ...b, ...data } : b)),
            });
          }),
        }));

        // Push newly-added items (ids not present before this update) up
        // to the live server, best-effort — matches addBill's push above.
        // Edits to already-pushed items (price/split/etc.) aren't synced
        // further here; see V3_PROGRESS.md's pending list.
        if (session?.isLive && session.liveCode && data.items && previousItems) {
          const previousIds = new Set(previousItems.map((i) => i.id));
          for (const item of data.items) {
            if (previousIds.has(item.id)) continue;
            pushNewItemLive(session.liveCode, billId, item).catch(() => {});
          }
        }
      },

      deleteBill: (sessionId, billId) =>
        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== sessionId) return s;
            return touchSession({
              ...s,
              bills: s.bills.filter((b) => b.id !== billId),
              currentBillId: s.currentBillId === billId ? null : s.currentBillId,
            });
          }),
        })),

      setCurrentBill: (sessionId, billId) =>
        set((state) => ({
          sessions: state.sessions.map((s) => (s.id === sessionId ? touchSession({ ...s, currentBillId: billId }) : s)),
        })),

      getBill: (sessionId, billId) => {
        const session = get().sessions.find((s) => s.id === sessionId);
        return session?.bills.find((b) => b.id === billId);
      },

      setBillPaidBy: (sessionId, billId, personId) => {
        get().updateBill(sessionId, billId, { paidByPersonId: personId });
      },

      setBillItems: (sessionId, billId, items) => {
        get().updateBill(sessionId, billId, { items });
      },

      addPerson: (sessionId, name) => {
        const newPerson: Person = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name,
        };
        let created = false;

        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== sessionId) return s;
            created = true;
            return touchSession({ ...s, people: [...s.people, newPerson] });
          }),
        }));

        return created ? newPerson : undefined;
      },

      removePerson: (sessionId, personId) =>
        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== sessionId) return s;
            return touchSession({
              ...s,
              people: s.people.filter((p) => p.id !== personId),
              bills: s.bills.map((b) => ({
                ...b,
                paidByPersonId: b.paidByPersonId === personId ? null : b.paidByPersonId,
                items: b.items.map((item) => ({
                  ...item,
                  consumedBy: item.consumedBy.filter((allocation) => allocation.personId !== personId),
                })),
              })),
            });
          }),
        })),

      updatePerson: (sessionId, personId, name) =>
        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== sessionId) return s;
            return touchSession({
              ...s,
              people: s.people.map((p) => (p.id === personId ? { ...p, name } : p)),
            });
          }),
        })),

      setSessionPeople: (sessionId, people) =>
        set((state) => ({
          sessions: state.sessions.map((s) => (s.id === sessionId ? touchSession({ ...s, people }) : s)),
        })),

      markSessionLive: (sessionId, liveCode, liveCreatorToken) =>
        set((state) => ({
          sessions: state.sessions.map((s) => (s.id === sessionId ? touchSession({ ...s, isLive: true, liveCode, liveCreatorToken }) : s)),
        })),

      mergeLiveSnapshot: (sessionId, liveSession) =>
        set((state) => ({
          sessions: state.sessions.map((s) => (s.id === sessionId ? mergeLiveSessionInto(s, liveSession) : s)),
        })),

      exportSession: (sessionId) => {
        const session = get().sessions.find((s) => s.id === sessionId);
        if (!session) return null;
        return JSON.stringify({
          version: SESSION_STORE_VERSION,
          session,
          exportDate: new Date().toISOString(),
        });
      },

      importSession: (jsonString) => {
        try {
          const imported = JSON.parse(jsonString);

          // Distinguish a pre-v3 (bill/billHistory) export from a session
          // export by shape, so the error message actually helps the user
          // instead of a generic "invalid format".
          if (imported && typeof imported === 'object' && 'bills' in imported && !('session' in imported)) {
            return {
              success: false,
              error: 'This is an old bill-history export (pre-session format) and cannot be imported here directly.',
            };
          }
          if (!imported || typeof imported !== 'object' || !('session' in imported)) {
            return { success: false, error: 'Invalid session data format' };
          }

          const result = SessionSchema.safeParse(imported.session);
          if (!result.success) {
            return { success: false, error: 'Invalid session data format' };
          }

          set((state) => {
            const existingIds = new Set(state.sessions.map((s) => s.id));
            if (existingIds.has(result.data.id)) {
              // Avoid clobbering an existing session with the same id
              return {
                sessions: [...state.sessions, { ...result.data, id: generateId() }],
              };
            }
            return { sessions: [...state.sessions, result.data] };
          });

          return { success: true };
        } catch (error) {
          console.error('Failed to import session:', error);
          return { success: false, error: (error as Error).message };
        }
      },
    }),
    {
      name: 'billSplitterSession',
      merge: (persistedState, currentState) => {
        if (persistedState === undefined) {
          return currentState;
        }
        const result = SessionStoreStateSchema.safeParse(persistedState);
        if (!result.success) {
          console.error('Failed to parse persisted sessionStore state, falling back to defaults:', result.error);
          return currentState;
        }
        return { ...currentState, ...result.data };
      },
    }
  )
);

export default useSessionStore;
