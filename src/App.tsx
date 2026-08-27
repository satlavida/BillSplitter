import { memo, useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet, useNavigate, useLocation, useParams } from 'react-router-dom';
import { ThemeProvider } from './ThemeContext';
import ThemeSwitcher from './Components/ThemeSwitcher';
import { Sidebar, HamburgerButton } from './Components/Sidebar';
import { RightPanel, MobileRightPanel, RightPanelToggleButton } from './Components/RightPanel';
import { Spinner } from './ui/components';
import useSessionStore from './sessionStore';
import { useIsMobile } from './hooks/useIsMobile';
import Settings from './Components/Settings';
import ServiceWorkerPrompt from './Components/Prompts/ServiceWorkerPrompt';
import OnboardingModal from './Components/Prompts/OnboardingModal';
import { ToastContainer } from './ui/Toast';
import SessionsListPage from './Pages/SessionsListPage';
import SessionHomePage from './Pages/SessionHomePage';
import BillEditorPage from './Pages/BillEditorPage';
import SessionSettlementPage from './Pages/SessionSettlementPage';
import ActivityLogPage from './Pages/ActivityLogPage';
import JoinPage from './Pages/JoinPage';
import JoinerBillEditorPage from './Pages/JoinerBillEditorPage';
import './App.css';

interface HeaderProps {
  toggleSidebar: () => void;
  isSidebarOpen: boolean;
  toggleRightPanel: () => void;
  isRightPanelOpen: boolean;
  showRightPanelToggle: boolean;
}

// Header with theme switcher and hamburger button
const Header = memo(({ toggleSidebar, isSidebarOpen, toggleRightPanel, isRightPanelOpen, showRightPanelToggle }: HeaderProps) => {
  // Count of bills in the current session still being scanned in the
  // background (see receiptScan.ts) — shown as a spinner here so progress
  // is visible even after the upload modal that started the scan has
  // already closed.
  const processingCount = useSessionStore((state) => {
    const current = state.sessions.find((s) => s.id === state.currentSessionId);
    return current ? current.bills.filter((b) => b.scanStatus === 'processing').length : 0;
  });

  return (
    <div className="relative z-40 flex justify-between items-center mb-6">
      <div className="flex items-center gap-3">
        <HamburgerButton onClick={toggleSidebar} isOpen={isSidebarOpen} />
        <h1 className="text-2xl font-bold text-zinc-800 dark:text-white">Bill Splitter</h1>
        {processingCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400" title="Scanning receipt...">
            <Spinner size="sm" />
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <ThemeSwitcher />
        {showRightPanelToggle && <RightPanelToggleButton onClick={toggleRightPanel} isOpen={isRightPanelOpen} />}
      </div>
    </div>
  );
});

// Top-level app shell: sidebar + header, with routed page content in the middle
const AppShell = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const isMobile = useIsMobile();
  const hasLiveSession = useSessionStore((s) => Boolean(s.sessions.find((sess) => sess.id === s.currentSessionId)?.isLive));
  const navigate = useNavigate();
  const location = useLocation();
  const activeItemId = location.pathname.startsWith('/settings') ? 'settings' : location.pathname.startsWith('/sessions') ? 'sessions' : null;

  useEffect(() => {
    const savedSidebarState = localStorage.getItem('sidebarOpen');
    if (savedSidebarState !== null) {
      setIsSidebarOpen(JSON.parse(savedSidebarState));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebarOpen', JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);

  const toggleSidebar = () => {
    // Only one of the two mobile panels open at a time, to avoid squeezing
    // the content column to nothing on a small screen.
    if (isMobile && !isSidebarOpen) setIsRightPanelOpen(false);
    setIsSidebarOpen(!isSidebarOpen);
  };

  const toggleRightPanel = () => {
    if (isMobile && !isRightPanelOpen) setIsSidebarOpen(false);
    setIsRightPanelOpen(!isRightPanelOpen);
  };

  const sidebarItems = [
    {
      id: 'sessions',
      label: 'Sessions',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
      ),
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  const handleSidebarItemClick = (itemId: string | number) => {
    if (itemId === 'sessions') navigate('/sessions');
    else if (itemId === 'settings') navigate('/settings');
    if (isMobile) setIsSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-900 transition-colors duration-200">
      <Sidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} items={sidebarItems} activeItemId={activeItemId} onItemClick={handleSidebarItemClick} />

      <div
        className={`min-h-screen transition-all duration-300 ${isSidebarOpen ? 'md:ml-64' : 'ml-0 md:ml-16'} ${hasLiveSession ? 'lg:mr-72' : ''}`}
      >
        <div className="py-8 px-4">
          <div className="max-w-lg mx-auto bg-white dark:bg-zinc-800 p-6 rounded-xl shadow-lg ring-1 ring-zinc-200/50 dark:ring-zinc-700/50 transition-colors duration-200">
            <Header
              toggleSidebar={toggleSidebar}
              isSidebarOpen={isSidebarOpen}
              toggleRightPanel={toggleRightPanel}
              isRightPanelOpen={isRightPanelOpen}
              showRightPanelToggle={hasLiveSession}
            />
            <Outlet />
          </div>
        </div>
      </div>

      <RightPanel className="hidden lg:block fixed top-0 right-0 h-full w-72 overflow-y-auto p-4 border-l border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 transition-colors" />
      <MobileRightPanel isOpen={isRightPanelOpen} onClose={() => setIsRightPanelOpen(false)} />
    </div>
  );
};

// Redirects "/" to the current (or first, or newly-created) session's home
const RootRedirect = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const state = useSessionStore.getState();
    const current = state.getCurrentSession() || state.sessions[0];
    if (current) {
      navigate(`/session/${current.id}`, { replace: true });
    } else {
      const created = state.createSession();
      navigate(`/session/${created.id}`, { replace: true });
    }
  }, [navigate]);

  return null;
};

// Req 14: "/session/:sessionId/bill/:billId" (no step) redirects to step 1
// — keeps old bare bill links working while the wizard's real source of
// truth is the URL's step segment (see BillEditorPage.tsx).
const BillEditorStepRedirect = () => {
  const { sessionId, billId } = useParams<{ sessionId: string; billId: string }>();
  return <Navigate to={`/session/${sessionId}/bill/${billId}/step/1`} replace />;
};

// Main App component
const App = () => {
  return (
    <ThemeProvider>
      {/*
        HashRouter, not BrowserRouter: this app deploys to static GitHub
        Pages (see vite.config.js's relative `base`) with no server-side
        SPA fallback configured, so a BrowserRouter deep-link (e.g. sharing
        /session/:id/bill/:id) would 404 on a fresh load. Hash-based routes
        work with zero server config and need no basename.
      */}
      <HashRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/sessions" element={<SessionsListPage />} />
            <Route path="/session/:sessionId" element={<SessionHomePage />} />
            <Route path="/session/:sessionId/bill/:billId" element={<BillEditorStepRedirect />} />
            <Route path="/session/:sessionId/bill/:billId/step/:step" element={<BillEditorPage />} />
            <Route path="/session/:sessionId/settlement" element={<SessionSettlementPage />} />
            <Route path="/session/:sessionId/activity" element={<ActivityLogPage />} />
            <Route path="/join/:code" element={<JoinPage />} />
            <Route path="/join/:code/bills/:billId/step/:step" element={<JoinerBillEditorPage />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </HashRouter>
      <OnboardingModal />
      <ServiceWorkerPrompt />
      <ToastContainer />
    </ThemeProvider>
  );
};

export default App;
