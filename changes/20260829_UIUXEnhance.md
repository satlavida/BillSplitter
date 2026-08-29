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

## Not started / deferred

Bigger features from the same backlog message, left for a future session:

- **Quantity split UX overhaul**: 0-to-N steppers with +/-/0 buttons
  (replacing the current numeric input format), humanized validation error
  copy (e.g. "All Fractions must have a positive number" → plain language),
  and a new dynamic/dependent-claim beta feature: creator picks who's
  splitting an item, then each person's available claim count shrinks live
  as others claim (inspired by the existing joiner mini-claim UI, but not a
  modal) — gated behind a new user setting "Show Detailed Quantity Split"
  (Settings, unchecked by default for all users).
- **"Things to Take Care of" section** on the session home page: gently
  flags unclaimed items / unclaimed quantity to the creator.
- **Bill Summary redesign**: turn "Split Breakdown" into an openable
  drawer instead of always-rendered text; mini cards per item for the
  split-breakdown data instead of a wall of text; reuse the same mini-card
  treatment for the joiner "Claim what's yours" view.
- **Per-person UPI ID**: creator prompted for their own UPI ID during
  induction (auto-populated); creator can edit any person's UPI ID; each
  joiner can add their own UPI ID when they join a bill. Replaces the
  bill-level UPI section removed in Phase 1 above.
- **12/13 claimed count** surfaced on Bill Summary (mirroring what the
  joiners page already shows).
- **Joiner-side unvisited-bills tracking**: local (client-side) list of
  bills a joiner hasn't visited or has unclaimed items in, surfaced via a
  badge — the joiner-side equivalent of "Things to Take Care of".
- **Session-currency conversion fix**: "Show Session Currency instead of
  INR" toggle should only appear when the conversion rate is known and
  non-1:1, and should perform a real currency conversion, not just switch
  the displayed label.
