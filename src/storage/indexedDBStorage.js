import { get, set, del } from 'idb-keyval';

/**
 * IndexedDB-backed storage for Zustand's persist middleware.
 * Automatically migrates any existing localStorage entries to IndexedDB
 * on first access.
 */
export const createIndexedDBStorage = () => ({
  getItem: async (name) => {
    const value = await get(name);
    if (value === undefined && typeof window !== 'undefined') {
      const localValue = window.localStorage.getItem(name);
      if (localValue !== null) {
        await set(name, localValue);
        window.localStorage.removeItem(name);
        return localValue;
      }
    }
    return value;
  },
  setItem: (name, value) => set(name, value),
  removeItem: (name) => del(name)
});

export default createIndexedDBStorage;
