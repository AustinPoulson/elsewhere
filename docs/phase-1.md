# Phase 1: The Luminous Tidepool

**Local status:** `verified`

**Publication status:** `verified`

**Updated:** 2026-10-07

The first habitat is complete locally: place light, watch lucents gather and feed, inspect an organism, and preserve a world snapshot. The overhead camera adapts to desktop and portrait screens while ecological coordinates stay fixed.

## Acceptance

- [x] TypeScript, Vite, PixiJS 8, and React app with a lockfile for `npm ci`.
- [x] A composed tidepool with inhabited water, light, trails, and bounded pigment.
- [x] Pointer light placement visibly changes creature paths and sediment.
- [x] Observe shows organism age, energy, and field notes.
- [x] Keyboard placement/tool controls work, including the portrait camera.
- [x] Pause freezes ecological time; reset confirms before returning to the opening state.
- [x] Autosave restores the world after reload.
- [x] Snapshot export/import round-trips state; invalid files show feedback and preserve the active world.
- [x] Seeded fixed-step ecology, long-run limits, snapshots, clock, and camera transforms have passing tests.
- [x] Desktop and portrait layouts and controls were inspected in the browser.
- [x] Production assets load beneath a repository subpath.
- [x] The standalone repository and GitHub Pages publishing workflow are documented.

## Evidence

`npm run validate` passed **13 tests in 3 files**: world 6, clock 4, and camera 3. TypeScript and the production build passed. A subsequent build with `PAGES_BASE_PATH=/elsewhere/` passed and loaded at `http://127.0.0.1:4180/elsewhere/` without browser console errors.

Browser checks covered desktop `1280 × 720` and portrait `390 × 844`. Placed light attracted creatures and changed the pigment readout. Observe displayed a selected lucent; Pause froze the clock. The named reset confirmation returned elapsed time to `00:00`, and reloading restored the saved opening world.

Export produced a valid version 1 JSON snapshot. Opening it through the file chooser restored the saved world. A version 999 snapshot was visibly rejected while the current pool remained intact. Local visual evidence is kept under `.artifacts/` as `desktop.jpg` and `mobile.jpg`.

Hardware touch and a real operating-system reduced-motion setting were **source-reviewed, not physically tested**. The mobile browser check used emulated pointer input. These limits remain recorded for future device testing.

## Publication

The app has its own Git repository at `C:\repos\MAGI\elsewhere` and is published in [AustinPoulson/elsewhere](https://github.com/AustinPoulson/elsewhere). Daily development/deployment at 9 AM Central is active and uses feature branches merged through pull requests.

[PR #1](https://github.com/AustinPoulson/elsewhere/pull/1) passed branch and PR builds and was squash-merged as `54e7025c156c122e365a456c0c5e3461ccfa11d4`. [The main deployment](https://github.com/AustinPoulson/elsewhere/actions/runs/37699406219) passed build and Pages deployment. The live `release.json` matched that exact merged SHA, and [the published artwork](https://austinpoulson.github.io/elsewhere/) rendered correctly.

Live browser checks covered desktop `1280 × 720` and portrait `390 × 844`, light placement, pause, and the field guide. The portrait page had no horizontal overflow and the browser reported no warnings or errors. Screenshots are stored locally as `.artifacts/live-desktop.jpg` and `.artifacts/live-mobile.jpg`. Initial publication used the existing authenticated GitHub browser session; no broader Git Credential Manager authorization was granted.

The prepared workflow belongs at the standalone repository root. Pushes to `main` validate and deploy after passing checks. PRs and other branches validate only. Manual dispatch on `main` can also redeploy.

Production builds include `release.json`. GitHub Actions records the deployed commit in its `commit` field; local builds use `null`. A publication is verified only when the successful workflow revision and live release commit match the intended SHA and the live site passes inspection.

## What follows

Additional species, weather, camera exploration, embodiment, and preserved eras remain proposed expeditions. The pigment grazer in [next-expeditions.md](next-expeditions.md) is the recommended next relationship.
