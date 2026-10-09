# Architecture

Elsewhere is a browser simulation and an art site. The first habitat uses a fixed overhead camera. Entities already live in world coordinates, so a later camera can pan or zoom without changing their behavior.

## Boundaries

| Layer | Responsibility | Should not own |
| --- | --- | --- |
| World data and simulation | Entity state, seeded randomness, feeding, movement, pigment, limits, fixed time steps | DOM, Pixi objects, React state |
| PixiJS renderer | Translate world state into water, terrain, organisms, trails, light, and pigment; map screen input into world coordinates | Ecological rules, persisted world format |
| React interface | Tools, field guide, transport controls, save/import/export feedback, accessible controls | Per-frame entity animation |
| Persistence | Validate versioned snapshots and store or recover a world | Running the simulation or rendering |
| Vite/build | Produce static browser assets and adapt asset paths for Pages | A backend or hosted simulation |

The renderer owns the animation loop. It advances the simulation with a fixed `1/30` second step and renders from the current world. React receives small summaries for the interface instead of re-rendering every entity each frame. The clock allows at most five simulation steps per frame, clamps accumulated time, and discards hidden-tab catch-up.

The main entry points are `src/world/types.ts`, `src/world/simulation.ts`, `src/world/persistence.ts`, `src/render/TidepoolRenderer.ts`, `src/render/camera.ts`, `src/app/clock.ts`, and `src/App.tsx`.

The world dimensions are `1440 × 1000`. A shared pool boundary keeps organisms, placement hit testing, and the drawn coastline in agreement. Viewport resizing changes the camera fit rather than rewriting organism positions. Narrow portrait screens rotate the habitat 90 degrees; input and keyboard movement use the same inverse camera transform.

## The first relationship

Lucents sense light, move toward it, consume its energy, and leave sediment. Light is temporary. Sediment carries the history of feeding and gives the next species something meaningful to interact with.

Pigment grazers extend this relationship. Four slow shelled creatures seek sediment, collect its strength into bounded cargo, and return to their own fixed nests to deposit color. Shell cargo and woven nest rings show the transfer. Nest pigment fades gently and caps at 12 per nest. Observe and the field guide's Follow a grazer control expose cargo, nest pigment, and returning/gathering state.

Passing rain diffuses existing light. `src/world/weather.ts` derives a three-minute cycle from saved ecological time: calm until second 30, rain until second 68, and six-second eased transitions. The feeding reach expands from 64 to 112 world units; orbit radius expands in the same proportion. Light keeps its existing energy and consumption rules. Rendering uses that shared reach for widened halos, broad golden floor patches, and a single reusable graphics object with 48 ringlet slots. Floor patches share one owned 512×512 radial texture and at most 32 sprites, reused and pruned by light ID. Their outer radius equals the feeding reach, with a smoothly feathered edge; brightness follows rain intensity and remaining energy. The weather readout and field guide explain the relationship. Reduced motion keeps ringlet positions and radii static; pause freezes the entire cycle. Weather uses the existing elapsed field, so snapshots remain version 2 and older version 1 worlds still use the tested grazer migration.

The opening world contains 24 lucents, four light sources, and sparse pigment around those sources. Lucent energy has a small floor, so a dark pool remains inhabited. The pigment readout sums sediment strength. Reset reconstructs the beginning from the active world's seed after confirmation.

One type definition describes the world and its entities. A seeded random state is part of the world. Deterministic simulation means the same starting snapshot, commands applied at the same ticks, and number of simulation steps produce the same ecological state. Pointer timing and the display frame rate are not themselves a replay format.

## Bounded growth

The current explicit budgets are:

| Collection | Maximum |
| --- | ---: |
| Organisms | 42 |
| Active light sources | 32 |
| Sediment marks | 600 |
| Trail points per organism | 14 |
| Pigment grazers | 8 |
| Woven nests | 16 |
| Rain ringlet slots (renderer only) | 48 |
| Light floor patches (renderer only) | 32 |

New behavior must respect a budget. Accumulated visual history must age, compact, or remain capped. A beautiful trail should not become an unbounded list of draw calls after a long visit. Existing simple rules and loops are easier to inspect than a general plugin or entity framework at this stage.

## Snapshots and browser saves

World snapshots use schema version `2`. They include the seed, random state, clock/tick, next entity ID, entities, cumulative light consumption, grazer cargo and home references, and nest pigment. This lets a snapshot resume the world rather than merely reproducing its opening seed. Pause/tool selection and temporary rendering state belong to the interface rather than ecological history.

Imports check the version, numeric ranges, collection limits, entity shapes, and identifiers before replacing the active world. A rejected import leaves the current world intact and shows visible feedback. Local storage failures are visible without preventing play. Future schema changes need either an explicit migration or a clear unsupported-version message.

The current importer accepts a selected JSON file of at most 2 MB and validates a snapshot string of at most 1,000,000 characters. It requires at least one lucent and unique IDs across all collections, with `nextId` larger than every existing ID. The pocket panel explains replacement before the file picker opens. Reset has its own confirmation dialog.

The browser is the runtime and storage owner. Closing the page suspends this ecosystem. There is no server, shared online world, account, or simulation running on GitHub Pages while visitors are away.

The autosave key remains `elsewhere:tidepool:v1` so existing visitors keep their pools. Valid version 1 snapshots migrate to version 2, adding four grazers and empty nests without altering prior entities, ecological time, or random state. Invalid old snapshots are rejected before migration. Version 2 validates all entity IDs and grazer home references. Saves are attempted every five seconds and before the page is hidden or unloaded. Portable exports use the name `elsewhere-tidepool-SEED.json`, where `SEED` is the world's numeric seed. A browser requesting reduced motion starts with ecological time paused.

## A brief for an agent addition

Use this compact format when giving a future agent an expedition:

```text
Idea: A grazer that collects lucent pigment into tiny nests.
Existing relationship: It consumes sediment left by lucents.
Visible behavior: A visitor can see pigment diminish and nests accumulate.
Files/scope: Simulation rule, species data, renderer appearance, field notes.
Limits: At most 8 grazers and 16 nests; no new dependencies needed.
Determinism: Use world random state and fixed simulation steps.
Persistence: Describe any snapshot schema change or migration.
Verification: Feeding rule test, bounded long run, desktop and touch inspection.
Deliverable: Working local experiment plus a short account of what changed.
```

Agents should own a narrow layer or a clear addition. For a larger change, define the data contract first, delegate separate modules, and review the integrated rendered world. The purpose of the architecture is to make experiments understandable and reversible.
