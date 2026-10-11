# Expedition 003: borrowed color

2026-10-11. Local implementation and acceptance: **verified**. Publication is complete after the PR merges, Pages succeeds, and its live release marker and visible behavior match the merged revision. The PR discussion records that publication receipt; a local copy stays under `.artifacts/`.

## Relationship

A nest can give stored pigment back to the water. Observe a grazer, then choose **Return color to the water**. Up to three color becomes exactly six colored grains around its home. The existing grazers gather those grains and carry them home again. A meal's trace can pass through the visitor's hands without creating another resource.

Every pigment deposit now has a small, strength-dependent colored core within its existing soft bloom. Fresh returned grains are easy to see; gathering gradually diminishes them. The field guide explains the action, and the specimen panel gives feedback when the nest needs more color or the floor has too few free slots. A successful release closes the notes and returns keyboard focus to the pool.

## Limits and persistence

The transfer debits the nest by the exact combined grain strength. It does not evict existing sediment, create light or energy, draw random numbers, or advance simulation time. Near-empty nests (less than 0.18 color), fewer than six free sediment slots, and exhausted safe IDs refuse the request without mutation. Placement stays within the shoreline.

The renderer reuses one masked graphics object, cleared each frame, with at most the existing 600 sediment cores. No effect history, textures, dependencies, entity types, or schema fields were added. Snapshots stay version 2 and use the same autosave key and version 1 migration. Pause holds the ecology while allowing a deliberate color transfer; reduced motion adds no new animation.

## Acceptance evidence

- `npm ci --cache .npm-cache --prefer-offline` passed. Final `npm run validate` passed 35 tests in six files, TypeScript, and production Vite build. `npm audit --omit=dev` reports zero runtime vulnerabilities; existing development-tool advisories remain separate maintenance work.
- Seven new checks cover exact conservation and untouched ecology, minimum pigment and coastal confinement, atomic refusal including safe-ID exhaustion, exactly six free slots and repeated requests, actual grazer regathering/delivery, deterministic v2 continuation, and preserved v1 migration. Existing bounded long-run ecology, weather, camera, and clock checks pass.
- Independent full source review identified a keyboard focus restoration defect. The corrected cleanup honors an explicit habitat return target, then clears it so ordinary panel closing still restores its opener. Review found no remaining blocking defects.
- Desktop and portrait interactions use both an evolved opening world and an explicitly controlled snapshot with one grazer, six stored color, no lights, and no floor pigment. The evolved world visibly released six purple grains at 00:24. The controlled browser export at 18.3 seconds contains six grains of strength 0.5 and the nest's remaining 2.9507928883645507 color (shown as 3.0 after normal prior decay).
- At 390×844, the rotated pool, six grain cores, readout, and specimen action are visible; the panel scrolls within the viewport. At 1280×720, the same action returns color visibly. Both layouts have no horizontal overflow. Evidence: `.artifacts/nest-release/portrait-release.png` and `desktop-final.png`.
- Keyboard Field guide → Follow a grazer → Enter on the release returns focus to the habitat. Space resumes the paused ecology. Playing the controlled world from 00:18 to 01:10 after returning the remaining nest color leaves less than 0.5 loose pigment, 4.7 nested color, and 0.6 carried color, visibly demonstrating regathering and delivery without lights.
- Reset cancellation preserves the pool; confirmation returns to 00:00, four grazers, and empty nests. An empty-nest action gives visible feedback. Reimporting the actual export restores the time, grains, and nest readout; invalid import preserves that pool and explains the failure. Reload restores the autosaved 01:10 world and nested color.
- Actual historical v2 and v1 worlds at 00:40 import successfully. The v2 world restores 154 loose pigment and 21.4 nested color; v1 preserves 178 loose pigment and adds the expected four grazers and empty nests. Browser warning/error logs are empty.

## Limits and next observations

Portrait acceptance uses a browser viewport, not a physical touchscreen. The native desktop browser helper could not activate a save dialog; snapshot verification completed through the in-app browser's download and chooser APIs instead.

Watch how returned grains redirect an existing grazer before adding nest decay rules, a second pool, or another species. The visitor can now participate in a resource cycle without replacing the composed opening view.
