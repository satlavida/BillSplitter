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
  paidByPersonId: z.string().nullable().default(null),
  receiptImage: ReceiptImageRefSchema.nullable().default(null),
  splitStateVersion: z.string().default(SESSION_STORE_VERSION),
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
});
export type Session = z.infer<typeof SessionSchema>;

export const SessionStoreStateSchema = z.object({
  version: z.string(),
  sessions: z.array(SessionSchema).default([]),
  currentSessionId: z.string().nullable().default(null),
  migratedFromV1: z.boolean().default(false),
});
export type SessionStoreState = z.infer<typeof SessionStoreStateSchema>;
