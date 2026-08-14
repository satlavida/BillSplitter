import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateId } from './lib/generateId';
import { SessionStoreStateSchema, SessionSchema, SESSION_STORE_VERSION, type Session, type Bill } from './schemas/session.schema';
import type { Item, Person } from './schemas/bill.schema';

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
}

type SessionStore = SessionStoreState & SessionStoreActions;

const initialState: SessionStoreState = {
  version: SESSION_STORE_VERSION,
  sessions: [],
  currentSessionId: null,
  migratedFromV1: false,
};

const touchSession = (session: Session): Session => ({ ...session, updatedAt: new Date().toISOString() });

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

        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== sessionId) return s;
            created = true;
            return touchSession({ ...s, bills: [...s.bills, newBill], currentBillId: newBill.id });
          }),
        }));

        return created ? newBill : undefined;
      },

      updateBill: (sessionId, billId, data) =>
        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== sessionId) return s;
            return touchSession({
              ...s,
              bills: s.bills.map((b) => (b.id === billId ? { ...b, ...data } : b)),
            });
          }),
        })),

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
