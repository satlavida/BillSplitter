# App Shell / Navigation

## Summary
The router, page chrome, and cross-cutting UI shell: sidebar navigation,
dark/light theming, and the PWA update/offline-ready prompt.

## Frontend
- `src/App.tsx` — `HashRouter` setup (see in-file comment for why hash
  routing is used — static GitHub Pages hosting, no SPA fallback), `AppShell`
  (sidebar + header layout), `Header` (shows a scan-in-progress spinner, see
  [scan-receipt.md](scan-receipt.md)), `RootRedirect`, `BillEditorStepRedirect`,
  all route definitions.
- `src/main.tsx` — app entry point; runs the localStorage migration ([data-migration.md](data-migration.md)) before mounting `App` in `StrictMode`, wrapped in `ErrorBoundary` as a last-resort catch-all.
- `src/Components/ErrorBoundary.tsx` — class-component error boundary (React error boundaries can't be hooks). Two instances: `main.tsx` wraps the whole `<App>` (catches anything outside routing, e.g. `ThemeProvider` itself throwing — unrecoverable short of a reload); `AppShell` wraps `<Outlet>` and is keyed by `location.pathname`, so navigating to a different route remounts and clears it — a crash on one page doesn't take down the sidebar/header or require a full reload, just navigating away. Fallback UI is a `Card`/`Alert` with the error message and a Reload button. Doesn't catch event-handler or async errors (React limitation) — those still need their own try/catch.
- `src/Components/Sidebar/Sidebar.tsx`, `SidebarItem.tsx`, `HamburgerButton.tsx`, `index.ts` — sidebar nav, used by `AppShell`.
- `src/hooks/useIsMobile.ts` — `matchMedia`-backed hook for the `md` (768px) breakpoint; single source of truth for the mobile-only behavior `Sidebar.tsx`/`AppShell` need (auto-closing the sidebar on nav/outside-click on mobile), replacing three separate `window.innerWidth < 768` checks.
- `src/ui/Toast.tsx`'s `ToastContainer` is mounted once in `App.tsx` alongside `OnboardingModal`/`ServiceWorkerPrompt` — see [live-collaboration.md](live-collaboration.md) for what feeds it. Distinct from `ServiceWorkerPrompt.tsx`'s own PWA update banner, which predates it and isn't backed by `toastStore.ts`.
- `src/Components/RightPanel/` — right-side people/activity panel, mounted in `AppShell` alongside `Sidebar`. Renders nothing unless the current session (`sessionStore`'s `currentSessionId`) is live — there's no meaningful "live people"/"activity" to show otherwise.
  - `RightPanel.tsx` — the content: a read-only people list (name + `PresenceDot`, reusing `PeopleSection.tsx`'s exported `usePeoplePresence` hook) plus `ActivityFeedMini.tsx` (a short rolling echo of `toastStore.ts`'s `recentEvents`, capped at 8, populated by the same `LiveSessionPanel.tsx` triggers as the toasts — deliberately not `ActivityLogPage.tsx`'s persisted history). Deliberately read-only rather than reusing `PeopleSection.tsx` itself, since that owns the add/edit/remove controls already shown inline on `SessionHomePage.tsx` — duplicating those would double up on interactive elements.
  - **Desktop/tablet** (`lg:` breakpoint, 1024px+): `RightPanel` is rendered directly in `AppShell` as an always-visible fixed column (`hidden lg:block`); `AppShell` only reserves layout space (`lg:mr-72`) when a live session is current, so it doesn't leave a permanent gap otherwise.
  - **Mobile** (below `lg:`): `MobileRightPanel.tsx` wraps the same `RightPanel` content in a slide-in drawer (mirrors `Sidebar.tsx`'s overlay/outside-click/Escape handling, on the opposite edge), toggled by `RightPanelToggleButton.tsx` in the header (only rendered once the session is live) — a small sibling to `HamburgerButton.tsx` rather than a generalized shared component, since the two aren't otherwise identical. `AppShell` keeps the two mobile panels mutually exclusive (opening one closes the other) so neither squeezes the content column to nothing; the header itself needed `relative z-40` so its toggle buttons stay clickable above either panel's full-screen overlay (`z-20`) — without it, the *other* panel's toggle button was covered and unclickable while one panel was open.
  - The people list, activity feed, and `ActivityLogPage.tsx`'s own list all carry `data-testid`s (`people-list`, `right-panel-people-list`, `right-panel-activity-feed`, `activity-log-list`) specifically so e2e specs can disambiguate now that the same names/messages can legitimately appear in more than one place on screen.
- `src/Components/ThemeSwitcher.tsx` — dark/light toggle.
- `src/ThemeContext.tsx` — theme context/provider (`THEMES`, `useTheme`).
- `src/Components/Prompts/ServiceWorkerPrompt.tsx` — PWA update/offline-ready toast.
- `src/Components/Prompts/OnboardingModal.tsx` — one-time first-use onboarding modal (currency + auto-add-self); see [settings.md](settings.md).
- `src/version.ts` — auto-generated `APP_VERSION`/`BUILD_CODE` (do not hand-edit).

## Backend
None.

## Related features
All pages route through this shell; see [README.md](README.md)'s route table.

## Notes
None yet.
