import { useEffect } from 'react';
import useToastStore, { type Toast, type ToastKind } from '../toastStore';

const AUTO_DISMISS_MS = 5000;

const KIND_STYLES: Record<ToastKind, string> = {
  info: 'bg-zinc-800 dark:bg-zinc-700 text-white',
  success: 'bg-green-600 dark:bg-green-500 text-white',
  error: 'bg-red-600 dark:bg-red-500 text-white',
};

const ToastItem = ({ toast }: { toast: Toast }) => {
  const dismissToast = useToastStore((s) => s.dismissToast);

  useEffect(() => {
    const timer = setTimeout(() => dismissToast(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast.id, dismissToast]);

  return (
    <div className={`flex items-center gap-3 rounded-md shadow-lg px-4 py-3 text-sm transition-colors ${KIND_STYLES[toast.kind]}`} role="status">
      <span className="flex-1">{toast.message}</span>
      <button
        type="button"
        onClick={() => dismissToast(toast.id)}
        className="opacity-80 hover:opacity-100 focus:outline-none"
        aria-label="Dismiss notification"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

// Mounted once near the root (see App.tsx) — a stacked, auto-dismissing
// notification queue backed by toastStore.ts, driven by live-session SSE
// events (LiveSessionPanel.tsx).
export const ToastContainer = () => {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm no-print">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
};
