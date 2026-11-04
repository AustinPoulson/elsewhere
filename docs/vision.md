# Vision: From Authored Species to Emergent Life

Elsewhere is a browser terrarium—a living ecosystem that keeps going while you're away. The goal is to stop hand-authoring species and start authoring physics: light, pigment, water, time, and simple rules for bodies, inheritance, and death. Life sorts itself out; new conditions (a deeper pool, seasons, a mineral seam) create variety, not hand-made creatures. Extinction is allowed. The world keeps its own memory: fossils in the sediment, traces of extinct colonies, and a self-writing field journal.

Eventually: several pools linked by slow currents, and the world keeps living while nobody watches. It should feel like a real terrarium on a windowsill—alive without you, a little mysterious, different every time.

## Roadmap

- [x] **Headless fast-forward harness** — Run the simulation without a renderer for many simulated days and report what happened. Enables testing population dynamics and resource flow without waiting in real time. _Success: `npm run harness -- --days 30 --seed 1` completes in under a minute and prints population curves, births, deaths, extinctions, and resource totals._

- [x] **Heritable traits with small mutations** — Offspring inherit parent traits with small random variations; reproduction costs real parent reserves. A faint ambient daylight cycle lets lucents convert sky light into pigment so some lineages can persist without visitor input. _Success: offspring visibly differ from parents; resource cost is reflected in parent reserve depletion; 30-day harness runs without visitor light keep at least one advanced lineage alive and bounded._

- [x] **A second resource and body-eating consumer** — When a mortal body ends, its paid color becomes a located remain that slowly leaches into ordinary pigment; a small scavenger (marlgrub) can pay for itself from those remains. _Success: dead organisms become food for a consumer; resource accounting remains balanced._

- [x] **Catching up on time spent away** — Simulate elapsed time when the user returns; generate a "while you were gone" journal. _Success: reopening after an hour shows the world has advanced; journal summarizes key events._

- [ ] **Fossils, eras, and linked pools** — Fossils in sediment record extinct populations; multiple pools connected by slow currents allow migration. _Success: fossils visible in old sediment; organisms can move between pools._

## Standing Invariants

These hold across all changes:

1. **Every organism pays for itself** — Bodies, reserves, and reproduction are funded by real resources; no free populations granted to old saves.

2. **No free populations for migrated saves** — Schema migrations preserve existing ecology without gifting new species or resources.

3. **Bounded budgets** — Entity counts, per-tick work, and render costs stay within fixed limits defined in the codebase.

4. **Versioned save migrations** — New schema revisions include migration code and tests for old saves.

5. **Accessibility and portrait support** — Keyboard controls, reduced-motion support, and portrait layouts remain functional.

## Related Documents

- [Architecture](architecture.md) — System overview and simulation boundaries
- [Planning](planning.md) — Weekly direction and ticket workflow
- [Next expeditions](next-expeditions.md) — Proposed future directions and experiments

## Observations from the Harness

_This section records surprising population dynamics, extinctions, or runaway resources observed during harness runs. These are notes for upcoming work, not fixes for this PR._

### 30-day simulation findings (seeds 1 and 42)

**Faint ambient daylight keeps pigment moving:** Lucents now harvest a shared 360-second day/night sine into feeding credit (rate 0.09 energy-equivalent per lucent per second at full day, deposited through the ordinary pigment pipeline). Visitor and spring lights remain the only source of lucent energy. Over 30 complete days both seeds harvested 7425 ambient units. Nested pigment ended near 2.3–2.8 rather than collapsing to ~0.02, and loose pigment stayed under 0.5 — bounded, not a flood.

**Some lineages now persist without a visitor:** Skimmers and cargo mites survived the full 30 days on both seeds (seed 1: 3 skimmers, 4 mites at cap; seed 42: 2 skimmers, 1 siltstitcher, 1 mite). They turnover rather than freeze: seed 1 had 78 skimmer births / 75 deaths and 88 mite births / 84 deaths; seed 1's mites briefly emptied around 135m and then re-founded. All stay under catalog caps.

**Extinction is still allowed, and still seed-shaped:** Glass limpets still die (seed 1: 179m; seed 42: 45m). Seed 1 lost siltstitchers at 62m and a brief rainbell at 17m. Seed 42 kept a siltstitcher to day 30, lost rainbells at ~10m and reedwells at ~16m. Reedwells and rainbells remain boom-bust: they still need rain, currents, and concentrated light, which ambient pigment does not replace.

**Trait drift is small and paid:** Founders stay at drive/bulk 1 so opening worlds do not gift variation. Only cargo-mite births mutate (±0.08, clamped to [0.7, 1.3]), and the child reserve comes out of the parent. After 30 days seed 1's mites averaged drive 1.008 / bulk 0.993; seed 42's survivor sat at drive 0.992 / bulk 1.012 — bulk no longer only drifts down. Lucents and grazers remained at baseline. Drive raises intake and maintenance together. For mites, bulk raises paid reserve capacity (host pigment, not free energy) while cutting seek reach and mobility; lucents still convert more light per bulk.

**Visitor light is still the stronger pulse:** Ambient harvest is faint photosynthesis, not a substitute for dropping light. `npm run harness -- --visitor-light` places one spring light each world day; a 2-day comparison on seed 1 consumed more concentrated light with the flag on than with it off.

**Implications for upcoming work:**

1. Catching up on time away can now resume a world that is still cycling pigment and mite/skimmer lineages, not only a dormant lucent-and-grazer floor
2. Selection has something to bite on while cargo mites reproduce; other species still need their own birth rules before their traits can drift
3. Reedwells and rainbells still go extinct without more specific weather/light conditions — a later physics change, not a population gift
4. A body-eating consumer will have real deaths to feed on (skimmer and mite turnover is already dozens per 30 days)

### Catching up on time away (seeds 1 and 42)

**The same rules run while nobody watches:** Catch-up is `stepWorld` in a loop, capped at eight hours (864,000 steps) and chunked into ~12 ms of main-thread work. A 1h gap took ~1.3s of wall time; 8h took ~8.3–8.7s. Gaps under 30 seconds are ignored. Missing or inverted clocks skip catch-up without gifts. Beyond eight hours the journal says the rest of the time the world slept.

**Returning after an hour already changes the pool:** Both seeds left with 24 lucents and 4 grazers. After 1h, seed 1 held 4 skimmers and 3 cargo mites; seed 42 held 3 skimmers and 2 mites. Nested pigment rose from 0 to ~1.5. Loose pigment on seed 1 went quiet (10.0 → 0). Remains balanced on every run (`created = held + consumed + decayed`).

**Extinction is visible in the journal, including the requested sentence:** After 8h on seed 1 the notes read "The last glass limpet died about two hours ago." Seed 1 also lost siltstitchers (~1h ago) and marlgrubs (~7 minutes ago); skimmers (181 births / 178 deaths) and cargo mites (266 / 265) kept turning over. Seed 42's 8h journal named reedwell, rainbell, siltstitcher, and glass limpet extinctions, while one marlgrub was still alive.

**Old saves do not receive a free hour:** Revision 10 migrates to 11 with `lastSeenAt: null`, so the first load after this change does not invent elapsed time or populations.

### Remains and marlgrubs (seeds 1 and 42)

**Death leaves a located resource, and the ledger balances:** Two thirds of each mortal death returns immediately as sediment; the rest becomes a remain. Over 30 days seed 1 created 20.32 remain pigment (0.93 consumed, 19.14 decayed, 0.25 held). Seed 42 created 19.10 (0.94 consumed, 18.16 decayed, 0 held). Both harness conservation checks report `created = held + consumed + decayed`.

**A scavenger pays for itself from remains, off the normal founding rotation:** Marlgrubs appear through the death-founded event offer when a remnant can fund body 0.1 plus reserve 0.1. They are not a seventh slot in the six-type founding cadence. Seed 1 had 4 births / 4 deaths and went extinct at 146m 42s. Seed 42 had 4 births / 4 deaths and went extinct at 92m 32s. Neither opening worlds nor migrated saves receive a free population. The type cap of 4 held.

**Shoreline recycling is no longer a dust leak:** Remain decay used to emit ~0.0001 grains that the 0.025 sediment filter dropped, so a starved glass limpet's 0.2 body never refunded a coarse grain. Tiny returns now merge into nearby sediment. A starved 0.2 death leaves a 0.133 grain, which is coarse (>= 0.12). Glass limpets lasted 161m / 160m versus 179m / 45m on main — they still die, but not at the mechanical 2m 42s shared by both seeds.

**Nest-funded types last several generations, then yield:** Siltstitchers now found repeatedly (8 / 6 births) and go extinct at ~21m versus 62m / survived on main. Nested pigment ended at 1.32 / 1.89 versus 2.33 / 2.80, because one third of each death is delayed as remains. That is slower nest refill, not a one-lifespan collapse. Skimmers persisted on both seeds (75 / 71 and 74 / 70). Seed 1 kept 2 cargo mites; seed 42 lost them at 179m 16s.

**Implications for upcoming work:**

1. Catching up on time away can resume a world that still cycles remains and scavengers, not only lucents and grazers
2. Nest-funded types still compete with a delay: a third of each corpse is remain rather than immediate sediment, so individual nests sit above the 1.5 founding threshold less often
3. That is a physics change, not a population gift; later work can concentrate remains rather than grant free bodies
