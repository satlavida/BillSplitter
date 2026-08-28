# Currency

## Summary
Multi-currency support: every session has its own base `currency`, and each
bill within it can optionally use a different currency. When a bill's
currency differs from its session's, the bill carries an exchange rate —
either fetched (and cached) from the Go backend for a chosen transaction
date, or manually overridden by the user — used to convert that bill's
amounts into session currency wherever they're aggregated (settlement) or
shown to a joiner who's opted into session-currency view. The backend
maintains a global, read-only-from-the-app cache of fetched rates, viewable
and flushable from the admin panel.

## Frontend
- `src/schemas/session.schema.ts` — `Session.currency` (default `'USD'`,
  seeded once from the global currency preference at creation, then
  independent of it); `Bill.exchangeRate`/`exchangeRateDate`/
  `exchangeRateIsOverride` (all null/false unless the bill's currency
  differs from its session's). `Bill.currency` itself predates this
  feature (see [settings.md](settings.md)'s Notes on the old vestigial
  field it used to be).
- `src/schemas/bill.schema.ts` — `BillState` mirrors the same three
  exchange-rate fields for `billStore`'s scratch editor.
- `src/schemas/live.schema.ts` — `LiveSession.currency`, `LiveBill`'s same
  three exchange-rate fields (wire format for live sessions).
- `src/sessionStore.ts` — `createSession` seeds `currency` from
  `useCurrencyStore.getState().currency`; `setSessionCurrency` (Session
  Settings panel) updates it locally and, if the session is live, pushes it
  via `pushSessionCurrencyLive` → `liveApi.ts`'s `updateLiveSessionCurrency`.
  It also clears `exchangeRate`/`exchangeRateDate`/`exchangeRateIsOverride`
  on every bill that had one set — those fields are only ever meaningful
  relative to the session currency they were fetched/overridden against, so
  leaving them in place after a session currency change would silently
  apply a rate computed for the *old* session currency to the new one (see
  Notes). Affected bills' cleared fields are pushed live the same way any
  other bill-field edit is. `BILL_FIELD_KEYS` includes the three bill-level
  rate fields so they sync live the same way `currency`/`taxAmount`/
  `paidByPersonId` do.
- `src/billStore.ts` — `exchangeRate`/`exchangeRateDate`/
  `exchangeRateIsOverride` state + `setExchangeRateInfo`, written only by
  `BillSettingsModal.tsx`; committed back to `sessionStore` by
  `BillEditorPage.tsx`'s existing commit-back subscription.
- `src/Components/SessionSettingsModal.tsx` — opened via the gear icon
  top-right of `SessionHomePage.tsx`. Currency picker (writes via
  `setSessionCurrency`) and a read-only table (date | bill → rate) listing
  every bill whose currency differs from the session's, entirely
  client-computed from data already on each `Bill` — no fetch.
- `src/Components/BillSettingsModal.tsx` — opened via the gear icon
  top-right of `BillEditorPage.tsx`. Currency picker (writes to
  `billStore.currency`); when it differs from the session's, a transaction
  date picker (`Input type="date"`) triggers `src/lib/exchangeRateApi.ts`'s
  `getExchangeRate`, displays the fetched rate, and pre-fills an editable
  numeric override — `exchangeRateIsOverride` is set only if the user
  changes that value away from what was fetched. If the Go server is
  unreachable, shows an inline message and requires manual entry (same
  posture as Scan Receipt's offline handling).
- `src/lib/exchangeRateApi.ts` — `getExchangeRate(base, quote, date)`, talks
  to `GET /api/exchange-rate`. Kept separate from `liveApi.ts` since it's
  not session-scoped.
- `src/lib/currencyDisplay.ts` — `getCurrencyCodes`/`getCurrencySymbol`/
  `getCurrencyOptions` (extracted from what used to be duplicated in
  `Settings.tsx`/`OnboardingModal.tsx`) and `formatAmountInCurrency(amount,
  code)`, a parameterized formatter used wherever an amount belongs to a
  specific session/bill's own currency rather than the user's global
  preference.
- `src/lib/settlement.ts` — `calculateBalances`/`calculateSettlement` take a
  `sessionCurrency` parameter; each bill's contribution is multiplied by
  `getEffectiveRate(bill, sessionCurrency)` (1 if currencies match, else
  `bill.exchangeRate`, falling back to 1 — never throwing — if unset) before
  being summed. See [settlement.md](settlement.md).
- `src/lib/currencyConvert.ts` — `toSessionCurrency(amount, bill,
  sessionCurrency)`, a thin wrapper around `getEffectiveRate` used by the
  joiner bill view's currency toggle (below).
- `src/Pages/SessionSettlementPage.tsx` — always renders in session
  currency: every amount (balances, transactions, per-bill totals, the
  Detailed view's `BillBreakdown`) is formatted via `formatAmountInCurrency`
  and, for amounts derived from a bill's own currency, converted via
  `getEffectiveRate` first. Never uses the global currency preference.
- `src/Pages/JoinerBillEditorPage.tsx` — a joiner sees a bill in **its own
  currency by default** (the point of per-bill currency), with a "Show in
  session currency" checkbox (only shown when the bill's currency differs
  from the session's) that converts every displayed amount via
  `toSessionCurrency` when checked. Local component state, not persisted.
  `JoinerSettlementSummary.tsx` is unaffected — it's backed by the
  Go-computed settlement endpoint, already in session currency.
- `src/Components/ItemsInput.tsx`, `ItemAssignment.tsx`, `BillSummary.tsx`,
  `PassAndSplit/ItemSwipeStack.tsx` — format amounts using the open bill's
  own `currency` (from `billStore`) via `formatAmountInCurrency`, not the
  global currency preference — see [settings.md](settings.md)'s Notes on
  why this changed.

## Backend
- `server/internal/db/migrations/0009_currency.sql` — `sessions.currency`
  (`TEXT NOT NULL DEFAULT 'USD'`); `bills.exchange_rate` (`REAL`, nullable),
  `bills.exchange_rate_date` (`TEXT`, nullable),
  `bills.exchange_rate_is_override` (`INTEGER NOT NULL DEFAULT 0`).
- `server/internal/db/migrations/0010_exchange_rate_cache.sql` —
  `exchange_rates(date, base_currency, quote_currency, rate, fetched_at)`,
  primary key `(date, base_currency, quote_currency)`. A permanent cache —
  historical rates never change once published, so there's no TTL/expiry.
- `server/internal/exchangerate/exchangerate.go` — `Client.FetchRate(ctx,
  date, base, quote)` calls Frankfurter (`https://api.frankfurter.dev/v1`,
  free, no API key, ECB-sourced, historical data back to 1999):
  `GET {base}/v1/{date}?base=X&symbols=Y` →
  `{"amount":1.0,"base":"USD","date":"...","rates":{"EUR":0.913}}`.
  `base == quote` short-circuits to `1.0` without an HTTP call.
- `server/internal/store/store.go` — `GetExchangeRate`/`UpsertExchangeRate`
  (the cache get/upsert `GET /api/exchange-rate` uses),
  `ListExchangeRatesPaged`/`FlushExchangeRates` (admin viewer),
  `UpdateSessionCurrency`, and `UpdateBill`'s extended signature (accepts
  the three exchange-rate fields alongside its existing params).
- `server/internal/api/exchangerate_handlers.go` — `GET /api/exchange-rate
  ?base=&quote=&date=`: validates params, short-circuits same-currency,
  else cache-lookup-then-fetch-and-cache. No auth — stateless, touches only
  the global cache, never anything session-specific.
- `server/internal/api/admin_exchangerate_handlers.go` — `GET
  /admin/exchange-rates` (paginated/searchable/filterable table — the only
  admin table with real server-side pagination, since this cache can grow
  unbounded) and `POST /admin/exchange-rates/flush` (deletes every cached
  row; never touches a bill's own stored rate). See
  [admin-panel.md](admin-panel.md).
- `server/internal/api/session_handlers.go` — `CreateSession` accepts
  optional `currency` (defaults `"USD"`); `PATCH
  /api/sessions/{code}/currency` (`UpdateSessionCurrency`, creator-only).
  `store.UpdateSessionCurrency` clears every bill's stored exchange-rate
  fields in the same transaction as the currency update, mirroring the
  frontend's `setSessionCurrency` — see Notes.
- `server/internal/api/bill_handlers.go` — `UpdateBill`'s request DTO
  accepts optional `exchangeRate`/`exchangeRateDate`/
  `exchangeRateIsOverride`. `AddBill` is unchanged — a new bill always
  starts at the session's currency with no rate set; currency/rate changes
  happen via a follow-up `UpdateBill`.
- `server/internal/settlement/settlement.go` — `CalculateBalances`/
  `CalculateSettlement` take a `sessionCurrency` parameter and apply the
  same effective-rate conversion as the frontend. See
  [settlement.md](settlement.md)'s two-sided-mirror warning.
- `server/internal/config/config.go` — `ExchangeRateAPIBaseURL`
  (`EXCHANGE_RATE_API_BASE_URL`, optional, empty uses Frankfurter's default
  — a testability hook, not something deployments need to set).
- `server/internal/models/models.go` — `Session.Currency`;
  `Bill.ExchangeRate`/`ExchangeRateDate`/`ExchangeRateIsOverride`;
  `ExchangeRate` (the cache row shape).

## Related features
- [settlement.md](settlement.md) — consumes session/bill currency to
  convert balances; the Go/frontend mirror requirement now covers
  conversion too.
- [session-management.md](session-management.md) — `SessionSettingsModal`
  lives on `SessionHomePage`.
- [bill-editing.md](bill-editing.md) — `BillSettingsModal` lives on
  `BillEditorPage`; bill-editing components format via the bill's own
  currency.
- [live-collaboration.md](live-collaboration.md) — session/bill currency
  fields sync live the same way other fields do; the joiner currency
  toggle.
- [settings.md](settings.md) — the global currency preference's narrowed
  role (new-session seed only).
- [admin-panel.md](admin-panel.md) — the exchange-rate cache viewer/flush.

## Notes
- **Changing a session's currency clears every bill's stored exchange rate.**
  A bill's `exchangeRate`/`exchangeRateDate`/`exchangeRateIsOverride` are
  only ever meaningful relative to the session currency they were
  fetched/overridden against (e.g. a USD bill's rate fetched while the
  session was INR is a USD→INR rate). Before this was fixed, switching the
  session's currency (e.g. INR → SGD) left those fields untouched, so
  `getEffectiveRate` would silently apply the stale USD→INR rate as if it
  were USD→SGD — wrong settlement numbers with no error. Both
  `sessionStore.ts`'s `setSessionCurrency` and
  `store.UpdateSessionCurrency` now clear the three fields on every
  affected bill (frontend: only bills that had a non-null/non-default
  value, to avoid no-op writes/live-pushes; backend: unconditionally, in
  the same transaction as the currency update) — the bill falls back to
  "no rate set" (1:1, with the `console.warn`/settlement fallback already
  in place) until the user reopens Bill Settings and fetches/enters a rate
  against the new session currency. Covered by
  `src/sessionStore.currency.test.ts` (unit) and
  `e2e/session-currency-change.spec.ts` (offline UI + live/server, via the
  real Go backend).
- **The global `currencyStore` preference is not the same thing as a
  session's or bill's currency.** It seeds a new session's `currency` at
  creation and nothing else — it is not read anywhere an amount tied to a
  specific session/bill is displayed. If you're adding a new amount display
  for a session/bill, use `formatAmountInCurrency` with that session's or
  bill's own `currency`, not `useFormatCurrency()`.
- **Bill-level rate overrides never write to the global `exchange_rates`
  cache** — only `GET /api/exchange-rate`'s cache-miss path does. An
  override is a plain column on that bill's own row.
- **A bill's `exchangeRate` is "whichever value is currently in effect"** —
  fetched or overridden, doesn't matter which; `exchangeRateIsOverride` is
  purely a display/audit flag ("using your own rate, not the fetched one"),
  never consulted by settlement math or any conversion helper.
- **A new bill always starts at its session's currency** (no rate fields
  set); currency/rate only enter the picture once the user changes a bill's
  currency away from the session default via `BillSettingsModal`.
- **Joiners default to a bill's own currency**, not session currency — this
  was a deliberate product decision (per-bill currency is the point), with
  an opt-in "Show in session currency" toggle rather than always converting.
  This differs from the settlement page, which is always session-currency
  only.
- Frankfurter's exact response contract was verified live during
  implementation (`GET https://api.frankfurter.dev/v1/2024-01-15?base=USD&symbols=EUR`
  → `{"amount":1.0,"base":"USD","date":"2024-01-15","rates":{"EUR":0.91366}}`);
  if Frankfurter ever changes its response shape, `exchangerate.go`'s
  `frankfurterResponse` struct is the only place that needs updating.
