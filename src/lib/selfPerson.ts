import type { Person } from '../schemas/bill.schema';
import useSettingsStore from '../settingsStore';

// Resolves "which person is me" for the creator/local side, using the same
// autoAddSelf/selfName heuristic already used by JoinPage.tsx/GoLiveSection.tsx
// for the joiner/live-session equivalents (see their comments) — matches an
// existing session person by name, case-insensitive/trimmed. Returns null if
// auto-add-self is off, no name is set, or no person matches it. Used to
// default a scanned bill's payer to "the person doing the scanning" when
// that identity is knowable — see ScanReceiptButton.tsx's autoOpenScan flow.
export const resolveSelfPersonId = (people: Pick<Person, 'id' | 'name'>[]): string | null => {
  const { autoAddSelf, selfName } = useSettingsStore.getState();
  const trimmed = selfName.trim();
  if (!autoAddSelf || !trimmed) return null;
  const match = people.find((p) => p.name.trim().toLowerCase() === trimmed.toLowerCase());
  return match?.id ?? null;
};
