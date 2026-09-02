# tmp/

Ad-hoc, manually-run scratch scripts used during debugging — not part of
`npm test` or `npm run e2e`, and not executed in CI. Each script has a
header comment explaining what it was checking and how to run it. Keep
this directory for one-off repro scripts; anything worth keeping as a
regression test belongs in `e2e/` or as a Jest test next to the source
instead.

- `scripts_tmp_live.mjs` / `scripts_tmp_live2.mjs` — manual Playwright
  scripts checking whether `BillSummary.tsx`'s Print button fires
  `window.print()` unexpectedly around a Go Live transition and
  back-navigation (with and without a scanned receipt attached). See
  `architecture/bill-editing.md`'s Print notes for the print-stack context
  that prompted this.
