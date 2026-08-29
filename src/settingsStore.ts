import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsStore {
  autoAddSelf: boolean;
  selfName: string;
  setAutoAddSelf: (value: boolean) => void;
  setSelfName: (name: string) => void;
  // Beta opt-in for the legacy independent-entry Quantity Split UI
  // (FractionalSplitInput.tsx, "Detailed view") — off by default for every
  // user, meaning the dynamic dependent-claim UI (DependentQuantitySplitInput.tsx,
  // "Basic view") is the default; see architecture/bill-editing.md.
  useDetailedQuantitySplit: boolean;
  setUseDetailedQuantitySplit: (value: boolean) => void;
  // When on (default), a newly-added item (manual add or receipt scan) with
  // quantity > 1 starts as Quantity Split instead of Equal Split — see
  // lib/defaultSplitType.ts. On by default since most multi-quantity items
  // (e.g. "Cola x3") are more often split by who-took-how-many than equally.
  autoQuantitySplit: boolean;
  setAutoQuantitySplit: (value: boolean) => void;
  // Tracks which one-time onboarding flows the user has already been
  // shown/completed, keyed by an id (e.g. "onboarding_v1"), so new
  // onboarding steps added later can be tracked independently without
  // re-showing ones the user already finished.
  completedOnboarding: Record<string, boolean>;
  completeOnboarding: (id: string) => void;
}

// User preferences that aren't tied to any one session — persisted
// separately from sessionStore since they apply across all sessions
// (e.g. "who am I" for auto-adding yourself to newly created sessions).
const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      autoAddSelf: false,
      selfName: '',
      setAutoAddSelf: (value) => set({ autoAddSelf: value }),
      setSelfName: (name) => set({ selfName: name }),
      useDetailedQuantitySplit: false,
      setUseDetailedQuantitySplit: (value) => set({ useDetailedQuantitySplit: value }),
      autoQuantitySplit: true,
      setAutoQuantitySplit: (value) => set({ autoQuantitySplit: value }),
      completedOnboarding: {},
      completeOnboarding: (id) => set((state) => ({ completedOnboarding: { ...state.completedOnboarding, [id]: true } })),
    }),
    {
      name: 'billSplitterSettings',
    }
  )
);

export default useSettingsStore;
