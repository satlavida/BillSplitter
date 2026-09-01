# UI Design System

## Summary
Cross-cutting reference for the shared UI kit (`src/ui/`) and the
conventions page code is expected to follow when composing it. Unlike the
other docs in this folder, this one isn't about a user-facing feature —
it's about *how page code should be written*: compose existing kit
components with minimal inline Tailwind, rather than hand-rolling markup
per page. Read this before adding a new page or a new one-off styled
element (see root `CLAUDE.md`'s "Check `src/ui/components.tsx` for an
existing generic component before building a new one-off").

## Frontend
- `src/ui/*.tsx` — one file per component (`Button.tsx`, `Input.tsx`,
  `Card.tsx`, ...). `src/ui/components.tsx` is a pure barrel re-export
  (`export * from './Button'`, etc.) — every call site still imports from
  `'../ui/components'` (or `'../../ui/components'`), unchanged; the split
  only makes each component individually discoverable as its own file.
  Add a new component as its own file plus one line in the barrel.
- Current inventory: `Button` (variant: primary/secondary/danger/success,
  size: sm/md/lg), `Input` (label/error/`compact`, with
  `aria-invalid`/`aria-describedby` wired to the error message), `Card`,
  `Disclosure`, `ToggleButton`, `PrintButton`, `SelectAllButton`,
  `PrintWrapper`, `Modal`, `FileUpload`, `Spinner`, `ProgressBar`,
  `Dropdown`, `SearchSelect`, `Checkbox`, `Alert`, `BackLink`,
  `IconButton`, `Heading`, `StepBar`. `Toast`/`ToastContainer`
  (`src/ui/Toast.tsx`) is separate, not part of the barrel.
- Every kit component supports dark mode via `dark:` variants and takes a
  `className`/`containerClassName` escape hatch — extend via that prop,
  don't fork the component for a one-off variant.
- **`Input`**: pass `label`/`error` rather than hand-rolling a
  `<label>`/error `<p>` next to a raw `<input>` — the component wires
  `aria-invalid`/`aria-describedby` to the error message automatically
  (stable id via `useId()` when neither `id` nor `name` is passed). Use
  `compact` for cramped contexts (table/grid cells, inline steppers) where
  the default `mb-4` wrapper margin and `p-2` padding don't fit — see
  `FractionalSplitInput.tsx`. Two known raw-`<input>` holdouts, both
  deliberate: `EditableTitle.tsx` (a dashed-underline inline-edit widget,
  not a boxed form field — using `Input` would change its whole visual
  character) and `PeopleListShared.tsx`'s ref-based uncontrolled name
  field is migrated, but check before assuming *every* input in the app
  goes through `Input` — a few genuinely aren't "a labeled form field."
- **`BackLink`**: the standard "go back/away" text-link style
  (`text-blue-600 dark:text-blue-400 hover:underline`, wraps
  react-router's `Link`). Use for any purely-navigational back/away
  action — don't use a filled `Button` for this, it competes visually
  with a page's actual primary action.
- **`IconButton`**: generic icon-only button chrome (`icon` prop, required
  `aria-label`). Used for the Bill/Session Settings gear triggers.
  `App.tsx`'s sidebar gear icon is structurally different (icon data
  consumed by `Sidebar`, not a standalone button) and intentionally
  doesn't use this component.
- **`Heading`**: `<h2>` with `margin?: 'none' | 'sm' | 'md'`
  (`none`/`mb-1`/`mb-4`) — the shared section-heading style.
- **`StepBar`**: presentational, store-agnostic step-circles-plus-progress-
  line component (`step`/`steps`/`onStepClick`). `StepIndicator.tsx`
  (creator, `billStore`-bound) and `JoinerBillEditorPage.tsx` (joiner,
  URL-driven) both wrap it rather than each keeping their own copy.
- **Real Buttons, not link-styled actions, for anything that isn't
  navigation.** A destructive action gets `variant="danger"`; an action
  that opens a modal/drawer gets `variant="secondary"` (or whatever fits)
  — not underlined text, which visually implies navigation. See
  `SessionHomePage.tsx`'s "Delete"/"Paid by" and `ItemAssignment.tsx`'s
  "Split Type" for the pattern. The three icon-only red remove buttons in
  `PeopleListShared.tsx`/`ItemsInput.tsx`/`JoinerItemListRow.tsx` are a
  separate, already-consistent inline-list-row convention — don't convert
  those to the boxed `Button` style, they're a different shape on purpose.

## Backend
None — this is a frontend-only convention doc.

## Related features
Every page in the [route table](README.md) is a consumer. Particularly
relevant comparison pair: [bill-editing.md](bill-editing.md) (creator's
`BillEditorPage`/`StepIndicator`/`ItemsInput`/`ItemAssignment`/`BillSummary`)
vs. [live-collaboration.md](live-collaboration.md) (joiner's
`JoinPage`/`JoinerBillEditorPage`) — both now share `StepBar`/`BackLink`/
`Heading` rather than independently drifting.

## Notes

### Creator vs. Joiner UI divergence — resolved 2026-09-01
An earlier audit (see `changes/20260901Design.md`) found the creator and
joiner flows implementing the same shapes twice with small unintended
differences — most notably `StepIndicator.tsx`'s progress line missing
from the joiner's independently-hand-rolled step markup, and two
different visual treatments ("go back" as a filled primary `Button` vs.
an underlined text `Link`) for the identical navigational action. Fixed
by extracting `StepBar`/`BackLink`/`IconButton`/`Heading` into `src/ui/`
and migrating every identified call site onto them (see
`changes/20260901Design.md` for the full list). `StepIndicator.tsx` is
now a thin `billStore`-bound wrapper around `StepBar`; the joiner's
`JoinerBillEditorPage.tsx` wraps the same `StepBar` off its URL-derived
step — one implementation, not two.

### Input accessibility and validation-message coverage — resolved 2026-09-01
`Input` didn't wire its `error` prop to any `aria-invalid`/
`aria-describedby` attributes, and ~17 form fields across the app used a
raw `<input>` instead of `Input`, several with hand-rolled validation
messages disconnected from the field they described. Fixed: `Input` now
generates a stable id and links `aria-describedby` to the error message;
all mechanical raw-`<input>` sites were migrated; `UpiNudge.tsx`,
`joiner/AddItemForm.tsx`, and `Payments/AddPaymentModal.tsx`'s existing
error messages were rewired through `Input`'s `error` slot instead of a
disconnected sibling `<p>`. Two explicit scope boundaries from that work:
`SearchSelect` still has no `error` slot (`AddPaymentModal`'s
payer-equals-payee message stays a standalone paragraph — adding one
was judged a separate, bigger change than this pass); `EditPersonModal`'s
previously-silent empty-name no-op now shows "Name is required" via the
newly-wired error slot, the one place new (trivial) validation copy was
added rather than just rewired.
