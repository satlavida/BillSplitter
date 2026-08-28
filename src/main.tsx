import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './Components/ErrorBoundary';
import { runMigrationIfNeeded } from './migrations/toSessionStore';

// One-time migration of pre-v3 localStorage data into sessionStore, before
// anything reads from it.
runMigrationIfNeeded();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/*
      Outermost safety net — catches anything App.tsx's own top-level code
      (ThemeProvider, HashRouter setup) might throw, which is outside the
      per-route boundary AppShell renders around its <Outlet>. That inner
      boundary is what actually handles most crashes (and lets the user
      navigate away to recover); this one is last-resort, unrecoverable
      short of a reload.
    */}
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
