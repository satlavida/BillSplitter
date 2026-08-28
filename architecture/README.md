# Architecture / feature docs

Reference docs for BillSplitter, organized by feature. Each doc covers the
frontend files, backend files, what the feature does, and a running Notes
log of decisions/quirks/omissions. This folder is **not** the build output
(`docs/` is the gitignored Vite build target for GitHub Pages — see root
`CLAUDE.md`).

Read the relevant doc before implementing or reasoning about a feature.
Update the doc in the same piece of work whenever the feature's files or
behavior change. New features get a new doc following the template in any
existing file, plus a row in the tables below.

## Features

| Feature | Description | Doc |
|---|---|---|
| Bill Editing | 4-step wizard (People → Items → Assign → Summary) for building a bill | [bill-editing.md](bill-editing.md) |
| Pass and Split | Full-screen "pass the phone" flow for in-person item claiming | [pass-and-split.md](pass-and-split.md) |
| Scan Receipt | Upload/capture a receipt photo, extract items via vision LLM, store the image | [scan-receipt.md](scan-receipt.md) |
| Receipt Enhance | Client-side boundary detection, perspective crop, grayscale/contrast enhancement — wired into Scan Receipt's crop step | [receipt-enhance.md](receipt-enhance.md) |
| Live Collaboration | Multi-device real-time sync: sessions, join/approve, claims, presence, SSE | [live-collaboration.md](live-collaboration.md) |
| Settlement | Who-owes-who calculation and debt simplification | [settlement.md](settlement.md) |
| Currency | Per-session/per-bill currency, exchange rate fetch/cache, conversion | [currency.md](currency.md) |
| Session Management | Creating/listing sessions, session home dashboard, people, JSON import | [session-management.md](session-management.md) |
| Settings | Currency and auto-add-self preferences | [settings.md](settings.md) |
| App Shell / Navigation | Router, sidebar, theming, PWA update prompt | [app-shell-navigation.md](app-shell-navigation.md) |
| Data Migration | One-time localStorage migration from pre-v3 shape | [data-migration.md](data-migration.md) |
| Admin Panel | Server-rendered internal admin UI (backend-only) | [admin-panel.md](admin-panel.md) |
| Background Cleanup | Stale-session purge and presence sweeping | [background-cleanup.md](background-cleanup.md) |
| Infrastructure | Server entrypoint, config, middleware, deployment, shared UI kit | [infrastructure.md](infrastructure.md) |

## Routes → feature doc

| Route | Page component | Feature doc |
|---|---|---|
| `/` | `RootRedirect` (in `App.tsx`) | [session-management.md](session-management.md) |
| `/sessions` | `Pages/SessionsListPage.tsx` | [session-management.md](session-management.md) |
| `/session/:sessionId` | `Pages/SessionHomePage.tsx` | [session-management.md](session-management.md) |
| `/session/:sessionId/bill/:billId/step/:step` | `Pages/BillEditorPage.tsx` | [bill-editing.md](bill-editing.md) |
| `/session/:sessionId/settlement` | `Pages/SessionSettlementPage.tsx` | [settlement.md](settlement.md) |
| `/session/:sessionId/activity` | `Pages/ActivityLogPage.tsx` | [live-collaboration.md](live-collaboration.md) |
| `/join/:code` | `Pages/JoinPage.tsx` | [live-collaboration.md](live-collaboration.md) |
| `/join/:code/bills/:billId/step/:step` | `Pages/JoinerBillEditorPage.tsx` | [live-collaboration.md](live-collaboration.md) |
| `/settings` | `Components/Settings.tsx` | [settings.md](settings.md) |
| `/dev/receipt-scan-test` (dev-only, `import.meta.env.DEV`) | `Pages/DevReceiptScanTestPage.tsx` | [receipt-enhance.md](receipt-enhance.md) |

Backend routes are listed per-feature in each doc's Backend section.
