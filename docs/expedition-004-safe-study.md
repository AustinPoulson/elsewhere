# Expedition 004: visit a passing shower

2026-10-12. Local implementation and browser acceptance verified; publication and live acceptance must be recorded on the PR and Trello card before Completed.

Ticket: https://trello.com/c/2yXZ9Q79. This is the scoped recovery for PR #6's missing positive live nest-return verification.

## Relationship

Pocket this world offers During a shower: one paused study of the existing food chain. Its nests contain color ready to return as six grains. The visitor's own pool rests separately during the visit; Return to your pool restores its exact world and controls without catching up elapsed time.

The bundled v2 world comes from source revision 507de042a85b45eef69c90ed5e010f1ddc905b70, createWorld(20261006), and exactly 1,200 fixed steps. It begins at approximately 40 seconds with 24 lucents, four grazers, four nests and 461 sediment marks; every nest contains at least three pigment. No visitor actions or deliberate resource edits created the fixture. Metadata stays outside the snapshot schema.

## Isolation and limits

WorldSession checkpoints the personal world before entry and holds its identity and controls separately. Periodic, hidden-tab, pagehide and action saves converge on the same preview-suppression boundary. Reload during a study opens the personal checkpoint. Storage failures explain that only memory preservation is available. Reset restarts the paused study, and imports are disabled during previews; revision guards reject asynchronous imports across transitions or concurrent file reads. Export names identify study snapshots. Switching worlds resets the fixed-step clock and frame timestamp.

Schema remains v2 with tested v1 migration; all existing ecological/rendering budgets remain. One bounded static JSON is added, with no dependencies or new simulation rules. The fixed camera remains unchanged. Study identity and return controls remain visible on desktop and portrait; modal panels offer their own return control.

## Local evidence

- npm ci with the locked dependencies passed. npm run validate passed 41 tests in seven files, TypeScript and the production Vite build. Six new tests verify deterministic fixture provenance, exact six-grain pigment conservation, checkpoint/save suppression, reset/reentry, storage denial, stale import rejection and v1/v2 compatibility. Existing bounded ecology, weather, clock and resource tests pass.
- Independent source review found a banner button inheriting full width and top margin; scoped overrides fixed it. Final review found no remaining blocking source issues in saves, imports, world transitions, focus or budgets.
- Desktop 1280x720 and portrait 390x844 keyboard preview starts paused at 00:40. Follow a grazer and Enter on Return color to the water produced six visible grains: loose pigment readout155 to158, nested21.4 to18.4; time remained00:40 and focus returned to the habitat.
- A paused disposable pool returned with an identical full observations readout. Preview reload opened its personal checkpoint at10:09. A running pool held at10:22 resumed at10:22 after the visit, with running controls restored and no catch-up.
- Study import is visibly disabled and explained. Reset cancellation preserved the visit; confirmation returned the study to00:40 and21.4 nested color while leaving the personal world aside. A known validated v2 fixture imported successfully through the application picker in the isolated localhost pool. No personal production world was reset or imported over.
- Portrait has390px viewport and390px document width, a readable persistent study label/return button, keyboard focus and no horizontal overflow. Browser warning/error logs were empty. Portrait is viewport emulation, not a physical touchscreen; reduced-motion behavior was reviewed in source, not verified through an OS preference change.
- The browser download-event adapter timed out while attempting to capture an export. No export file or unrelated save-window contents were inspected. Serializer/export source and session tests cover the snapshot contract; actual download-file capture remains a browser-tool limitation.

## Publication evidence

The PR/card receipt will record reviewed head/base, integration CI, guarded merged SHA, Pages deployment, uncached live release marker and positive safe-study behavior. Prior crowded personal-world refusal remains a separate observation; recovery cannot claim positive live acceptance until the deployed study is played.
