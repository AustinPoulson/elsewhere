# Vision: From Authored Species to Emergent Life

Elsewhere is a browser terrarium—a living ecosystem that keeps going while you're away. The goal is to stop hand-authoring species and start authoring physics: light, pigment, water, time, and simple rules for bodies, inheritance, and death. Life sorts itself out; new conditions (a deeper pool, seasons, a mineral seam) create variety, not hand-made creatures. Extinction is allowed. The world keeps its own memory: fossils in the sediment, traces of extinct colonies, and a self-writing field journal.

Eventually: several pools linked by slow currents, and the world keeps living while nobody watches. It should feel like a real terrarium on a windowsill—alive without you, a little mysterious, different every time.

## Roadmap

- [x] **Headless fast-forward harness** — Run the simulation without a renderer for many simulated days and report what happened. Enables testing population dynamics and resource flow without waiting in real time. _Success: `npm run harness -- --days 30 --seed 1` completes in under a minute and prints population curves, births, deaths, extinctions, and resource totals._

- [ ] **Heritable traits with small mutations** — Offspring inherit parent traits with small random variations; reproduction costs real parent reserves. _Success: offspring visibly differ from parents; resource cost is reflected in parent reserve depletion._

- [ ] **A second resource and body-eating consumer** — Introduce decomposition or predation of real bodies; a new resource derived from death. _Success: dead organisms become food for a consumer; resource accounting remains balanced._

- [ ] **Catching up on time spent away** — Simulate elapsed time when the user returns; generate a "while you were gone" journal. _Success: reopening after an hour shows the world has advanced; journal summarizes key events._

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

**Resource depletion drives extinction:** Without visitor-added light, the initial four light sources deplete within a few world minutes. Once light is gone, pigment production stops. Advanced species (skimmers, siltstitchers, glass limpets, cargo mites) emerge briefly from the initial nest reserves but go extinct within 20 minutes of world time.

**Base populations are stable:** Lucents (24) and grazers (4) persist indefinitely at their initial counts. Their energy floor (0.12) prevents starvation, and their population is fixed. The ecosystem enters a stable but dormant state.

**Seed-dependent emergence:** Seed 42 saw all six advanced species appear (including reedwells and rainbells), while seed 1 never supported reedwells or rainbells. Daylight harvesting occurred only in seed 42 (42.76 harvested, 42.00 emitted).

**Extinction timeline:** Advanced species went extinct roughly in order of their resource cost:

- Cargo mites: ~5-6 min (high grazer dependency)
- Glass limpets: ~7-11 min (need current-borne food)
- Siltstitchers: ~11 min (need nest surplus)
- Rainbells: ~10 min (need rain and currents)
- Reedwells: ~15 min (need daylight, which isn't simulated continuously)
- Skimmers: ~19-21 min (most resilient of the advanced species)

**Implications for upcoming work:**

1. The "catching up on time away" feature must handle a world that may have depleted and gone dormant
2. Heritable traits need something to select for—currently there's no pressure once resources are exhausted
3. External energy input (daylight, rain) is crucial for sustaining advanced life; the harness could optionally simulate periodic visitor light to test sustained dynamics
