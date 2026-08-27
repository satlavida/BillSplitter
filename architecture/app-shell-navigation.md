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
- `src/main.tsx` — app entry point; runs the localStorage migration ([data-migration.md](data-migration.md)) before mounting `App` in `StrictMode`.
- `src/Components/Sidebar/Sidebar.tsx`, `SidebarItem.tsx`, `HamburgerButton.tsx`, `index.ts` — sidebar nav, used by `AppShell`.
- `src/hooks/useIsMobile.ts` — `matchMedia`-backed hook for the `md` (768px) breakpoint; single source of truth for the mobile-only behavior `Sidebar.tsx`/`AppShell` need (auto-closing the sidebar on nav/outside-click on mobile), replacing three separate `window.innerWidth < 768` checks.
- `src/ui/Toast.tsx`'s `ToastContainer` is mounted once in `App.tsx` alongside `OnboardingModal`/`ServiceWorkerPrompt` — see [live-collaboration.md](live-collaboration.md) for what feeds it. Distinct from `ServiceWorkerPrompt.tsx`'s own PWA update banner, which predates it and isn't backed by `toastStore.ts`.
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
