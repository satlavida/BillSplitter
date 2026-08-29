# UI/UX Enhancement Backlog — Progress Log (2026-08-29)

Tracks execution of `/Users/satyajeetnigade/.claude/plans/ui-needs-minor-cleanups-toasty-biscuit.md`.

The user filed a large UI/UX backlog after using v3 for a while. Per their
own instruction ("let's start with all the easy ones... continue with the
bigger features in a different context/session"), Phase 1 below covers the
easy, mechanical fixes tackled in this session. Everything else is logged
under "Not started / deferred" for a future session to pick up directly
from this file.

## Phase 1 — Easy UI/UX fixes ✅ done 2026-08-29

- [x] Right panel (`RightPanel`/`MobileRightPanel`) now collapsible on
      desktop too, default collapsed, state persisted to localStorage
      (`rightPanelOpen` key, same pattern as `sidebarOpen`) —
      `src/App.tsx`, `src/Components/RightPanel/RightPanelToggleButton.tsx`,
      `src/Components/RightPanel/MobileRightPanel.tsx` (comment only)
- [x] Fixed Header/Sidebar/RightPanel z-index overlap: Header no longer has
      its own stacking context (`relative z-40` removed), so its title
      renders behind an open Sidebar/RightPanel; the hamburger and
      right-panel-toggle buttons individually get `relative z-30` wrappers
      so they stay above the panels' dimming overlay (`z-20`) and remain
      clickable while a panel is open — `src/App.tsx`
- [x] Scan Receipt: removed the Google-privacy warning `Alert`; crop-step
      modal now scrolls (`max-h-[85vh] overflow-y-auto`) instead of
      overflowing the viewport for tall receipt images —
      `src/Components/ScanReceiptButton.tsx`
- [x] Fixed toast duplication bug: joiners list was re-toasting every
      already-approved joiner on each `LiveSessionPanel` remount (its
      `joinersRef` reset to `[]` on mount, so the next fetch treated
      existing joiners as new). Now skips toasting on the first fetch after
      mount, same pattern already used for the activity-log toast —
      `src/Components/LiveSessionPanel.tsx`
- [x] Removed the bill-level "Add/Edit UPI ID" section from `BillSummary`
      (UI removal only; per-person UPI ID is a deferred future feature, see
      below) — `src/Components/BillSummary.tsx`
- [x] "Back to Session" on `BillEditorPage` is now a `Button` component
      instead of a plain `Link` — `src/Pages/BillEditorPage.tsx` (updated
      `e2e/creator-live-view.spec.ts` and
      `e2e/session-currency-change.spec.ts`, which located it by link role)
- [x] Fixed compressed title-bar row: `EditableTitle`'s wrapper now takes
      `flex-1 min-w-0` and truncates instead of fighting the settings gear
      for space — `src/Components/EditableTitle.tsx`; `BillEditorPage`'s
      back-button/gear row got a `gap-2` for consistent spacing
- [x] Replaced the per-item "Configure Split" gear icon with a text label
      "Split Type" (no icon library in the repo; zero-dependency and more
      discoverable) — `src/Components/ItemAssignment.tsx` (updated
      `e2e/quantity-split-defaults.spec.ts`, which located it via
      `getByLabel('Configure Split')`)
- [x] Verified: `listJoiners` (joiners endpoint) is already gated behind
      `session.isLive` (`SessionHomePage.tsx` only renders
      `LiveSessionPanel` when live) plus `creatorToken`/`code` checks inside
      the panel — not hit for non-live sessions. No code change needed.
- [x] `tsc --noEmit` clean, `npm test` (222 tests) green, full
      `npx playwright test` run: same 6 pre-existing failures as the
      pre-change baseline (`bill-editor-flow`, `creator-claims-own-identity`,
      `join`, `joiner-cannot-claim-creator-identity`,
      `joiner-cannot-reclaim-active-identity`, `sessions-list` — confirmed
      by stashing this session's changes and re-running the same specs
      against `HEAD`, unrelated to this work), everything else passing
      (61 passed, up from 60 — `mobile-right-panel.spec.ts` needed the
      toggle-button z-index fix above to keep passing after the header
      z-index change)

## Phase 2 — Big items, in progress

Tracks execution of
`/Users/satyajeetnigade/.claude/plans/check-changes-20260826-md-file-serialized-llama.md`,
in the order G → A → C → D → B → E → F.

- [x] **Phase G — Session-currency toggle gating fix** (2026-08-29): the
      joiner's "Show in session currency" toggle
      (`src/Pages/JoinerBillEditorPage.tsx`) was already doing a **real**
      conversion via `toSessionCurrency`/`getEffectiveRate`, not a
      label-swap — the actual bug was showing the toggle whenever
      currencies merely differed, even with no exchange rate set, silently
      falling back to a 1:1 rate. Now gated on
      `currencyMismatch && bill.exchangeRate != null`; when a rate isn't
      set yet, a note points the joiner to Bill Settings instead of the
      toggle just vanishing. Added an e2e case to
      `e2e/session-currency-change.spec.ts` covering the gated
      hide/show/convert behavior. No other `currencyMismatch`-style toggle
      exists elsewhere in the app (confirmed via repo-wide grep).
- [x] **Phase A — Quantity-split stepper UX + humanized errors** (2026-08-29):
      `FractionalSplitInput.tsx`'s per-person numeric input is now a
      `-`/value/`+`/`0` stepper row; a person can be zeroed out (only the
      total across everyone must be `> 0`, not every individual value).
      "All fractions must be positive numbers" → "Give at least one person
      a share greater than 0"; `PercentageSplitInput.tsx`'s "Percentages
      must add up to 100%" → "Adjust the shares so they add up to 100%"
      (behavior unchanged there). Added `FractionalSplitInput.test.tsx`
      (first component-level Jest test in the repo, using
      `@testing-library/react`, already a devDependency) covering the
      stepper buttons, 0-allowed-per-person, and the total-must-be->0 rule.
      `e2e/quantity-split-defaults.spec.ts` still passes unchanged.

## Not started / deferred

Bigger features from the same backlog message, left for later phases of
Phase 2 (see the plan file above for the full phased design):

- **Phase C** — Joiner-side "N minus already-claimed" quantity capping,
  frontend (`ClaimQuantityModal`/`JoinerItemRow`) and backend (`ClaimItem`
  handler currently has no cross-person cap check at all).
- **Phase D** — "Things to Take Care of": creator-side consolidated section
  (alongside the existing per-bill "Unclaimed items" pill) and a joiner-side
  local unvisited/unclaimed tracker.
- **Phase B** — "Show Detailed Quantity Split" beta setting: a dynamic
  dependent-claim UI where each selected person's available count shrinks
  live as others claim, gated behind a new settingsStore boolean (default
  unchecked).
- **Phase E** — Bill Summary redesign: "Split Breakdown" becomes a
  collapsible drawer with mini item-cards instead of a text list; "X/Y
  claimed" count added; shared card chrome reused on the joiner "Claim
  what's yours" view.
- **Phase F** — Per-person UPI ID, full scope: schema, `EditPersonModal`
  and `GoLiveSection` editing, a brand-new backend endpoint + migration
  (people currently have no live-update route at all) for live sync, and a
  joiner-side nudge (in Phase D's "Things to Take Care of" list) to add
  their UPI ID when they're owed money in settlement and haven't set one
  yet.
