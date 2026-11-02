# Vision: From Authored Species to Emergent Life

Elsewhere is a browser terrarium—a living ecosystem that keeps going while you're away. The goal is to stop hand-authoring species and start authoring physics: light, pigment, water, time, and simple rules for bodies, inheritance, and death. Life sorts itself out; new conditions (a deeper pool, seasons, a mineral seam) create variety, not hand-made creatures. Extinction is allowed. The world keeps its own memory: fossils in the sediment, traces of extinct colonies, and a self-writing field journal.

Eventually: several pools linked by slow currents, and the world keeps living while nobody watches. It should feel like a real terrarium on a windowsill—alive without you, a little mysterious, different every time.

## Roadmap

- [x] **Headless fast-forward harness** — Run the simulation without a renderer for many simulated days and report what happened. Enables testing population dynamics and resource flow without waiting in real time. _Success: `npm run harness -- --days 30 --seed 1` completes in under a minute and prints population curves, births, deaths, extinctions, and resource totals._

- [x] **Heritable traits with small mutations** — Offspring inherit parent traits with small random variations; reproduction costs real parent reserves. A faint ambient daylight cycle lets lucents convert sky light into pigment so some lineages can persist without visitor input. _Success: offspring visibly differ from parents; resource cost is reflected in parent reserve depletion; 30-day harness runs without visitor light keep at least one advanced lineage alive and bounded._

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

**Faint ambient daylight keeps pigment moving:** Lucents now harvest a shared 360-second day/night sine into feeding credit (rate 0.09 energy-equivalent per lucent per second at full day, deposited through the ordinary pigment pipeline). Visitor and spring lights remain the only source of lucent energy. Over 30 complete days both seeds harvested 7425 ambient units. Nested pigment ended near 1.9 rather than collapsing to ~0.02, and loose pigment stayed under 0.5 — bounded, not a flood.

**Some lineages now persist without a visitor:** Skimmers and cargo mites survived the full 30 days on both seeds (seed 1: 3 skimmers, 3 mites; seed 42: 4 skimmers, 1 mite). They turnover rather than freeze: seed 1 had 80 skimmer births / 77 deaths and 76 mite births / 73 deaths, all under catalog caps.

**Extinction is still allowed, and still seed-shaped:** Siltstitchers and glass limpets last much longer than the old ~10-minute crash (seed 1: siltstitchers 102m, limpets 178m; seed 42: siltstitchers 53m, limpets 165m) but still go extinct. Reedwells and rainbells remain boom-bust: seed 1 never founded them; seed 42 lost rainbells at ~10m and reedwells at ~16m, almost unchanged from the dormant-world run. They still need rain, currents, and concentrated light, which ambient pigment does not replace.

**Trait drift is small and paid:** Founders stay at drive/bulk 1 so opening worlds do not gift variation. Only cargo-mite births mutate (±0.08, clamped to [0.7, 1.3]), and the child reserve comes out of the parent. After 30 days seed 1's mites averaged drive 1.003 / bulk 0.992; seed 42's survivor sat at drive 1.042 / bulk 0.991. Lucents and grazers remained at baseline. Drive raises intake and maintenance together; bulk raises light-to-pigment yield and size while cutting mobility.

**Visitor light is still the stronger pulse:** Ambient harvest is faint photosynthesis, not a substitute for dropping light. `npm run harness -- --visitor-light` places one spring light each world day; a 2-day comparison on seed 1 consumed more concentrated light with the flag on than with it off.

**Implications for upcoming work:**

1. Catching up on time away can now resume a world that is still cycling pigment and mite/skimmer lineages, not only a dormant lucent-and-grazer floor
2. Selection has something to bite on while cargo mites reproduce; other species still need their own birth rules before their traits can drift
3. Reedwells and rainbells still go extinct without more specific weather/light conditions — a later physics change, not a population gift
4. A body-eating consumer will have real deaths to feed on (skimmer and mite turnover is already dozens per 30 days)
