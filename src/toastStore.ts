import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'error';

export interface Toast {
  id: string;
  message: string;
  kind: ToastKind;
}

// How many past toast messages RightPanel.tsx's ActivityFeedMini (and the
// mobile equivalent) keep around as a short rolling log, separate from the
// auto-dismissing `toasts` queue below — deliberately NOT the full
// persisted history ActivityLogPage.tsx shows.
const RECENT_EVENTS_LIMIT = 8;

interface ToastStore {
  toasts: Toast[];
  recentEvents: Toast[];
  pushToast: (message: string, kind?: ToastKind) => void;
  dismissToast: (id: string) => void;
}

// Non-persisted, app-wide notification queue — mirrors billStore's "thin
// scratch store" pattern. Triggered by SSE-driven live-session events (see
// LiveSessionPanel.tsx) to surface "X joined"/"X claimed Y" without the
// creator needing to watch the Joiners/Activity panels directly.
const useToastStore = create<ToastStore>()((set) => ({
  toasts: [],
  recentEvents: [],
  pushToast: (message, kind = 'info') =>
    set((state) => {
      const toast = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, message, kind };
      return {
        toasts: [...state.toasts, toast],
        recentEvents: [toast, ...state.recentEvents].slice(0, RECENT_EVENTS_LIMIT),
      };
    }),
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export default useToastStore;
