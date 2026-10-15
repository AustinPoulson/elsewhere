# Expedition 005: carry a living light

2026-10-15. Ticket: https://trello.com/c/GVV0hD24

## New capability

Carry light (M) relocates an existing living source. Drag shows a steady golden destination ghost, a source ring and a connecting thread; the actual source waits at its original position until release inside the shore. Keyboard visitors pick up with Enter, move with arrows, set down with Enter and cancel with Escape. Lucents respond to the same light in its new feeding ground. No energy, ID or random draw is created by the action.

## Boundaries and creative decisions

World actions own nearest live source selection (30 world units, distance then stable ID) and atomic coordinate-only movement. CarryController owns transient preview state and binds the gesture to the originating world; previews never enter saves. App owns primary pointer capture/ownership and cancels on blur, visibility/world/tool changes, Escape or pointer cancellation. Expired sources refuse. One existing renderer Graphics carries the bounded source/ghost/thread/check or invalid X; no new particles or history. The portrait dock stacks icon and label to keep three tools readable.

Version2 is unchanged. Light fields, ecological resource accounting, budgets and the historical shower-study source are unchanged. A move can commit while paused without advancing physiology. Existing v1 migration and v2 portable snapshots retain moved positions.

## Validation evidence

- npm ci passed using the lockfile. npm run validate passed49 tests in8 files, TypeScript and production build after the pointer-ownership repair. Eight new tests cover stable selection, resource/world equality except x/y, invalid/expired atomic refusal, pointer/keyboard preview cancellation, stale world identities, v1 migration/v2 roundtrip, and two lucents redirected within10 simulated seconds with real feeding.
- Independent full source review found a multi-touch ownership hazard. Primary-pointer and owning-ID checks repaired it; follow-up independent review passed. Physical multi-touch is source-verified, not tested on a phone.
- Desktop1280x800: actual golden source/ghost/thread preview, Escape cancellation and missed selection at the canceled destination, paused keyboard commit, pointer drag commit and shoreline refusal all observed through the rendered controls. Resumed lucents approached the moved feeding ground. Deterministic two-lucent trajectory/feeding comparison is automated evidence rather than a claimed imported browser fixture.
- Portrait390x844: keyboard preview/commit and pointer drag succeeded; document width390; all three tool labels and pause/reset fit. Study entry00:40 then Return restored identical complete observations. Reset cancellation preserved the pool. Reload displayed the saved pool time/population/pigment/nested readout; no pending carry selection survived.
- Existing session/reset/import/persistence tests passed. Browser snapshot import could not complete: authenticated Brave extension lacks file-URL upload access. No permissions changed and no unrelated file-picker contents read. Download-file capture, actual physical touch and OS reduced-motion testing remain unverified browser/device limitations; serializer/import tests and the steady renderer path are verified in code.

## Side work

npm audit reports existing dev-only Vitest3/tinypool advisories (one moderate and two critical dependency records). They are not included in the deployed Pixi/React static runtime; no dependency or lockfile change is bundled with this feature. Track a separate scoped test-toolchain update with validation, rather than apply a force major upgrade during this feature. Sources:
https://github.com/advisories/GHSA-85c8-ppgw-ccpr
https://github.com/advisories/GHSA-82fw-gwwq-j7x9

## Publication

Final reviewed head/base, CI integration, guarded merged SHA, Pages workflow/deployment, uncached live release marker and live Carry light acceptance will be recorded on the PR and card before Completed. Browser/device limitations above must remain visible.
