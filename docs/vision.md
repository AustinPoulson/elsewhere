# Vision: From Authored Species to Emergent Life

Elsewhere is a browser terrarium—a living ecosystem that keeps going while you're away. The goal is to stop hand-authoring species and start authoring physics: light, pigment, water, time, and simple rules for bodies, inheritance, and death. Life sorts itself out; new conditions (a deeper pool, seasons, a mineral seam) create variety, not hand-made creatures. Extinction is allowed. The world keeps its own memory: fossils in the sediment, traces of extinct colonies, and a self-writing field journal.

Eventually: several pools linked by slow currents, and the world keeps living while nobody watches. It should feel like a real terrarium on a windowsill—alive without you, a little mysterious, different every time.

## Roadmap

- [x] **Headless fast-forward harness** — Run the simulation without a renderer for many simulated days and report what happened. Enables testing population dynamics and resource flow without waiting in real time. _Success: `npm run harness -- --days 30 --seed 1` completes in under a minute and prints population curves, births, deaths, extinctions, and resource totals._

- [x] **Heritable traits with small mutations** — Offspring inherit parent traits with small random variations; reproduction costs real parent reserves. A faint ambient daylight cycle lets lucents convert sky light into pigment so some lineages can persist without visitor input. _Success: offspring visibly differ from parents; resource cost is reflected in parent reserve depletion; 30-day harness runs without visitor light keep at least one advanced lineage alive and bounded._

- [x] **A second resource and body-eating consumer** — When a mortal body ends, its paid color becomes a located remain that slowly leaches into ordinary pigment; a small scavenger (marlgrub) can pay for itself from those remains. _Success: dead organisms become food for a consumer; resource accounting remains balanced._

- [x] **Catching up on time spent away** — Simulate elapsed time when the user returns; generate a "while you were gone" journal. _Success: reopening after an hour shows the world has advanced; journal summarizes key events._

- [x] **Fossils, eras, and linked pools** — Fossils in sediment record extinct populations; multiple pools connected by slow currents allow migration; named eras keep reviewed snapshots of earlier worlds. _Success: fossils visible in old sediment; organisms can move between pools; a visitor can open a named era, read its field note, and restore that frozen moment without gifts._ Fossils and linked pools already exist. Named eras are a static collection of three reviewed snapshots (`elsewhere-era` format, cap 8, 4 MB catalog). Automated capture is the format and `npm run capture-era`; replay uses the ordinary snapshot importer.

- [ ] **New conditions** — Author physics and habitat, not species. A slow year, a deeper pool, or a mineral seam should create variety; life sorts itself out and extinction is allowed. No free populations, pigment, or energy.
  - [x] **Seasons** — first slice. A six-world-day year (2160 seconds) derived from elapsed time shifts daylight length and strength, rain span, and channel current. Opening climate matches the previous yearless world. Catch-up, eras, and the harness see the same year. Schema revision stays 13. _Success: a 30-day harness covers five complete years; the UI names the season; a while-you-were-gone journal can mention a season change._
  - [ ] A deeper pool
  - [ ] A mineral seam

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

**The same rules run while nobody watches:** Catch-up is `stepWorld` in a loop, capped at eight hours (864,000 steps) and chunked into ~12 ms of main-thread work. A 1h gap took ~1.3s of wall time; 8h took ~8.3–8.7s. Gaps under 30 seconds are ignored. Gaps under ten minutes still simulate, but without a journal unless a lineage ended; the progress dialog appears only if the work would block for more than about 250 ms. Missing or inverted clocks skip catch-up without gifts. Beyond eight hours the journal says the rest of the time the world slept. Opening a pocketed snapshot restores the frozen moment and stamps presence to now, so the file's age is not treated as time away.

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

### Fossils in sediment (seeds 1 and 42)

**Extinction leaves paid color in the floor:** When a mortal lineage has no living members, its remains settle as durable fossils instead of fading sediment. They hold already-paid pigment (`fossilsFormed = held`). Opening worlds and revision-11 saves receive none.

**30-day harness, no visitor light:** Both seeds filled the 16-impression cap. Seed 1 held 2.208 fossil pigment (siltstitcher, glass limpet, cargo mite, marlgrub marks); glass limpets ended at 173m 17s and marlgrubs at 110m 37s. Seed 42 held 1.644 (rainbell, siltstitcher, glass limpet, cargo mite, marlgrub); reedwells ended at 16m, rainbells at 10m, glass limpets at 98m, marlgrubs at 109m, siltstitchers at 180m. Remains and fossil ledgers both balanced.

**A later return does not erase the mark:** Cargo mites and siltstitchers can empty and re-found. Fossils from those empty ticks stay in the sediment. Turnover can fill the cap with mite impressions; leftover remain color that cannot join an impression returns as ordinary pigment. That is the budget holding, not a new population.

### Linked pools and a southern inlet (seeds 1 and 42)

**The opening shore stays the first scene:** Schema revision 13 stores two authored basins and one channel. The original tidepool is still centered at (720, 500); the camera still opens on that frame. A smaller inlet sits south of a slow neck. Opening worlds and revision-12 saves receive the habitat, not organisms, pigment, lights, or energy.

**Crossing is drift, not a gift:** The neck is ordinary water. A persistent current along it reverses every three minutes from elapsed time, base 4.8 world units/second for bodies (seasonally scaled 0.82–1.18, envelope 5.664) and 0.35 of that for sediment. A grain or lucent placed in the mouth travels along the channel; it is never teleported to the inlet center. Opening worlds start with every lucent, grazer, nest, and grain inside the first pool.

**30-day harness, no visitor light:** Seed 1 ended with 0.33 loose pigment, all of it in the inlet, and 5 mobile bodies there versus 25 still in the opening pool. Nested pigment (0.92) stayed with the opening nests. Seed 42 kept 0.50 loose pigment in the opening pool and sent 0.14 into the inlet, with 4 mobile bodies across versus 27 still in the opening pool. Nested pigment (1.43) stayed with the opening nests. Neither seed received free inlet life at t=0.

**Discovery is looking, not a new tool:** Drag the stone, Shift+arrows, wheel or +/−, and Home to return. Portrait still rotates the same world; reduced motion still starts paused and applies camera changes immediately. Visitor stir currents remain capped at three, with four extra channel arrows.

### Named eras (seeds 1 and 42)

**The world keeps a visitor-facing memory:** Earlier worlds is a shelf of three reviewed snapshots, each with a field note about the experiment that made it. Opening an era uses the same importer as a pocketed file: restore the frozen moment, stamp `lastSeenAt` to now, skip catch-up, grant nothing. Camera pan/zoom is still unsaved. The field journal is still generated only after time away.

**Thirty unwatched days still match the linked-pool harness:** Seed 1's era holds 16 fossils, 3 skimmers, 4 cargo mites at cap, nested pigment 0.92, and 0.33 loose pigment — all of it in the inlet. Seed 42's era holds 16 fossils, 4 skimmers, 1 mite, nested pigment 1.43, 0.50 opening pigment and 0.14 inlet pigment. An hour on seed 1 already has 12 fossils, 3 skimmers and 3 mites; no loose pigment has crossed the neck yet.

**Storage stays bounded:** Three compact era files total about 101 KB, well under the 8-era / 4 MB catalog budget. Each inner world still passes the 1,000,000-character snapshot cap. Schema revision stays 13; eras live beside the live save, not inside it.

**What remains later:** Automated capture of a visitor's own pool into this shelf, and replay tools beyond opening a named era as the live world. The format and `npm run capture-era` are the contract for that work.

### Seasons (seeds 1 and 42)

**A year is six world days so the harness can see it turn:** Each season lasts 1.5 world days (540 seconds): three rain cycles and about one mortal generation (skimmer, limpet, and mite lives are 480 seconds). A 30-day run is exactly five years, so first-year and last-year samples line up. An hour away is 10 world days, so catch-up always crosses a season. Schema revision stays 13; season is `elapsed` plus a sine, not a saved field. Existing eras load as they were and pick up the year of their frozen clock.

**The opening climate is still the old climate:** At t=0 (spring) daylight, rain span (38 seconds), and channel scale match the yearless world. Strength and photoperiod peak at the start of summer and bottom at the start of winter; spring lengthens toward that peak and autumn shortens toward that floor. Rain is brief near summer's start and stays longer near winter's start; the channel envelope is 4.8×1.18 = 5.664. Ambient harvest over 30 days rose from 7425.53 to 7486.73 on both seeds — photoperiod is not a symmetric wash, and no pigment was granted.

**Harness census is net turnover:** Birth and death totals in these runs are per-step net population change, not complete genealogical event counts. Opposite events in the same 1/30-second step cancel. Population curves are separately downsampled. Reedwell harvest still uses the 0.18 base times current daylight, so the noon offer is 0.216 at summer's start and 0.144 at winter's start.

**Conservation, 30 unwatched days, reused from the seasons PR harness (not rerun):** Remains and fossils balanced on main and seasons for both seeds.

|                                             | Seed 1 main                 | Seed 1 seasons              | Seed 42 main                    | Seed 42 seasons             |
| ------------------------------------------- | --------------------------- | --------------------------- | ------------------------------- | --------------------------- |
| Ambient harvest                             | 7425.53                     | 7486.73                     | 7425.53                         | 7486.73                     |
| Remains created = held + consumed + decayed | 25.624 = 0 + 2.230 + 23.394 | 25.875 = 0 + 2.507 + 23.368 | 21.512 = 0.082 + 2.125 + 19.305 | 26.451 = 0 + 5.789 + 20.663 |
| Fossils formed = held                       | 1.476                       | 1.453                       | 1.320                           | 1.338                       |
| Nested pigment                              | 0.92                        | 1.05                        | 1.43                            | 1.19                        |
| Loose pigment (inlet)                       | 0.33 (0.33)                 | 0.80 (0.71)                 | 0.64 (0.14)                     | 1.71 (1.00)                 |

**Seed 1, 30 unwatched days:** Lucents and grazers still hold. Skimmers ended at 1 (43 / 42) versus 3 (46 / 43) on main. Cargo mites stayed at cap 4 (119 / 115 versus 123 / 119). They emptied in the first winter (Year 1 winter sample car 0 at 30m 36s) and re-founded; a later winter sample at 135m was also empty, and the close was 4. Grazers never left, so paid host founding stayed possible. Siltstitchers had more births (11 versus 8) and went extinct earlier (132m versus 175m). Glass limpets also turned over more (17 / 17, extinct 168m versus 14 / 14 at 180m). The brief rainbell on main did not found.

**Seed 42, 30 unwatched days:** Skimmers ended at 2 (45 / 43) versus 4 (65 / 61) on main. Cargo mites hit 0 at 179m 48s (123 / 123) after surviving on main with one body. That close is not proof of permanent extinction: four grazers were still present, Year 5 winter still had 2 mites at 174m 36s, and mites re-founded after the first-year winter empty (Year 5 spring car 4). Paid host founding still exists. Marlgrubs had a real pulse (25 / 25 versus 10 / 10) and lasted until 177m versus 145m. Siltstitchers lasted to 94m with 6 births versus dying at 10m with 3. Reedwells and rainbells still boom-bust in the first half-hour.

**Seed 42, 36 unwatched days:** Recovery occurs. After the 30-day close at 0 (last empty at 179m 48s), Year 6 spring re-founded to cap 4 by 183m 36s. Mites held at 4 through summer and autumn, then emptied again in Year 6 winter (last empty at 210m 27s; the close was still 0). Four grazers were present the whole time. Remains 31.363 = 0 + 6.556 + 24.807; fossils 1.338 = 1.338. That is paid host founding after a seasonal bottleneck, not a gift, and not a permanent seed-42 extinction.

**What the year did, honestly:** It did not save reedwells or rainbells, and it did not guarantee mites. It changed when nest-funded and shoreline types found and emptied, and it moved more loose color through the neck. First-year winters on both seeds emptied cargo mites; later years sometimes re-founded them. Seasonal bottlenecks are real; they are not a reason to grant bodies. Remaining new-condition candidates are a deeper pool and a mineral seam.
