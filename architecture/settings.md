# Settings

## Summary
User-level preferences that persist across sessions: a default currency
(used only to seed the currency of a newly-created session — see
[currency.md](currency.md) for the actual per-session/per-bill currency
model) and whether to automatically add the user themself as a person when
creating a new session. Also covers the one-time onboarding modal that
surfaces these same settings on first use.

## Frontend
- `src/Components/Settings.tsx` — routed at `/settings` (lives in `Components/`, not `Pages/`, despite being a full route); currency + auto-add-self UI, searchable currency select.
- `src/Components/Prompts/OnboardingModal.tsx` — mounted once in `App.tsx` (alongside `ServiceWorkerPrompt`), outside the router so it can appear over any route. Shows the same currency + auto-add-self fields as `Settings.tsx` the first time the app is used; closing it (via "Get Started" or the modal's X) marks `onboarding_v1` complete in `settingsStore` and it never shows again.
- `src/currencyStore.ts` — persisted zustand store for the default currency + `useFormatCurrency` hook; locale-based currency auto-detection. As of [currency.md](currency.md), this is read from in exactly one place — `sessionStore.ts`'s `createSession`, to seed the new session's own `currency` field — and no longer drives amount formatting anywhere a session/bill's own currency applies (see currency.md's Notes on why `useFormatCurrency` was removed from bill-editing/settlement components).
- `src/lib/currencyDisplay.ts` — shared currency-code list, symbol lookup, and `formatAmountInCurrency(amount, code)` (parameterized formatting, for a session/bill's own currency — see [currency.md](currency.md)), extracted from what used to be duplicated in this page and `OnboardingModal.tsx`.
- `src/settingsStore.ts` — persisted zustand store for `autoAddSelf`/`selfName`, `useDetailedQuantitySplit` (beta opt-in for `FractionalSplitInput.tsx`'s "Detailed view" — see [bill-editing.md](bill-editing.md), off by default for every user, meaning `DependentQuantitySplitInput.tsx`'s "Basic view" is the default), `autoQuantitySplit` (on by default — a newly-added item, manual or scanned, with quantity > 1 starts as Quantity Split instead of Equal Split; see `src/lib/defaultSplitType.ts`, used by `billStore.addItem`, `receiptScan.ts`, `joinerReceiptScan.ts`, and `AddItemForm.tsx`), plus `completedOnboarding: Record<string, boolean>` and `completeOnboarding(id)` for tracking one-time onboarding flows by id.
- `src/schemas/currency.schema.ts` — `CurrencyState` (currency code, defaults to USD).

## Backend
None — purely local preferences, not synced server-side.

## Related features
- [session-management.md](session-management.md) — `autoAddSelf` affects new-session creation.
- [currency.md](currency.md) — the actual per-session/per-bill currency model this preference only seeds.
- [live-collaboration.md](live-collaboration.md) — `autoAddSelf`/`selfName` preselect the matching person in the creator-identity and joiner-identity selects.
- [app-shell-navigation.md](app-shell-navigation.md) — `OnboardingModal` is mounted at the app-shell level, same as `ServiceWorkerPrompt`.

## Notes
- Onboarding completion is tracked per-id (`completedOnboarding[id]`) rather
  than a single boolean, so that if new settings are added later, a new id
  (e.g. `onboarding_v2`) can be introduced and shown to users who already
  completed `onboarding_v1`, without re-showing questions they already
  answered. The id constant lives in `OnboardingModal.tsx`.
- Client-side only (persisted via the existing `settingsStore` zustand
  `persist` middleware, localStorage) — nothing about onboarding state is
  pushed to the live server.
