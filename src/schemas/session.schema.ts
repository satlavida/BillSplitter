import { z } from 'zod';
import { ItemSchema, PersonSchema } from './bill.schema';

export const ReceiptImageRefSchema = z.object({
  refKey: z.string(),
  width: z.number().positive(),
  height: z.number().positive(),
});
export type ReceiptImageRef = z.infer<typeof ReceiptImageRefSchema>;

export const SESSION_STORE_VERSION = '2.0.0';

export const BillSchema = z.object({
  id: z.string(),
  title: z.string().default('Untitled Bill'),
  date: z.string(),
  items: z.array(ItemSchema).default([]),
  taxAmount: z.number().nonnegative().default(0),
  currency: z.string().default('INR'),
  // Set (and its rate fields populated) only when this bill's currency
  // differs from its session's — see the Bill Settings modal / Session
  // Settings panel and architecture/currency.md. exchangeRate is whichever
  // value is currently in effect (fetched from the backend's exchange-rate
  // cache, or a user override — see exchangeRateIsOverride); settlement
  // reads this single field regardless of which it is. Overrides are
  // bill-local and are never written back to the backend's global cache.
  exchangeRate: z.number().positive().nullable().default(null),
  exchangeRateDate: z.string().nullable().default(null),
  exchangeRateIsOverride: z.boolean().default(false),
  paidByPersonId: z.string().nullable().default(null),
  receiptImage: ReceiptImageRefSchema.nullable().default(null),
  splitStateVersion: z.string().default(SESSION_STORE_VERSION),
  // Local-only UI state for async receipt scanning — never synced to the
  // live server (not part of BILL_FIELD_KEYS/LiveBillSchema).
  scanStatus: z.enum(['idle', 'processing', 'error']).default('idle'),
  scanError: z.enum(['offline', 'failed']).nullable().default(null),
});
export type Bill = z.infer<typeof BillSchema>;

export const SessionSchema = z.object({
  id: z.string(),
  title: z.string().default('Untitled Session'),
  createdAt: z.string(),
  updatedAt: z.string(),
  people: z.array(PersonSchema).default([]),
  bills: z.array(BillSchema).default([]),
  currentBillId: z.string().nullable().default(null),
  isLive: z.boolean().default(false),
  // Set once "Go Live" succeeds. liveCreatorToken is required as
  // X-Creator-Token on the server's creator-only endpoints (approve/settle) —
  // it lives in this session's own localStorage, never sent anywhere except
  // back to the live server that issued it.
  liveCode: z.string().nullable().default(null),
  liveCreatorToken: z.string().nullable().default(null),
  // Mirrors LiveSessionSchema's fields of the same name once live — kept
  // here too so the creator's local UI (e.g. GoLiveSection's permission
  // picker) can read/set them before/without a live round-trip.
  permissionMode: z.enum(['edit', 'read_only']).default('edit'),
  creatorPersonId: z.string().nullable().default(null),
  // The session's base currency — settlement, balances, and (by default)
  // joiner-facing views always render in this currency. Bills may use a
  // different currency; see Bill.exchangeRate. Seeded from the global
  // currency preference (src/currencyStore.ts) at session creation time,
  // then independent of it — see architecture/currency.md.
  currency: z.string().default('USD'),
});
export type Session = z.infer<typeof SessionSchema>;

export const SessionStoreStateSchema = z.object({
  version: z.string(),
  sessions: z.array(SessionSchema).default([]),
  currentSessionId: z.string().nullable().default(null),
  migratedFromV1: z.boolean().default(false),
});
export type SessionStoreState = z.infer<typeof SessionStoreStateSchema>;
