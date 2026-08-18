# Pass and Split

## Summary
A full-screen "pass the phone around the table" flow: each person in turn
swipes through the bill's items to claim what they had, instead of one
person assigning items to everyone from a list.

## Frontend
- `src/Components/PassAndSplit/PassAndSplitButton.tsx` — entry button, launched from `ItemAssignment.tsx` (Step 3 of [bill-editing.md](bill-editing.md)).
- `src/Components/PassAndSplit/index.tsx` — activates/wires `PassAndSplitController` to `billStore`.
- `src/Components/PassAndSplit/PassAndSplitController.tsx` — stage router (person selection → swiping → completion).
- `src/Components/PassAndSplit/PersonSelection.tsx` — pick who's turn it is.
- `src/Components/PassAndSplit/ItemSwipeStack.tsx`, `ItemCard.tsx` — swipeable item claim UI.
- `src/Components/PassAndSplit/ParticipantTracker.tsx` — progress across people.
- `src/Components/PassAndSplit/CompletionScreen.tsx` — end-of-flow summary.
- `src/Components/PassAndSplit/ModalPortal.tsx` — full-screen modal portal wrapper.
- `src/Components/PassAndSplit/stores/passAndSplitStore.ts` — own zustand store; syncs claims back into `billStore.ts`.

## Backend
None — purely local, operates on the scratch `billStore`, same as the rest
of [bill-editing.md](bill-editing.md).

## Related features
- [bill-editing.md](bill-editing.md) — parent feature; shares `billStore`.

## Notes
- `passAndSplitStore.ts` is a second scratch layer on top of `billStore.ts`
  (same "only safe if this bill is currently open" caveat applies — see
  `BillEditorPage.tsx`'s comment referenced in `CLAUDE.md`).
