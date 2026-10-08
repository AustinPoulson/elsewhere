# Expedition 001: keepers of borrowed colors

2026-10-08. Local implementation and acceptance: **verified**. Publication is complete only after this expedition's PR merges, its Pages workflow passes, and the live release marker and visible behavior agree. The PR discussion records the final publication receipt and deployed commit; the local copy is retained under `.artifacts/`.

## Relationship

Visitor light feeds lucents. Lucents leave colored sediment. Four amber shelled grazers collect that sediment, carry its mixed color, and return to their own woven nests. A meal's history now supports a second inhabitant. There is no new score or separate decoration system.

Grazers sense nearby sediment and crawl toward it. Cargo caps at 1.2; full or locally exhausted foragers return home. Nest pigment caps at 12 and fades slowly. When a nest is full, excess cargo stays with its grazer rather than disappearing or creating pigment. Nests fill with colored rings, and the shell shows its carried color. The opening world has four grazers and four empty homes, with absolute caps of eight and sixteen.

Observe can inspect either species. The field guide offers a keyboard-accessible **Follow a grazer** control. Its notes show cargo, nest color, and gathering/returning state. A second readout distinguishes loose pigment from color nested.

## Persistence

Schema version 2 includes grazers, their cargo and home IDs, and nest pigment. The existing `elsewhere:tidepool:v1` autosave key is retained. Valid version 1 snapshots migrate by adding four empty-home grazers; original organisms, lights, sediment, consumed energy, time, tick, and random state remain unchanged. IDs allocate from the saved next counter, with unsafe counters rejected. Invalid imports leave the current pool intact.

## Acceptance evidence

- `npm ci --cache .npm-cache --prefer-offline` passed. No dependencies were added or changed.
- `npm run validate` passed: 21 tests in four files, TypeScript, and production build.
- New tests cover seeking/harvesting, returning to the correct nest, hue blending across zero, full-nest cargo retention, nonincreasing pigment mass without production, ten minutes of sustained feeding/coastal movement, v1 migration, deterministic v2 resume, and invalid entity/reference/cap rejection.
- Independent source review covered simulation, persistence, interface, and rendering. It caught and repaired an empty/nonempty nest cache transition when snapshot IDs are reused.
- Desktop 1280×720 and portrait 390×844 browser checks visibly distinguish spiral shells, colored cargo, empty rims, and filled nest weaving. No horizontal overflow at 390 px. Screenshots: `.artifacts/grazers-desktop.jpg` and `.artifacts/grazers-mobile.jpg`.
- A real v1 snapshot generated from the previously published source loaded at 00:40 with 24 original lucents and 178 pigment. Its exported v2 file retained the original entities and random state and added exactly eight IDs for four grazers/four nests. Export/reimport succeeded; an invalid file preserved the pool.
- Playing that migrated pool produced 14.3 nested color by 01:05. Grazer notes showed carried color and its own nest amount. Pause held 01:05 and the pigment readings through portrait inspection. Keyboard light placement succeeded on the rotated portrait camera.
- An evolved v2 export at 01:49 contained 48 nested pigment and 3.465 total carried pigment. Reimport preserved the visible time and nest readings; Follow a grazer showed 0.9 carried color, 12.0 in its home, and Returning home. Snapshot downloads were verified from the actual saved JSON files; the in-app browser's download-event waiter did not report the completed file.
- Reset cancellation preserved the world; confirmed reset returned to 00:00, four grazers, four empty nests, and zero nested pigment. Browser warning/error logs were empty.

## Limits and next observations

These checks use an emulated portrait viewport, not a physical touchscreen. Ecological time advances only while the page is running and visible. Grazers persist rather than reproduce; four homes give the new relationship room to remain legible.

The baseline development tooling audit reports three advisories in Vitest/tinypool/mocker (including two critical severity entries). These test tools are not included in the deployed site; `npm audit --omit=dev` reports zero runtime vulnerabilities. A separately reviewed tooling upgrade remains maintenance work.

Next, consider weather that briefly changes the existing food chain: rain spreads light, or a low tide concentrates sediment. Keep the grazer/nest cycle observable before increasing populations or habitats.
