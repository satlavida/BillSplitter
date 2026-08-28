import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateId } from './lib/generateId';
import { SessionStoreStateSchema, SessionSchema, SESSION_STORE_VERSION, type Session, type Bill } from './schemas/session.schema';
import type { Item, Person, DiscountType, SplitType } from './schemas/bill.schema';
import type { LiveSession, LiveBill, LiveItem } from './schemas/live.schema';
import { getImageBlob } from './lib/imageStore';
import { trackPendingLiveWrite, isPendingLiveWrite } from './lib/pendingLiveWrites';
import useSettingsStore from './settingsStore';
import useCurrencyStore from './currencyStore';

// Dynamically imported (rather than a static import) so this module never
// pulls in liveApi.ts's `import.meta.env` reference at parse time — Jest's
// Babel/CJS transform can't handle that syntax at all, even in code paths
// that never execute (see liveSync.ts's baseUrl-as-parameter workaround for
// the same underlying issue). A dynamic import here is only ever resolved
// when actually pushing to a live session, which no unit test does.
//
// Each push helper wraps its own promise in trackPendingLiveWrite so every
// call site (updateBill, addBill, syncExistingBillsLive) gets pending-write
// tracking for free — see pendingLiveWrites.ts and mergeLiveBill below for
// what consumes it.
const pushNewBillLive = (liveCode: string, bill: Pick<Bill, 'id' | 'title' | 'currency' | 'taxAmount'>) =>
  trackPendingLiveWrite(`bill:${bill.id}:fields`, import('./lib/liveApi').then(({ addLiveBill }) => addLiveBill(liveCode, bill)));

const pushNewItemLive = (liveCode: string, billId: string, item: Item) =>
  trackPendingLiveWrite(`item:${item.id}:fields`, import('./lib/liveApi').then(({ addLiveItem }) => addLiveItem(liveCode, billId, item)));

const pushBillFieldsLive = (
  liveCode: string,
  billId: string,
  bill: Pick<Bill, 'title' | 'currency' | 'taxAmount' | 'paidByPersonId' | 'exchangeRate' | 'exchangeRateDate' | 'exchangeRateIsOverride'>
) => trackPendingLiveWrite(`bill:${billId}:fields`, import('./lib/liveApi').then(({ updateLiveBill }) => updateLiveBill(liveCode, billId, bill)));

// Pushes a session-currency change to the live server (creator-only). Kept
// separate from the per-bill push helpers above since it targets the
// session row, not a bill — mirrors their trackPendingLiveWrite/fire-and-
// forget pattern (see setSessionCurrency).
const pushSessionCurrencyLive = (liveCode: string, currency: string, creatorToken: string) =>
  trackPendingLiveWrite(`session:${liveCode}:currency`, import('./lib/liveApi').then(({ updateLiveSessionCurrency }) => updateLiveSessionCurrency(liveCode, currency, creatorToken)));

const pushItemFieldsLive = (liveCode: string, billId: string, item: Item) =>
  trackPendingLiveWrite(`item:${item.id}:fields`, import('./lib/liveApi').then(({ updateLiveItem }) => updateLiveItem(liveCode, billId, item.id, item)));

// Pushes consumedBy changes as creator-initiated (token-free) claims/
// unclaims — see liveApi.ts's claimItem/unclaimItem dual-mode auth. This is
// what keeps the creator's own item-assignment UI (ItemAssignment,
// PassAndSplit — both write into billStore, which flows into updateBill
// below) from being silently reverted by the next live-snapshot refresh:
// consumedBy is server-authoritative, so a local consumedBy edit that never
// reaches the server gets overwritten by mergeLiveSnapshot as soon as one
// arrives.
const pushClaimLive = (liveCode: string, billId: string, itemId: string, personId: string, value: number) =>
  trackPendingLiveWrite(`item:${itemId}:consumedBy`, import('./lib/liveApi').then(({ claimItem }) => claimItem(liveCode, billId, itemId, personId, value)));

const pushUnclaimLive = (liveCode: string, billId: string, itemId: string, personId: string) =>
  trackPendingLiveWrite(`item:${itemId}:consumedBy`, import('./lib/liveApi').then(({ unclaimItem }) => unclaimItem(liveCode, billId, itemId, personId)));

function syncConsumedByLive(liveCode: string, billId: string, itemId: string, previous: Item['consumedBy'], next: Item['consumedBy']) {
  const previousByPerson = new Map(previous.map((c) => [c.personId, c.value]));
  const nextByPerson = new Map(next.map((c) => [c.personId, c.value]));

  for (const [personId, value] of nextByPerson) {
    if (previousByPerson.get(personId) !== value) {
      pushClaimLive(liveCode, billId, itemId, personId, value).catch(() => {});
    }
  }
  for (const personId of previousByPerson.keys()) {
    if (!nextByPerson.has(personId)) {
      pushUnclaimLive(liveCode, billId, itemId, personId).catch(() => {});
    }
  }
}

// Uploads the bill's newly-set receipt image (local IndexedDB blob, keyed
// by the *local* refKey) to the live server, which returns its own refKey —
// distinct namespaces, joined only via LiveBillSchema's imageRefKey once the
// next snapshot comes back. imageStore.ts has no import.meta.env reference,
// so it's safe to import statically (unlike liveApi.ts above).
const pushReceiptImageLive = (liveCode: string, billId: string, receiptImage: { refKey: string; width: number; height: number }) =>
  trackPendingLiveWrite(
    `bill:${billId}:receiptImage`,
    (async () => {
      const blob = await getImageBlob(receiptImage.refKey);
      if (!blob) return;
      const { uploadLiveImage } = await import('./lib/liveApi');
      await uploadLiveImage(liveCode, billId, blob, receiptImage.width, receiptImage.height);
    })()
  );

const BILL_FIELD_KEYS = ['title', 'currency', 'taxAmount', 'paidByPersonId', 'exchangeRate', 'exchangeRateDate', 'exchangeRateIsOverride'] as const;
const ITEM_FIELD_KEYS = ['name', 'price', 'quantity', 'discount', 'discountType', 'splitType'] as const;

function billFieldsChanged(a: Bill, b: Bill): boolean {
  return BILL_FIELD_KEYS.some((key) => a[key] !== b[key]);
}

function itemFieldsChanged(a: Item, b: Item): boolean {
  return ITEM_FIELD_KEYS.some((key) => a[key] !== b[key]);
}

function localBillDiffersFromLive(local: Bill, remote: LiveBill): boolean {
  return (
    local.title !== remote.title ||
    local.currency !== remote.currency ||
    local.taxAmount !== remote.taxAmount ||
    local.paidByPersonId !== remote.paidByPersonId ||
    local.exchangeRate !== remote.exchangeRate ||
    local.exchangeRateDate !== remote.exchangeRateDate ||
    local.exchangeRateIsOverride !== remote.exchangeRateIsOverride
  );
}

function localItemDiffersFromLive(local: Item, remote: LiveItem): boolean {
  return (
    local.name !== remote.name ||
    local.price !== remote.price ||
    local.quantity !== remote.quantity ||
    local.discount !== remote.discount ||
    local.discountType !== remote.discountType ||
    local.splitType !== remote.splitType
  );
}

// Fixes a bug where activating "Go Live" on a session that already has
// bills never pushed them up — only addBill/updateBill push, and both were
// only ever called *after* isLive was already true. Called (fire-and-forget,
// like every other live push in this file) right after markSessionLive sets
// isLive, this does a compare-and-sync instead of a blind re-push: it fetches
// what the server already knows about (covering a retried/partial prior
// activation) and only pushes bills/items that are missing or changed, so
// it's safe to call unconditionally on every Go Live activation.
async function syncExistingBillsLive(liveCode: string, bills: Bill[]) {
  const { getLiveSession } = await import('./lib/liveApi');
  let remoteSession: LiveSession;
  try {
    remoteSession = await getLiveSession(liveCode);
  } catch {
    return;
  }
  const remoteBillsById = new Map(remoteSession.bills.map((b) => [b.id, b]));

  for (const bill of bills) {
    const remoteBill = remoteBillsById.get(bill.id);

    if (!remoteBill) {
      await pushNewBillLive(liveCode, { id: bill.id, title: bill.title, currency: bill.currency, taxAmount: bill.taxAmount }).catch(() => {});
      for (const item of bill.items) {
        await pushNewItemLive(liveCode, bill.id, item).catch(() => {});
        syncConsumedByLive(liveCode, bill.id, item.id, [], item.consumedBy);
      }
      if (bill.paidByPersonId) {
        await pushBillFieldsLive(liveCode, bill.id, {
          title: bill.title,
          currency: bill.currency,
          taxAmount: bill.taxAmount,
          paidByPersonId: bill.paidByPersonId,
          exchangeRate: bill.exchangeRate,
          exchangeRateDate: bill.exchangeRateDate,
          exchangeRateIsOverride: bill.exchangeRateIsOverride,
        }).catch(() => {});
      }
      if (bill.receiptImage) {
        await pushReceiptImageLive(liveCode, bill.id, bill.receiptImage).catch(() => {});
      }
      continue;
    }

    if (localBillDiffersFromLive(bill, remoteBill)) {
      await pushBillFieldsLive(liveCode, bill.id, {
        title: bill.title,
        currency: bill.currency,
        taxAmount: bill.taxAmount,
        paidByPersonId: bill.paidByPersonId,
        exchangeRate: bill.exchangeRate,
        exchangeRateDate: bill.exchangeRateDate,
        exchangeRateIsOverride: bill.exchangeRateIsOverride,
      }).catch(() => {});
    }

    const remoteItemsById = new Map(remoteBill.items.map((i) => [i.id, i]));
    for (const item of bill.items) {
      const remoteItem = remoteItemsById.get(item.id);
      if (!remoteItem) {
        await pushNewItemLive(liveCode, bill.id, item).catch(() => {});
        syncConsumedByLive(liveCode, bill.id, item.id, [], item.consumedBy);
      } else {
        if (localItemDiffersFromLive(item, remoteItem)) {
          await pushItemFieldsLive(liveCode, bill.id, item).catch(() => {});
        }
        syncConsumedByLive(liveCode, bill.id, item.id, remoteItem.consumedBy, item.consumedBy);
      }
    }

    if (bill.receiptImage && !remoteBill.imageRefKey) {
      await pushReceiptImageLive(liveCode, bill.id, bill.receiptImage).catch(() => {});
    }
  }
}

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
  exchangeRate: overrides?.exchangeRate ?? null,
  exchangeRateDate: overrides?.exchangeRateDate ?? null,
  exchangeRateIsOverride: overrides?.exchangeRateIsOverride ?? false,
  paidByPersonId: overrides?.paidByPersonId ?? null,
  receiptImage: overrides?.receiptImage ?? null,
  splitStateVersion: SESSION_STORE_VERSION,
  scanStatus: overrides?.scanStatus ?? 'idle',
  scanError: overrides?.scanError ?? null,
});

interface SessionStoreActions {
  createSession: (title?: string) => Session;
  deleteSession: (sessionId: string) => void;
  setCurrentSession: (sessionId: string) => void;
  getCurrentSession: () => Session | undefined;
  getSession: (sessionId: string) => Session | undefined;
  setSessionTitle: (sessionId: string, title: string) => void;
  // Sets the session's base currency (Session Settings panel). Best-effort
  // pushed to the live server if the session is live — see
  // pushSessionCurrencyLive; a failed push doesn't block/roll back the
  // local change, mirroring every other live push in this file.
  setSessionCurrency: (sessionId: string, currency: string) => void;

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
  unmarkSessionLive: (sessionId: string) => void;

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

// Per-item, per-field-group merge: fields and consumedBy each have their
// own live push (pushItemFieldsLive vs pushClaimLive/pushUnclaimLive), so
// each is gated independently — an in-flight consumedBy push shouldn't
// block a concurrent field edit from picking up the remote value, and vice
// versa.
function mergeLiveItem(local: Item | undefined, remote: LiveItem): Item {
  const remoteFields = {
    name: remote.name,
    price: remote.price,
    quantity: remote.quantity,
    discount: remote.discount,
    discountType: remote.discountType as DiscountType,
    splitType: remote.splitType as SplitType,
  };
  const fields = local && isPendingLiveWrite(`item:${remote.id}:fields`) ? local : remoteFields;
  const consumedBy = local && isPendingLiveWrite(`item:${remote.id}:consumedBy`) ? local.consumedBy : remote.consumedBy;

  return { id: remote.id, ...fields, consumedBy };
}

function mergeLiveBill(local: Bill | undefined, remote: LiveSession['bills'][number]): Bill {
  const localItemsById = new Map((local?.items ?? []).map((item) => [item.id, item]));
  for (const remoteItem of remote.items) {
    localItemsById.set(remoteItem.id, mergeLiveItem(localItemsById.get(remoteItem.id), remoteItem));
  }
  const items: Item[] = Array.from(localItemsById.values());

  const billFieldsPending = isPendingLiveWrite(`bill:${remote.id}:fields`);

  return {
    id: remote.id,
    title: billFieldsPending ? (local?.title ?? remote.title) : remote.title,
    date: remote.date,
    items,
    taxAmount: billFieldsPending ? (local?.taxAmount ?? remote.taxAmount) : remote.taxAmount,
    currency: billFieldsPending ? (local?.currency ?? remote.currency) : remote.currency,
    paidByPersonId: billFieldsPending ? (local?.paidByPersonId ?? remote.paidByPersonId) : remote.paidByPersonId,
    exchangeRate: billFieldsPending ? (local?.exchangeRate ?? remote.exchangeRate) : remote.exchangeRate,
    exchangeRateDate: billFieldsPending ? (local?.exchangeRateDate ?? remote.exchangeRateDate) : remote.exchangeRateDate,
    exchangeRateIsOverride: billFieldsPending ? (local?.exchangeRateIsOverride ?? remote.exchangeRateIsOverride) : remote.exchangeRateIsOverride,
    receiptImage: local?.receiptImage ?? null,
    splitStateVersion: local?.splitStateVersion ?? SESSION_STORE_VERSION,
    scanStatus: local?.scanStatus ?? 'idle',
    scanError: local?.scanError ?? null,
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
        const { autoAddSelf, selfName } = useSettingsStore.getState();
        const trimmedSelfName = selfName.trim();
        const now = new Date().toISOString();
        const newSession: Session = {
          id: generateId(),
          title: title || 'Untitled Session',
          createdAt: now,
          updatedAt: now,
          people: autoAddSelf && trimmedSelfName ? [{ id: generateId(), name: trimmedSelfName }] : [],
          bills: [],
          currentBillId: null,
          isLive: false,
          liveCode: null,
          liveCreatorToken: null,
          permissionMode: 'edit',
          creatorPersonId: null,
          // One-time seed from the user's global currency preference — not
          // a live link; changing the global preference later doesn't
          // retroactively change existing sessions (see currencyStore.ts).
          currency: useCurrencyStore.getState().currency,
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

      setSessionCurrency: (sessionId, currency) => {
        const session = get().sessions.find((s) => s.id === sessionId);

        set((state) => ({
          sessions: state.sessions.map((s) => (s.id === sessionId ? touchSession({ ...s, currency }) : s)),
        }));

        if (session?.isLive && session.liveCode && session.liveCreatorToken) {
          pushSessionCurrencyLive(session.liveCode, currency, session.liveCreatorToken).catch(() => {});
        }
      },

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
        const previousBill = session?.bills.find((b) => b.id === billId);
        const previousItems = previousBill?.items;

        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== sessionId) return s;
            return touchSession({
              ...s,
              bills: s.bills.map((b) => (b.id === billId ? { ...b, ...data } : b)),
            });
          }),
        }));

        // Best-effort push to the live server: new items get created,
        // already-known items with changed fields get updated, and changed
        // bill-level fields get updated. consumedBy/allocations are never
        // part of this — those stay server-authoritative via the claim
        // endpoints (see liveApi.ts's updateLiveItem).
        if (!session?.isLive || !session.liveCode || !previousBill) return;
        const liveCode = session.liveCode;

        if (data.items && previousItems) {
          const previousById = new Map(previousItems.map((i) => [i.id, i]));
          for (const item of data.items) {
            const previous = previousById.get(item.id);
            if (!previous) {
              pushNewItemLive(liveCode, billId, item).catch(() => {});
              syncConsumedByLive(liveCode, billId, item.id, [], item.consumedBy);
            } else {
              if (itemFieldsChanged(previous, item)) {
                pushItemFieldsLive(liveCode, billId, item).catch(() => {});
              }
              syncConsumedByLive(liveCode, billId, item.id, previous.consumedBy, item.consumedBy);
            }
          }
        }

        const updatedBill: Bill = { ...previousBill, ...data };
        if (billFieldsChanged(previousBill, updatedBill)) {
          pushBillFieldsLive(liveCode, billId, {
            title: updatedBill.title,
            currency: updatedBill.currency,
            taxAmount: updatedBill.taxAmount,
            paidByPersonId: updatedBill.paidByPersonId,
            exchangeRate: updatedBill.exchangeRate,
            exchangeRateDate: updatedBill.exchangeRateDate,
            exchangeRateIsOverride: updatedBill.exchangeRateIsOverride,
          }).catch(() => {});
        }

        if (data.receiptImage && data.receiptImage.refKey !== previousBill.receiptImage?.refKey) {
          pushReceiptImageLive(liveCode, billId, data.receiptImage).catch(() => {});
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

      markSessionLive: (sessionId, liveCode, liveCreatorToken) => {
        const bills = get().sessions.find((s) => s.id === sessionId)?.bills ?? [];

        set((state) => ({
          sessions: state.sessions.map((s) => (s.id === sessionId ? touchSession({ ...s, isLive: true, liveCode, liveCreatorToken }) : s)),
        }));

        // Fire-and-forget, matching every other live push in this file — a
        // failed sync here doesn't block Go Live from completing locally.
        if (bills.length > 0) {
          syncExistingBillsLive(liveCode, bills).catch(() => {});
        }
      },

      // Req 15: clears local isLive/liveCode/liveCreatorToken after the
      // online mirror has been deleted server-side — never touches
      // people/bills, so the session's own offline data survives untouched
      // and the creator can go live again later.
      unmarkSessionLive: (sessionId) =>
        set((state) => ({
          sessions: state.sessions.map((s) => (s.id === sessionId ? touchSession({ ...s, isLive: false, liveCode: null, liveCreatorToken: null }) : s)),
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
