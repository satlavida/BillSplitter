import { z } from 'zod';
import {
  CreateLiveSessionResponseSchema,
  LiveSessionSchema,
  LiveJoinerSchema,
  LiveSettlementSchema,
  ClaimItemResponseSchema,
  LiveBillSchema,
  LiveItemSchema,
  type CreateLiveSessionResponse,
  type LiveSession,
  type LiveJoiner,
  type LiveSettlement,
  type ClaimItemResponse,
  type LiveBill,
  type LiveItem,
} from '../schemas/live.schema';
import type { Person, Item } from '../schemas/bill.schema';

// Base URL of the Go live-collaboration server (server/cmd/server). Follows
// the same import.meta.env pattern as ScanReceiptButton's VITE_WORKER_URL,
// defaulting to the local dev server so `go run ./server/cmd/server` works
// out of the box without any .env changes.
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
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore — use the generic message
    }
    throw new LiveApiError(message, res.status);
  }
  return schema.parse(await res.json());
}

export const createLiveSession = (
  title: string,
  people: Person[],
  joinMode: 'approval_code' | 'open_link',
  claimMode: 'free_select' | 'claims_require_approval'
): Promise<CreateLiveSessionResponse> =>
  request(
    '/api/sessions',
    { method: 'POST', body: JSON.stringify({ title, people, joinMode, claimMode }) },
    CreateLiveSessionResponseSchema
  );

export const getLiveSession = (code: string): Promise<LiveSession> => request(`/api/sessions/${code}`, { method: 'GET' }, LiveSessionSchema);

// Pushes a locally-created bill/item up to a live session, keeping the same
// id on both sides (server accepts a client-supplied id) so sessionStore's
// entity-id merge updates it in place instead of duplicating it once the
// next live snapshot comes back.
export const addLiveBill = (
  code: string,
  bill: { id: string; title: string; currency: string; taxAmount: number }
): Promise<LiveBill> => request(`/api/sessions/${code}/bills`, { method: 'POST', body: JSON.stringify(bill) }, LiveBillSchema);

export const addLiveItem = (code: string, billId: string, item: Pick<Item, 'id' | 'name' | 'price' | 'quantity' | 'discount' | 'discountType' | 'splitType'>): Promise<LiveItem> =>
  request(`/api/sessions/${code}/bills/${billId}/items`, { method: 'POST', body: JSON.stringify(item) }, LiveItemSchema);

// Syncs edits to an already-pushed bill/item's own fields. Deliberately
// never sends consumedBy/allocations — those stay server-authoritative,
// driven only by the claim endpoints, so an edit here can't clobber a
// joiner's claim.
export const updateLiveBill = (
  code: string,
  billId: string,
  bill: { title: string; currency: string; taxAmount: number; paidByPersonId: string | null }
): Promise<void> => request(`/api/sessions/${code}/bills/${billId}`, { method: 'PATCH', body: JSON.stringify(bill) }, { parse: () => undefined });

export const updateLiveItem = (
  code: string,
  billId: string,
  itemId: string,
  item: Pick<Item, 'name' | 'price' | 'quantity' | 'discount' | 'discountType' | 'splitType'>
): Promise<void> =>
  request(`/api/sessions/${code}/bills/${billId}/items/${itemId}`, { method: 'PATCH', body: JSON.stringify(item) }, { parse: () => undefined });

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

export const disapproveJoiner = (code: string, joinerId: string, creatorToken: string): Promise<void> =>
  request(
    `/api/sessions/${code}/joiners/${joinerId}/disapprove`,
    { method: 'POST', headers: { 'X-Creator-Token': creatorToken } },
    { parse: () => undefined }
  );

// Not built on request() — a multipart upload must let the browser set its
// own Content-Type (with the multipart boundary); request() always forces
// 'Content-Type: application/json'.
export const uploadLiveImage = async (code: string, billId: string, blob: Blob, width: number, height: number): Promise<{ refKey: string }> => {
  const form = new FormData();
  form.append('image', blob, 'receipt.jpg');
  form.append('width', String(width));
  form.append('height', String(height));

  const res = await fetch(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${billId}/images`, { method: 'POST', body: form });
  if (!res.ok) {
    throw new LiveApiError(`Request failed (${res.status})`, res.status);
  }
  return z.object({ refKey: z.string() }).parse(await res.json());
};

export const claimItem = (code: string, billId: string, itemId: string, personId: string, value?: number): Promise<ClaimItemResponse> =>
  request(
    `/api/sessions/${code}/bills/${billId}/items/${itemId}/claims`,
    { method: 'POST', body: JSON.stringify({ personId, value }) },
    ClaimItemResponseSchema
  );

export const settleLiveSession = (code: string, creatorToken: string): Promise<void> =>
  request(`/api/sessions/${code}/settle`, { method: 'POST', headers: { 'X-Creator-Token': creatorToken } }, { parse: () => undefined });

export const getLiveSettlement = (code: string): Promise<LiveSettlement> =>
  request(`/api/sessions/${code}/settlement`, { method: 'GET' }, LiveSettlementSchema);

export { LiveApiError, LIVE_SERVER_URL };
