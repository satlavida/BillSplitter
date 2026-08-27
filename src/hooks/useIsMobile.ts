import { useEffect, useState } from 'react';

// Tailwind's `md` breakpoint (768px) — the one boundary already used
// throughout the app (Sidebar.tsx, App.tsx) to decide mobile-only behavior
// (auto-closing the sidebar, overlay vs. persistent rail). A single
// matchMedia-backed hook instead of each call site re-deriving
// window.innerWidth < 768 on its own, so a future breakpoint change (or the
// upcoming right-side panel, which needs the same check) has one place to
// update.
const QUERY = '(max-width: 767px)';

export const useIsMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState(() => (typeof window === 'undefined' ? false : window.matchMedia(QUERY).matches));

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const handleChange = () => setIsMobile(mql.matches);
    handleChange();
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  return isMobile;
};
