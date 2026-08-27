import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'error';

export interface Toast {
  id: string;
  message: string;
  kind: ToastKind;
}

interface ToastStore {
  toasts: Toast[];
  pushToast: (message: string, kind?: ToastKind) => void;
  dismissToast: (id: string) => void;
}

// Non-persisted, app-wide notification queue — mirrors billStore's "thin
// scratch store" pattern. Triggered by SSE-driven live-session events (see
// LiveSessionPanel.tsx) to surface "X joined"/"X claimed Y" without the
// creator needing to watch the Joiners/Activity panels directly.
const useToastStore = create<ToastStore>()((set) => ({
  toasts: [],
  pushToast: (message, kind = 'info') =>
    set((state) => ({
      toasts: [...state.toasts, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, message, kind }],
    })),
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export default useToastStore;
