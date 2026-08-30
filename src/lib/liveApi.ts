import { z } from 'zod';
import {
  CreateLiveSessionResponseSchema,
  LiveSessionSchema,
  LiveJoinerSchema,
  LiveSettlementSchema,
  LiveBillSchema,
  LiveItemSchema,
  LiveActivityEntrySchema,
  SessionStatusSchema,
  LivePaymentSchema,
  type CreateLiveSessionResponse,
  type LiveSession,
  type LiveJoiner,
  type LiveSettlement,
  type LiveBill,
  type LiveItem,
  type LiveActivityEntry,
  type SessionStatus,
  type LivePayment,
} from '../schemas/live.schema';
import type { Person, Item, Payment } from '../schemas/bill.schema';
import { friendlyErrorMessage } from './errorMessages';

// Base URL of the Go live-collaboration server (server/cmd/server), also
// used by receiptScan.ts for POST /api/scan. Defaults to the local dev
// server so `go run ./server/cmd/server` works out of the box without any
// .env changes.
const LIVE_SERVER_URL = import.meta.env.VITE_LIVE_SERVER_URL || 'http://localhost:8080';

class LiveApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'LiveApiError';
  }
}

async function request<T>(path: string, init: RequestInit, schema: { parse: (v: unknown) => T }): Promise<T> {
  const res = await fetch(`${LIVE_SERVER_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  if (!res.ok) {
    let rawMessage = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) rawMessage = body.error;
    } catch {
      // ignore — use the generic message
    }
    throw new LiveApiError(friendlyErrorMessage(rawMessage), res.status);
  }
  return schema.parse(await res.json());
}

export const createLiveSession = (
  title: string,
  people: Person[],
  joinMode: 'approval_code' | 'open_link',
  claimMode: 'free_select' | 'claims_require_approval',
  permissionMode?: 'edit' | 'read_only',
  creatorPersonId?: string | null,
  currency?: string
): Promise<CreateLiveSessionResponse> =>
  request(
    '/api/sessions',
    {
      method: 'POST',
      body: JSON.stringify({ title, people, joinMode, claimMode, permissionMode, creatorPersonId: creatorPersonId ?? null, currency }),
    },
    CreateLiveSessionResponseSchema
  );

export const getLiveSession = (code: string): Promise<LiveSession> => request(`/api/sessions/${code}`, { method: 'GET' }, LiveSessionSchema);

// Batch status for a joiner's client to reconcile joinedSessionsStorage.ts's
// locally-tracked "sessions I've joined" list in one request instead of one
// getLiveSession call per session.
export const getSessionsStatus = (codes: string[]): Promise<SessionStatus[]> =>
  request(
    '/api/sessions/status',
    { method: 'POST', body: JSON.stringify({ codes }) },
    z.object({ statuses: z.array(SessionStatusSchema) })
  ).then((r) => r.statuses);

// Pushes a locally-created bill/item up to a live session, keeping the same
// id on both sides (server accepts a client-supplied id) so sessionStore's
// entity-id merge updates it in place instead of duplicating it once the
// next live snapshot comes back.
// joinerToken is optional — only the joiner UI (JoinerSessionView.tsx's Add
// Bill/Scan New Bill) sends it, so requireEditPermission server-side
// actually gates a read-only joiner's attempt; the creator's own token-free
// UI is always allowed, same as every other dual-mode endpoint here.
export const addLiveBill = (
  code: string,
  bill: { id: string; title: string; currency: string; taxAmount: number },
  joinerToken?: string
): Promise<LiveBill> =>
  request(
    `/api/sessions/${code}/bills`,
    { method: 'POST', body: JSON.stringify(bill), headers: joinerToken ? { 'X-Joiner-Token': joinerToken } : {} },
    LiveBillSchema
  );

export const addLiveItem = (
  code: string,
  billId: string,
  item: Pick<Item, 'id' | 'name' | 'price' | 'quantity' | 'discount' | 'discountType' | 'splitType'>,
  joinerToken?: string
): Promise<LiveItem> =>
  request(
    `/api/sessions/${code}/bills/${billId}/items`,
    { method: 'POST', body: JSON.stringify(item), headers: joinerToken ? { 'X-Joiner-Token': joinerToken } : {} },
    LiveItemSchema
  );

// Syncs edits to an already-pushed bill/item's own fields. Deliberately
// never sends consumedBy/allocations — those stay server-authoritative,
// driven only by the claim endpoints, so an edit here can't clobber a
// joiner's claim.
// joinerToken is optional, same reasoning as addLiveBill's.
export const updateLiveBill = (
  code: string,
  billId: string,
  bill: {
    title: string;
    currency: string;
    taxAmount: number;
    paidByPersonId: string | null;
    exchangeRate: number | null;
    exchangeRateDate: string | null;
    exchangeRateIsOverride: boolean;
  },
  joinerToken?: string
): Promise<void> =>
  request(
    `/api/sessions/${code}/bills/${billId}`,
    { method: 'PATCH', body: JSON.stringify(bill), headers: joinerToken ? { 'X-Joiner-Token': joinerToken } : {} },
    { parse: () => undefined }
  );

// Soft-deletes a bill — it drops out of getLiveSession's bills for both the
// creator and joiners, but stays recoverable via restoreLiveBill until a
// creator permanently removes it (permanentlyDeleteLiveBill). personId/
// joinerToken are optional (personId as a query param, since DELETE carries
// no body here) — only sent by the joiner UI, to attribute the deletion in
// the activity log; the creator's own UI omits both.
export const deleteLiveBill = (code: string, billId: string, personId?: string, joinerToken?: string): Promise<void> =>
  request(
    `/api/sessions/${code}/bills/${billId}${personId ? `?personId=${encodeURIComponent(personId)}` : ''}`,
    { method: 'DELETE', headers: joinerToken ? { 'X-Joiner-Token': joinerToken } : {} },
    { parse: () => undefined }
  );

// Reverses deleteLiveBill. Creator-only (requireCreator server-side).
export const restoreLiveBill = (code: string, billId: string, creatorToken: string): Promise<void> =>
  request(`/api/sessions/${code}/bills/${billId}/restore`, { method: 'POST', headers: { 'X-Creator-Token': creatorToken } }, { parse: () => undefined });

// Irreversibly removes a bill (and its items/allocations/images). Creator-only.
export const permanentlyDeleteLiveBill = (code: string, billId: string, creatorToken: string): Promise<void> =>
  request(`/api/sessions/${code}/bills/${billId}/permanent`, { method: 'DELETE', headers: { 'X-Creator-Token': creatorToken } }, { parse: () => undefined });

// Lists a session's soft-deleted bills, for the creator-only "Deleted
// Bills" review UI (restore/permanently remove). Creator-only.
export const listDeletedLiveBills = (code: string, creatorToken: string): Promise<LiveBill[]> =>
  request(`/api/sessions/${code}/bills/deleted`, { method: 'GET', headers: { 'X-Creator-Token': creatorToken } }, z.array(LiveBillSchema));

// Updates a live session's base currency (creator-only — see
// api.requireCreator server-side). Session Settings panel writes here.
export const updateLiveSessionCurrency = (code: string, currency: string, creatorToken: string): Promise<void> =>
  request(
    `/api/sessions/${code}/currency`,
    { method: 'PATCH', body: JSON.stringify({ currency }), headers: { 'X-Creator-Token': creatorToken } },
    { parse: () => undefined }
  );

// personId/joinerToken are optional and only sent by the joiner UI
// (EditLiveItemModal.tsx) — they attribute the edit to that joiner in the
// activity log (see bill_handlers.go's UpdateItem). The creator's own
// live-editing UI omits both and the edit goes unlogged, as before.
export const updateLiveItem = (
  code: string,
  billId: string,
  itemId: string,
  item: Pick<Item, 'name' | 'price' | 'quantity' | 'discount' | 'discountType' | 'splitType'>,
  personId?: string,
  joinerToken?: string
): Promise<void> =>
  request(
    `/api/sessions/${code}/bills/${billId}/items/${itemId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ ...item, personId: personId ?? '' }),
      headers: joinerToken ? { 'X-Joiner-Token': joinerToken } : {},
    },
    { parse: () => undefined }
  );

// Removes an item entirely (and, server-side, any claims on it). personId/
// joinerToken are optional for the same reason as updateLiveItem's — only
// the joiner UI sends them, to attribute+log the deletion.
export const deleteLiveItem = (code: string, billId: string, itemId: string, personId?: string, joinerToken?: string): Promise<void> =>
  request(
    `/api/sessions/${code}/bills/${billId}/items/${itemId}${personId ? `?personId=${encodeURIComponent(personId)}` : ''}`,
    { method: 'DELETE', headers: joinerToken ? { 'X-Joiner-Token': joinerToken } : {} },
    { parse: () => undefined }
  );

export const joinLiveSession = (code: string, name: string, existingPersonId?: string | null): Promise<LiveJoiner> =>
  request(`/api/sessions/${code}/join`, { method: 'POST', body: JSON.stringify({ name, existingPersonId }) }, LiveJoinerSchema);

export const getJoiner = (code: string, joinerId: string): Promise<LiveJoiner> => request(`/api/sessions/${code}/joiners/${joinerId}`, { method: 'GET' }, LiveJoinerSchema);

export const listJoiners = (code: string, creatorToken: string): Promise<LiveJoiner[]> =>
  request(`/api/sessions/${code}/joiners`, { method: 'GET', headers: { 'X-Creator-Token': creatorToken } }, z.array(LiveJoinerSchema));

export const approveJoiner = (code: string, joinerId: string, creatorToken: string): Promise<void> =>
  request(
    `/api/sessions/${code}/joiners/${joinerId}/approve`,
    { method: 'POST', headers: { 'X-Creator-Token': creatorToken } },
    { parse: () => undefined }
  );

// Updates a person's name and/or upiId. Dual-mode auth mirroring
// claimItem/unclaimItem: a joiner token (their own) can only update their
// own upiId (server-enforced — see api.UpdatePerson); omitting it is the
// creator's token-free path, which can edit any field on any person.
export const updateLivePerson = (code: string, personId: string, updates: { name?: string; upiId?: string }, joinerToken?: string): Promise<void> =>
  request(
    `/api/sessions/${code}/people/${personId}`,
    { method: 'PATCH', body: JSON.stringify(updates), headers: joinerToken ? { 'X-Joiner-Token': joinerToken } : {} },
    { parse: () => undefined }
  );

export const disapproveJoiner = (code: string, joinerId: string, creatorToken: string): Promise<void> =>
  request(
    `/api/sessions/${code}/joiners/${joinerId}/disapprove`,
    { method: 'POST', headers: { 'X-Creator-Token': creatorToken } },
    { parse: () => undefined }
  );

// Not built on request() — a multipart upload must let the browser set its
// own Content-Type (with the multipart boundary); request() always forces
// 'Content-Type: application/json'.
export const uploadLiveImage = async (
  code: string,
  billId: string,
  blob: Blob,
  width: number,
  height: number,
  joinerToken?: string
): Promise<{ refKey: string }> => {
  const form = new FormData();
  form.append('image', blob, 'receipt.jpg');
  form.append('width', String(width));
  form.append('height', String(height));

  const res = await fetch(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${billId}/images`, {
    method: 'POST',
    body: form,
    headers: joinerToken ? { 'X-Joiner-Token': joinerToken } : {},
  });
  if (!res.ok) {
    throw new LiveApiError(`Request failed (${res.status})`, res.status);
  }
  return z.object({ refKey: z.string() }).parse(await res.json());
};

const ClaimItemResponseSchema = z.object({ status: z.string() });

// Directly selects/updates a person's share of an item — takes effect
// immediately, no approval queue (req 6).
export const claimItem = (code: string, billId: string, itemId: string, personId: string, value?: number, joinerToken?: string): Promise<{ status: string }> =>
  request(
    `/api/sessions/${code}/bills/${billId}/items/${itemId}/claims`,
    { method: 'POST', body: JSON.stringify({ personId, value }), headers: joinerToken ? { 'X-Joiner-Token': joinerToken } : {} },
    ClaimItemResponseSchema
  );

// A joiner can only unclaim their own personId — the server enforces this
// via joinerToken (X-Joiner-Token) when one is sent. Omitting it (the
// creator's own token-free live-editing calls) lets the creator unclaim on
// behalf of arbitrary people, mirroring claimItem's dual-mode auth.
export const unclaimItem = (code: string, billId: string, itemId: string, personId: string, joinerToken?: string): Promise<void> =>
  request(
    `/api/sessions/${code}/bills/${billId}/items/${itemId}/claims/${personId}`,
    { method: 'DELETE', headers: joinerToken ? { 'X-Joiner-Token': joinerToken } : {} },
    { parse: () => undefined }
  );

export const settleLiveSession = (code: string, creatorToken: string): Promise<void> =>
  request(`/api/sessions/${code}/settle`, { method: 'POST', headers: { 'X-Creator-Token': creatorToken } }, { parse: () => undefined });

// Req 15: permanently deletes the online mirror of a session — never the
// creator's own local/offline data.
export const deleteLiveSession = (code: string, creatorToken: string): Promise<void> =>
  request(`/api/sessions/${code}`, { method: 'DELETE', headers: { 'X-Creator-Token': creatorToken } }, { parse: () => undefined });

// Logs a payment. Either party can log one for themselves — actingPersonToken
// is their own X-Joiner-Token, required whenever addedByPersonId isn't the
// creator (server rejects a joiner logging on someone else's behalf, see
// payment_handlers.go). Omitting it is the creator's token-free path, which
// can log on behalf of anyone. Returns the server's own record, including
// its authoritative `verified` value — see sessionStore.ts's mergeLivePayment.
export const addLivePayment = (
  code: string,
  payment: Pick<
    Payment,
    'id' | 'payerId' | 'payeeId' | 'amount' | 'currency' | 'exchangeRate' | 'exchangeRateDate' | 'exchangeRateIsOverride' | 'method' | 'transactionId' | 'addedByPersonId'
  >,
  actingPersonToken?: string
): Promise<LivePayment> =>
  request(
    `/api/sessions/${code}/payments`,
    { method: 'POST', body: JSON.stringify(payment), headers: actingPersonToken ? { 'X-Joiner-Token': actingPersonToken } : {} },
    LivePaymentSchema
  );

// Marks a payment verified. Only the payee's own token, or the creator
// token-free, is accepted server-side — the payer verifying their own
// payment is rejected (403).
export const verifyLivePayment = (code: string, paymentId: string, joinerToken?: string): Promise<void> =>
  request(
    `/api/sessions/${code}/payments/${paymentId}/verify`,
    { method: 'POST', headers: joinerToken ? { 'X-Joiner-Token': joinerToken } : {} },
    { parse: () => undefined }
  );

// Creator-only — mirrors updateLiveSessionCurrency.
export const updateLiveRequirePaymentVerification = (code: string, value: boolean, creatorToken: string): Promise<void> =>
  request(
    `/api/sessions/${code}/settings/require-payment-verification`,
    { method: 'PATCH', body: JSON.stringify({ requirePaymentVerification: value }), headers: { 'X-Creator-Token': creatorToken } },
    { parse: () => undefined }
  );

export const getLiveSettlement = (code: string): Promise<LiveSettlement> =>
  request(`/api/sessions/${code}/settlement`, { method: 'GET' }, LiveSettlementSchema);

export const getActivityLog = (code: string, creatorToken: string): Promise<LiveActivityEntry[]> =>
  request(`/api/sessions/${code}/activity`, { method: 'GET', headers: { 'X-Creator-Token': creatorToken } }, z.array(LiveActivityEntrySchema));

// Req 3: a joiner's client calls this every 500ms while their view is
// mounted (see hooks/usePresenceHeartbeat.ts) so the server's presence.Tracker
// knows they're still active — both for the creator's online indicator and
// for whether their identity can be reclaimed by someone else (see
// server/internal/presence).
export const sendPresenceHeartbeat = (code: string, personId: string, joinerToken: string): Promise<void> =>
  request(
    `/api/sessions/${code}/presence/heartbeat`,
    { method: 'POST', body: JSON.stringify({ personId }), headers: { 'X-Joiner-Token': joinerToken } },
    { parse: () => undefined }
  );

const PresenceResponseSchema = z.object({
  online: z.array(z.string()).default([]),
  // Per online personId, when their current continuous-activity streak
  // began (RFC3339) — server/internal/presence.Tracker.ActiveSince. Used to
  // gate renaming an active/claimed person (see PeopleSection.tsx).
  activeSince: z.record(z.string(), z.string()).default({}),
});
export type PresenceResponse = z.infer<typeof PresenceResponseSchema>;

export const getPresence = (code: string): Promise<PresenceResponse> =>
  request(`/api/sessions/${code}/presence`, { method: 'GET' }, PresenceResponseSchema);

export { LiveApiError, LIVE_SERVER_URL };
