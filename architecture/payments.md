# Payments

## Summary
Transaction *logging*, not a payment gateway — no RazorPay/PayPal/etc.
integration. Either party on a settlement edge (whoever owes money, or
whoever is owed it) can log a payment (cash/online, optional transaction
ID) against what one person owes another. The person owed money stays in
control of whether it counts: a payer-added payment starts pending until
the payee verifies it; a payee-added payment auto-verifies immediately.
Only verified payments reduce what settlement still shows as owed. A
creator-only "Require Payment Verification" toggle can turn this off,
auto-verifying every payment regardless of who added it. A local (offline,
non-live) session has only one operator, so every payment there
auto-verifies too — there's no second real party to withhold verification
from. Payments are session-scoped (not tied to one bill), since settlement
already aggregates across a session's whole bill list. Only the payer, the
payee, and the creator can see a given payment; an uninvolved third joiner
never sees it, even though the aggregate settlement balances/transactions
stay visible to everyone as they already were.

## Frontend
- `src/schemas/bill.schema.ts` — `PaymentSchema`/`PaymentMethodSchema`
  (`'cash' | 'online'`): `id, payerId, payeeId, amount, currency,
  exchangeRate, exchangeRateDate, exchangeRateIsOverride, method,
  transactionId, addedByPersonId, verified, verifiedAt, createdAt`. The
  `currency`/`exchangeRate*` triad mirrors `Bill`'s fields of the same name
  exactly (see [currency.md](currency.md)) — set only when a payment's own
  currency differs from the session's.
- `src/schemas/session.schema.ts` — `Session.payments: Payment[]` and
  `Session.requirePaymentVerification: boolean` (default `true`).
- `src/schemas/live.schema.ts` — `LivePaymentSchema`,
  `LiveSession.payments` (already filtered by the server to what this
  viewer may see — see Backend), `LiveSession.requirePaymentVerification`.
- `src/lib/paymentVerification.ts` — `computeInitialVerified(isLive,
  requirePaymentVerification, addedByPersonId, payeeId)`, the single
  predicate deciding whether a newly-logged payment starts verified:
  `!isLive || !requirePaymentVerification || addedByPersonId === payeeId`.
  Mirrored on the Go side (see Backend) — same two-sided-mirror discipline
  `settlement.ts`/`settlement.go` already follow (see
  [settlement.md](settlement.md)).
- `src/sessionStore.ts` — `addPayment`/`verifyPayment`/
  `setRequirePaymentVerification`, following `updatePerson`/
  `setSessionCurrency`'s exact shape (local `set()` + `touchSession`, then a
  fire-and-forget live push via `pushAddPaymentLive`/`pushVerifyPaymentLive`/
  `pushRequirePaymentVerificationLive` if the session is live).
  `mergeLiveSessionInto` upserts `payments` by id (`mergeLivePayment`,
  pending-write-gating `fields` and `verified` independently, same pattern
  as `mergeLiveItem`'s `fields`/`consumedBy` split) and merges
  `requirePaymentVerification` like `currency`. A payment known locally but
  missing from a remote snapshot is **kept**, not dropped like a missing
  bill is — a joiner's snapshot legitimately omits payments they're not
  party to (server-side filtering, not a deletion signal).
- `src/lib/liveApi.ts` — `addLivePayment`/`verifyLivePayment`/
  `updateLiveRequirePaymentVerification`. `getLiveSession(code, viewer?)`
  takes an optional `{personId, joinerToken}` or `{creatorToken}` so the
  server knows which payments to include — see Notes.
- `src/lib/settlement.ts` — `calculateBalances`/`calculateSettlement` take
  an optional `payments` param; after the existing per-bill balance sum,
  each **verified** payment nets `balances[payer] += converted;
  balances[payee] -= converted` (converted via the payment's own
  `currency`/`exchangeRate`, same fallback-to-1 rule as a bill's effective
  rate). `isSessionSettledByPayments(bills, people, sessionCurrency,
  payments)` — every balance within 0.005 of zero, and only true once
  there's at least one bill — drives where `PaymentsSection` renders on
  `SessionHomePage.tsx` (see below). Kept in `settlement.ts` rather than a
  Payments component specifically so it has no dependency on
  `liveApi.ts`'s `import.meta.env` reference (breaks Jest if pulled in
  transitively — see `sessionStore.ts`'s top-of-file comment).
- `src/Components/UpiNudge.tsx` — shared, self-hiding "you're owed money —
  add your UPI ID" prompt (extracted from what used to be joiner-only
  `JoinerUpiNudge.tsx`), parameterized by `owedMoney`/`myPersonUpiId`/an
  `onSave` callback. `src/Components/joiner/JoinerUpiNudge.tsx` is now a
  thin wrapper supplying the joiner-specific settlement check and
  `updateLivePerson` call; `SessionHomePage.tsx` uses `UpiNudge` directly
  for the creator (via local `updatePerson`), which is a new capability —
  previously only joiners got this nudge.
- `src/Components/Payments/`:
  - `PaymentsSection.tsx` — creator-facing, mounted on `SessionHomePage.tsx`.
    Renders every payment (the creator always sees all of them — this
    component is never mounted for a joiner), an outstanding-transactions
    list each with its own "Log Payment" shortcut (pre-filling
    payer/payee/amount), and an "Add Payment" button. Uses
    `sessionStore.ts`'s `addPayment`/`verifyPayment` directly, token-free
    (the creator's own local session, not a joiner acting through a token).
  - `PaymentCard.tsx` — one payment: from/to, amount in its own currency
    plus the session-currency equivalent when they differ, method/
    transaction id, verified/pending badge, a "Mark Received" action shown
    only when `canVerify` is true.
  - `AddPaymentModal.tsx` — payer/payee `SearchSelect`s, amount, currency
    (defaulting to session currency; picking a different one reveals a
    transaction-date picker + fetched/overridable exchange rate, mirroring
    `BillSettingsModal.tsx`'s currency block, defaulting to today), method
    dropdown, and a transaction-id field shown only for Online.
- `src/Components/joiner/JoinerPaymentsSection.tsx` — joiner-facing
  counterpart, mounted on `JoinerSessionView.tsx`. Talks to `liveApi.ts`
  directly (`addLivePayment`/`verifyLivePayment`) rather than
  `sessionStore.ts`, since a joiner has no local session — reuses
  `PaymentCard`/`AddPaymentModal`. Renders only the payments the server
  already included in this joiner's `LiveSession.payments` (no client-side
  filtering needed — see Backend) plus this joiner's own outstanding
  settlement transactions.
- `src/Components/SessionSettingsModal.tsx` — a `Checkbox` "Require Payment
  Verification" next to the currency picker, wired through a new
  `onRequirePaymentVerificationChange` prop (`SessionHomePage.tsx` binds it
  to `setRequirePaymentVerification`), mirroring the currency picker's
  `onCurrencyChange` wiring exactly.
- `src/Pages/SessionHomePage.tsx` — `<PaymentsSection>` renders in its
  default slot between the Bills header and "View Settlement" *unless*
  `isSessionSettledByPayments(...)` is true, in which case it renders above
  `ThingsToTakeCareOf`/the Bills header instead — a presentational reorder
  only, no new "settled" schema field. No new bill-deletion logic was
  added for the "offer to delete a settled bill" ask — the existing
  per-bill Delete button (`handleDeleteBill`) already covers it; being
  settled just makes it more prominent by moving Payments above the list.
- `src/Pages/SessionSettlementPage.tsx` — a "Payments" `Card` between "Who
  pays whom" and "Bills", inside the existing `PrintWrapper`/
  `#printable-settlement` wrapper (no extra print wiring needed — anything
  inside that block already prints).

## Backend
- `server/internal/db/migrations/0014_payments.sql` — `sessions.
  require_payment_verification` (`INTEGER NOT NULL DEFAULT 1`); `payments`
  table (`session_id`/`payer_id`/`payee_id`/`added_by_person_id` all
  `ON DELETE CASCADE` against `sessions`/`people`).
- `server/internal/models/models.go` — `Payment` struct;
  `Session.RequirePaymentVerification`, `Session.Payments`.
- `server/internal/settlement/paymentverify.go` — `ComputeInitialVerified`,
  the Go mirror of `paymentVerification.ts`'s predicate.
- `server/internal/settlement/settlement.go` — `CalculateBalances`/
  `CalculateSettlement` gain a `payments []models.Payment` param, netting
  verified payments the same way the frontend does.
- `server/internal/store/store.go` — `AddPayment` (verified is computed by
  the handler, not the store — same data-only-store convention as
  `AddItem`/`AddBill`), `VerifyPayment`, `GetPayment` (used by
  `VerifyPayment`'s auth check), `ListPayments` (feeds `GetSession` and
  settlement), `UpdateRequirePaymentVerification`.
- `server/internal/api/payment_handlers.go`:
  - `POST /api/sessions/{code}/payments` (`AddPayment`) — dual auth: a
    joiner's own `X-Joiner-Token` must authenticate as `addedByPersonId`,
    which itself must be either `payerId` or `payeeId` (a joiner can't log
    a payment "on behalf of" two unrelated other people); omitting the
    token is the creator's token-free path, which can log on behalf of
    anyone. `verified` is computed server-side via
    `settlement.ComputeInitialVerified`, never trusted from the request.
  - `POST /api/sessions/{code}/payments/{paymentId}/verify` (`VerifyPayment`)
    — same dual-auth shape as `ClaimItem`: an `X-Joiner-Token`, if present,
    must authenticate as the payment's own `payeeId` (the payer's own valid
    token fails this — it proves the wrong personID); omitting the header
    is the creator's trusted token-free path.
  - `PATCH /api/sessions/{code}/settings/require-payment-verification`
    (`UpdateRequirePaymentVerification`) — creator-only, mirrors
    `UpdateSessionCurrency`.
- `server/internal/api/session_handlers.go`'s `GetSession` — filters
  `sess.Payments` by caller identity before serializing
  (`resolveViewerIdentity` + `filterPaymentsForViewer`): the creator (valid
  `X-Creator-Token`) sees everything; a joiner (valid `X-Joiner-Token` +
  `personId` query param) sees only payments they're the payer or payee of;
  anyone else (or an unauthenticated request) sees none. This is a **new
  pattern** for this codebase — every other route here gates *writes*, not
  *reads*; `GetSession` itself still requires no auth at all, same as
  before payments existed, so an absent/invalid identity just narrows one
  field rather than rejecting the request. `computeSettlement` always uses
  the full, unfiltered `sess.Payments` — the aggregate balances/
  transactions it produces are already visible to every participant; only
  individual payment *records* are privacy-restricted.
- `server/internal/api/router.go` — registers the three routes above next
  to the existing bills/items block.
- `server/internal/sse/hub.go` — no code change (`Kind` is a free-form
  string); `payment.created`/`payment.verified` added to the doc-comment
  list of known kinds, broadcast the same way `bill.updated` etc. are. The
  verification-toggle change reuses the existing `session.updated` kind,
  same as `UpdatePerson` does for a settings-shaped change.
- Purge (`store.PurgeStaleSessions`/`PurgeSessionByID`): no new cleanup
  code — `payments.session_id` is `ON DELETE CASCADE`, so a purge's plain
  `DELETE FROM sessions` removes payments automatically, same as
  `bills`/`item_activity`/`joiners` already do. Verified by
  `TestPurgeStaleSessionsCascadesPayments`
  (`server/internal/store/settings_test.go`) rather than added logic.

## Related features
- [settlement.md](settlement.md) — `calculateBalances`/`CalculateBalances`
  now net out verified payments; the two-sided-mirror discipline that page
  documents now covers `paymentVerification.ts`/`paymentverify.go` too.
- [currency.md](currency.md) — a payment's `currency`/`exchangeRate*` triad
  and `exchangeRateApi.ts`/`GET /api/exchange-rate` fetch reused as-is, no
  backend change there.
- [live-collaboration.md](live-collaboration.md) — new SSE kinds
  (`payment.created`/`payment.verified`); `GetSession`'s new
  response-filtering pattern; `getLiveSession`'s optional viewer identity.
- [session-management.md](session-management.md) — `SessionSettingsModal`'s
  new "Require Payment Verification" toggle; the extracted `UpiNudge`.

## Notes
- **A local (non-live) session always auto-verifies every payment**,
  regardless of who added it or the `requirePaymentVerification` setting —
  there's only one operator, so there's no second real party to withhold
  verification from. `computeInitialVerified`'s first check
  (`!isLive`) is what encodes this; the Go side never sees a non-live
  session at all (the server only exists for live sessions), so
  `ComputeInitialVerified` takes the same signature for symmetry with the
  frontend rather than because the server branch is reachable today.
- **Verification predicate is mirrored, not shared** —
  `paymentVerification.ts` (frontend) and `paymentverify.go` (backend) must
  stay in lockstep; same discipline `settlement.md`'s Notes already
  document for the settlement algorithm itself, now extended to cover this
  too. Test fixtures for both live side-by-side in each language's own test
  file.
- **`GetSession`'s response-filtering is new territory for this codebase.**
  Every other privacy/authorization decision here happens at write time
  (`requireCreator`/`requireJoiner`/`requireEditPermission` gating a
  mutation); this is the first case of narrowing a *read* response by
  caller identity. If a future feature needs similar per-viewer
  restriction, `resolveViewerIdentity`/`filterPaymentsForViewer` in
  `session_handlers.go` is the precedent to follow, not a one-off.
- **Settlement's aggregate numbers stay visible to everyone; individual
  payment records don't.** A joiner already sees the whole session's net
  balances/transactions via `GET /api/sessions/{code}/settlement` (no
  auth), unchanged by this feature. What's restricted is specifically the
  `payments` list on `GetSession` — who paid whom, by what method, with
  what transaction id.
- **`getLiveSession`'s viewer identity is opt-in per call site.** Most
  existing callers (e.g. `sessionStore.ts`'s `syncExistingBillsLive`) still
  call it with no identity, which is fine — they don't touch `payments` at
  all. Only `LiveSessionPanel.tsx` (passes `creatorToken`) and
  `JoinerSessionView.tsx` (passes `personId`+`joinerToken`) were updated,
  since those are the two places a fetched `LiveSession.payments` actually
  gets rendered or merged.
- **No new bill-deletion logic.** "Show an option to delete a bill once
  everything's settled" is satisfied by relocating the existing
  Payments section above the bill list (via `isSessionSettledByPayments`)
  rather than by adding a new delete affordance — `SessionHomePage.tsx`'s
  per-bill Delete button already exists and needed no changes.
- **This is logging only.** No payment gateway integration (RazorPay,
  PayPal, etc.) exists or is planned here — a "payment" is a user-entered
  record that a transfer happened elsewhere, nothing more.
