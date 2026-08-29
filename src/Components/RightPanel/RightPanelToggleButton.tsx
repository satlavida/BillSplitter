interface RightPanelToggleButtonProps {
  onClick: () => void;
  isOpen: boolean;
}

// Counterpart to Sidebar/HamburgerButton.tsx — a small sibling rather than
// generalizing HamburgerButton with a `side` prop, since the two aren't
// otherwise identical (different icon, opposite side). Renders at every
// breakpoint: it toggles the mobile slide-in panel below `lg:` and the
// desktop-collapsible RightPanel at `lg:` and up — see Header in App.tsx.
const RightPanelToggleButton = ({ onClick, isOpen }: RightPanelToggleButtonProps) => {
  return (
    <button
      id="right-panel-toggle-btn"
      onClick={onClick}
      className="p-2 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-800 dark:text-zinc-200"
      aria-label={isOpen ? 'Close activity panel' : 'Open activity panel'}
      aria-expanded={isOpen}
    >
      <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 8h10M9 12h10M9 16h10M4.99 8H5m-.02 4h.01m-.01 4h.01"
        />
      </svg>
    </button>
  );
};

export default RightPanelToggleButton;
