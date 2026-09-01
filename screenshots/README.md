# Screenshots

Visual capture of every client-facing page (not the server-rendered admin
panel — see `architecture/admin-panel.md`), at desktop/tablet/phone sizes,
for reviewing UI changes and pasting into docs. Separate from `e2e/` — this
directory has no assertions, just navigation + `page.screenshot()`.

## Run it

```
npm run screenshots
```

Boots the same Vite dev server + Go backend as `npm run e2e`
(`playwright.webserver.ts`), seeds a realistic session (two people, a
fully-split bill, a live session with a second person joined), and walks
every route, one project per viewport:

- `desktop` — 1440×900
- `tablet` — 810×1080 (iPad-ish), touch emulation on
- `phone` — 390×844 (iPhone-ish), touch emulation on

All three run on Chromium (the only browser this repo's e2e suite
installs) with different viewport/touch metrics, rather than Playwright's
WebKit-based iPad/iPhone device presets — using those would need a
separate `npx playwright install webkit`.

## Output

```
screenshots/output/<YYYY-MM-DD>/<desktop|tablet|phone>/<page-name>.png
```

Dated by day, not by run — re-running the same day overwrites that day's
shots in place (useful while iterating on a change); a new day starts a
fresh directory, so diffing two dates shows how a page actually changed
over time. `screenshots/output/` is gitignored — pull specific shots into
an `architecture/*.md` doc's Notes section (or wherever) by hand when
they're worth keeping, rather than committing every run.

## Pages captured

Creator: bill editor (items/assign/summary steps), session home (with a
live session active), settlement, settings, activity log, sessions list.
Joiner: join form, joined session view, bill editor (items/claim/summary
steps).

## Adding a new page

Add its route to `screenshots/capture.spec.ts` alongside the existing
`shoot(page, 'name')` calls — reuse the existing seeded session/bill/live
code rather than seeding a second one, unless the new page genuinely needs
different data to look non-empty.
