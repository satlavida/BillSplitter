import {
  CreateLiveSessionResponseSchema,
  LiveSessionSchema,
  LiveJoinerSchema,
  LiveSettlementSchema,
  type CreateLiveSessionResponse,
  type LiveSession,
  type LiveJoiner,
  type LiveSettlement,
} from '../schemas/live.schema';
import type { Person } from '../schemas/bill.schema';

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

export const joinLiveSession = (code: string, name: string, existingPersonId?: string | null): Promise<LiveJoiner> =>
  request(`/api/sessions/${code}/join`, { method: 'POST', body: JSON.stringify({ name, existingPersonId }) }, LiveJoinerSchema);

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

export const settleLiveSession = (code: string, creatorToken: string): Promise<void> =>
  request(`/api/sessions/${code}/settle`, { method: 'POST', headers: { 'X-Creator-Token': creatorToken } }, { parse: () => undefined });

export const getLiveSettlement = (code: string): Promise<LiveSettlement> =>
  request(`/api/sessions/${code}/settlement`, { method: 'GET' }, LiveSettlementSchema);

export { LiveApiError, LIVE_SERVER_URL };
