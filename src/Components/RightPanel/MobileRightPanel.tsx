import { useEffect } from 'react';
import RightPanel from './RightPanel';

interface MobileRightPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// Mobile-only slide-in variant of RightPanel.tsx's content — mirrors
// Sidebar.tsx's own overlay/outside-click/Escape handling, on the opposite
// edge. Only relevant below the lg: breakpoint; at lg: and up the same
// `isOpen` state instead toggles RightPanel's own fixed column in AppShell.
const MobileRightPanel = ({ isOpen, onClose }: MobileRightPanelProps) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (!isOpen) return;
      const panel = document.getElementById('mobile-right-panel');
      const toggleBtn = document.getElementById('right-panel-toggle-btn');
      if (panel && !panel.contains(e.target as Node) && toggleBtn && !toggleBtn.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen, onClose]);

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" aria-hidden="true" />}
      <div
        id="mobile-right-panel"
        className={`fixed top-0 right-0 h-full w-72 bg-zinc-100 dark:bg-zinc-900 shadow-lg z-30 transition-transform duration-300 ease-in-out lg:hidden overflow-y-auto p-4 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex justify-end mb-2">
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            aria-label="Close activity panel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <RightPanel />
      </div>
    </>
  );
};

export default MobileRightPanel;
