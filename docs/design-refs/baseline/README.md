# Baseline before the v3 "Holo HUD" upgrade (Phase 0)

Captured 2026-10-27 on `feat/console-ui-v3` at `daf0ba9`, from `npm --prefix app run preview` (port 4173),
headless Chrome, after the demo mission finished seeding. Files are `<route>-<width>x<height>.png`, viewport only.

Page size at capture (scrollWidth × scrollHeight), to compare against the one-screen goal:

| Route | 1440×900 | 390×844 |
|---|---|---|
| board | 1440 × 1363 | 390 × 3827 |
| alerts | 1440 × 900 | 390 × 844 |
| trends | 1440 × 2891 | 390 × 5256 |
| checkin | 1440 × 900 | 390 × 872 |
| simulator | 1440 × 1608 | 390 × 3181 |
| sync | 1440 × 6468 | 390 × 10303 |
| ground | 1440 × 1570 | 390 × 3104 |

No console errors on any route.

## Checks

- `npm --prefix app run lint`: clean (oxlint, 0 warnings).
- `npm --prefix app run build`: OK. CSS bundle 45.03 kB (10.52 kB gzip); main JS 326.28 kB; Trends chart chunk 369.94 kB; 24 precache entries.
- `npm --prefix app test`: 188 / 190 in a full run on this machine. The two failures are
  `AlertsPage.test.tsx` and `SimulatorPage.test.tsx`; both wait on the 20k-reading demo seed and miss their
  5 s inner `waitFor` when all files run in parallel. Both pass when run on their own (checked 3 times).
  One run also hit a Vitest worker start timeout on `SyncPage.test.tsx`. These are load-related, not code failures.
