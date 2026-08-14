import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { runMigrationIfNeeded } from './migrations/toSessionStore';

// One-time migration of pre-v3 localStorage data into sessionStore, before
// anything reads from it.
runMigrationIfNeeded();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
