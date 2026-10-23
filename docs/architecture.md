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

Passing rain diffuses existing light. `src/world/weather.ts` derives a three-minute cycle from saved ecological time: calm until second 30, rain until second 68, and six-second eased transitions. The feeding reach expands from 64 to 112 world units; orbit radius expands in the same proportion. Light keeps its existing energy and consumption rules. Rendering uses that shared reach for widened halos, broad golden floor patches, and a single reusable graphics object with 48 ringlet slots. Floor patches share one owned 512×512 radial texture and at most 32 sprites, reused and pruned by light ID. Their outer radius equals the feeding reach, with a smoothly feathered edge; brightness follows rain intensity and remaining energy. The weather readout and field guide explain the relationship. Reduced motion keeps ringlet positions and radii static; pause freezes the entire cycle. Natural weather uses elapsed time. A visitor can also invite a thirty-second shower with a sixty-world-second cooldown; effectiveWeather and effectiveLightReach combine natural and called intensity by maximum. A paused call displays first ringlets without advancing feeding reach. The saved weatherCall belongs to world version3/schemaRevision3.

The opening world contains 24 lucents, four light sources, and sparse pigment around those sources. Lucent energy has a small floor, so a dark pool remains inhabited. The pigment readout sums sediment strength. Reset reconstructs the beginning from the active world's seed after confirmation.

One type definition describes the world and its entities. A seeded random state is part of the world. Deterministic simulation means the same starting snapshot, commands applied at the same ticks, and number of simulation steps produce the same ecological state. Pointer timing and the display frame rate are not themselves a replay format.

## Directional water

`world/actions/current.ts` validates bounded 24–240-unit strokes and creates at most three fields. `world/currents.ts` applies decaying radial drift after creature locomotion: up to12 units/second per field, combined clamp16; sediment follows at0.35. Physiological velocity, light, homes and resource amounts are unchanged. Shared geometry confines displacement without creating resources. Each field expires after eight simulated seconds; pause and snapshots hold its age.

`app/stir.ts` owns ephemeral strokes and refuses cross-world commits. Pointer ownership, keyboard arrows/Enter, cancellation, blur and world transitions keep preview state separate from saved ecology. The renderer uses the same lifetime strength, bounded ribbons/arrows and static reduced-motion directions. No velocity grid, particles, history or background simulation is introduced.

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
| Active currents | 3 |
| Current arrows, including gesture preview (renderer only) | 12 |

New behavior must respect a budget. Accumulated visual history must age, compact, or remain capped. A beautiful trail should not become an unbounded list of draw calls after a long visit. Existing simple rules and loops are easier to inspect than a general plugin or entity framework at this stage.

## Snapshots and browser saves

World snapshots use version `3` with `schemaRevision: 5`, `rainbells`, `rainbellAdmissionAt`, `rainbellCandidateAfterId`, `reedwells`, `reedwellAdmissionAt`, `reedwellCandidateAfterId`, `skimmers`, `skimmerAdmissionAt`, `ecologyLedger`, lucent `pigmentCredit`, `currents`, and `weatherCall: { startedAt, nextAllowedAt }`. They include the seed, random state, clock/tick, next entity ID, entities, cumulative light consumption, grazer cargo and home references, and nest pigment. This lets a snapshot resume the world rather than merely reproducing its opening seed. Pause/tool selection and temporary rendering state belong to the interface rather than ecological history.

Imports check the version, numeric ranges, collection limits, entity shapes, and identifiers before replacing the active world. A rejected import leaves the current world intact and shows visible feedback. Local storage failures are visible without preventing play. Future schema changes need either an explicit migration or a clear unsupported-version message.

The current importer accepts a selected JSON file of at most 2 MB and validates a snapshot string of at most 1,000,000 characters. It requires at least one lucent and unique IDs across all collections, with `nextId` larger than every existing ID. The pocket panel explains replacement before the file picker opens. Reset has its own confirmation dialog.

The browser is the runtime and storage owner. Closing the page suspends this ecosystem. There is no server, shared online world, account, or simulation running on GitHub Pages while visitors are away.

The autosave key remains `elsewhere:tidepool:v1` so existing visitors keep their pools. Valid version 1 snapshots migrate to version 2, adding four grazers and empty nests without altering prior entities, ecological time, or random state. Invalid old snapshots are rejected before migration. The next pure migration upgrades version2 to version3/revision1 with an inactive weather call, preserving its existing ecology. Current saves validate all entity IDs, grazer home references and exact called-shower timestamp/cooldown consistency. Missing current fields, malformed data, unsupported future revisions and downgraded hybrid saves are rejected. Revision1-to2 adds an empty currents collection without altering prior state. Current entries store unique IDs, coast-confined anchors, unit direction, start time, duration8 and radius110; invalid entries reject before valid expiration is normalized. The historical shower-study JSON remains unchanged and is normalized through the same importer. Saves are attempted every five seconds and before the page is hidden or unloaded. Portable exports use the name `elsewhere-tidepool-SEED.json`, where `SEED` is the world's numeric seed. A browser requesting reduced motion starts with ecological time paused.

## Prism skimmers and paid feeding

World3/revision3 adds an empty skimmer population, a bounded admission deadline, lucent feeding credit and a small cumulative accounting ledger. Ordered migration preserves earlier weather, currents, IDs, resources, age, time and PRNG; it grants no new animals or food. Present revision3 fields validate strictly, including homes, cached targets and global IDs. Historical shower JSON remains unchanged.

`world/species/skimmer.ts` owns autonomous nest-funded establishment, movement, intake, emission, maintenance and finite exit. A nest pays0.6 pigment into body0.2/reserve0.4, with one arrival per sixty simulated seconds, one living skimmer/home and48-unit spacing. The catalog cap is six, inside a shared24-record new-type ceiling, additional to existing lucent/grazer limits. Future types must extend that shared admission count rather than multiply it. Roots, juveniles, dormant bodies and any retained remains must count when implemented; this slice has no reproduction, dormant stages or retained corpses.

Skimmers gather at most0.03 pigment/sec, dissipate0.002/sec and convert0.9 reserve to1.35 ordinary light with15-second rest. Empty reserve for60continuous seconds or age480 ends the organism. Actual body/reserve returns to one bounded grain or tops up the nearest underfilled grain; unplaced material is explicitly mineralized, never evicted or kept as an invisible body. Existing fading and lucent immortality remain; these are quantified local accounts, not a globally closed ecosystem.

`world/feeding.ts` credits0.02 pigment per actually consumed light, storing at most1/lucent and depositing funded0.06–0.3 grains on the existing cadence. Full floors retain bounded credit and account excess as a sink. This replaces the prior any-positive-intake grain gift and protects the new feedback loop. Pigment, physiological energy and raw light are distinct units.

Nearest-food searches are staggered once per six ticks, at most600 comparisons/skimmer; a reused shared600-entry index resolves saved target IDs between searches. Four reusable display objects/body, six bodies and one three-second cue/body bound rendering, with no new trails or history. Existing Observe includes skimmers; no tool/action was added. The renderer and UI read authoritative state. [Expedition008](expedition-008-prism-skimmers.md) records validation and acceptance.

## Reedwells and external daylight

`world/species/catalog.ts` separates typed definitions from active populations. Skimmers and reedwells each have a six-body limit, rainbells have a four-body limit, and all three share a24-record admission ceiling. The current catalog therefore permits at most16 active new-type bodies, additional to42 lucents and8 grazers. Unknown future catalog entries must join that shared count before implementation. `species/resources.ts` owns their common safe-ID, hue-transfer and finite pigment-return rules.

`world/species/reedwell.ts` attempts one grain-centered pocket every six ticks while rain intensity is at least0.5. A saved scalar source-ID cursor rotates candidates, so an underfunded pocket cannot monopolize admission. One <=600-source candidate pass and one bounded distance/ID funding pass debit exactly0.6 pigment within32 units only after legal coast,64-unit spacing, population, safe-ID and60-second success-rest checks pass. No source queue or refusal PRNG draws exist. Body0.6 is the entire paid root; new populations start empty.

`world/environment/daylight.ts` derives external intensity `max(0, sin(2*pi*((elapsed + seed%360)%360)/360))`. Each root harvests at most0.18 light energy/second into capacity3, then transfers exactly1.5 to an ordinary feeding light with15-second rest. Full light capacity retains stored energy; overflow is unharvested daylight with no banked debt. Night harvest is zero; an already paid store can still release. At age900s, root pigment returns through the same one-grain/nearest-underfilled/mineralization rule as skimmers, unused light energy explicitly dissipates, and the living slot is freed. Fresh wet pigment can fund later reentry. There is no seed, reproduction or dormant stage in this slice.

Revision3-to4 migration adds empty reedwells, an inactive admission deadline, zero candidate cursor and four zero cumulative light-account fields. All earlier paid feeding, weather, currents, populations, identities, time and PRNG remain intact. Older-schema hybrids containing new state reject. Arbitrary-phase saves preserve charge, age, emission/admission clocks and source rotation even after the cursor's grain disappears. Historical shower provenance remains immutable.

`render/ReedwellRenderer.ts` owns four reused display objects/root, five short leaf shapes and one <=3-second release ring/root. The current catalog permits at most16 new-type short cues under the shared16-effect ceiling; there are no trails or particle queues. Existing Observe supplies pointer/keyboard inspection, and reduced motion removes sway/release rings. Pause, persistence and other controls retain their existing roles. [Expedition009](expedition-009-reedwells.md) records ecological evidence and limitations.

## Rainbell polyps and paid currents

`world/species/rainbell.ts` owns the fixed-root feeder. During rain intensity at least0.5, one legal pocket pays exactly0.6 nearby loose pigment, partitioned into body0.2 and reserve0.4. A saved rotating source-ID cursor, 64-unit root spacing, 60-second successful admission rest, four-body type cap and shared24-body ceiling bound entry. Existing populations and resource-poor worlds can have none. At most one staggered600-grain search per body every six ticks caches both food and pump targets; between searches a reused sediment-ID index and live distance/strength checks keep transfers tied to actual grains.

The root takes at most0.02 pigment/second within28 units and spends up to0.001/second on maintenance. During rain, a grain30–60 units away can prompt one ordinary current directed toward the root when the reserve can pay0.04 and at least15 seconds have passed since the last successful pulse. The existing current action decides coast/length/three-field/ID acceptance. Only a successful pulse debits reserve and starts rest; failures spend neither pulse pigment nor random state. Currents can move grains and animals under the existing drift rules, but the polyp does not move. A field already paid for survives its polyp's death until its ordinary eight-second expiry. The pulse debit and maintenance are named pigment sinks; intake is a transfer from actual sediment to reserve.

At age600 seconds or60 continuous seconds with no reserve, the body and actual reserve return through the common one-grain/underfilled-grain/mineralization rule, releasing the living slot. There is no reproduction, larva or dormant stage in this slice; later return requires fresh rain and funded pigment. Revision4-to5 migration adds an empty population, inactive admission deadline, zero cursor and zero cumulative rainbell counters. Earlier paid ecology, IDs, time and PRNG are retained, and hybrid/downgraded snapshots are rejected. `render/RainbellRenderer.ts` owns four reused display objects/body and one <=3-second contraction cue/body, keeping all current new-type cues within16 with no history. Existing Observe and reduced-motion paths apply. [Expedition010](expedition-010-rainbells.md) records test and playable evidence.

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
