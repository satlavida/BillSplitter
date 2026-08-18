import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsStore {
  autoAddSelf: boolean;
  selfName: string;
  setAutoAddSelf: (value: boolean) => void;
  setSelfName: (name: string) => void;
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
      completedOnboarding: {},
      completeOnboarding: (id) => set((state) => ({ completedOnboarding: { ...state.completedOnboarding, [id]: true } })),
    }),
    {
      name: 'billSplitterSettings',
    }
  )
);

export default useSettingsStore;
