import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsStore {
  autoAddSelf: boolean;
  selfName: string;
  setAutoAddSelf: (value: boolean) => void;
  setSelfName: (name: string) => void;
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
    }),
    {
      name: 'billSplitterSettings',
    }
  )
);

export default useSettingsStore;
