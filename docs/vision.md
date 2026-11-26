# Vision: From Authored Species to Emergent Life

Elsewhere is a browser terrarium—a living ecosystem that keeps going while you're away. The goal is to stop hand-authoring species and start authoring physics: light, pigment, water, time, and simple rules for bodies, inheritance, and death. Life sorts itself out; new conditions (a deeper pool, seasons, a mineral seam) create variety, not hand-made creatures. Extinction is allowed. The world keeps its own memory: fossils in the sediment, traces of extinct colonies, and a self-writing field journal.

Eventually: several pools linked by slow currents, and the world keeps living while nobody watches. It should feel like a real terrarium on a windowsill—alive without you, a little mysterious, different every time.

## Roadmap

- [x] **Headless fast-forward harness** — Run the simulation without a renderer for many simulated days and report what happened. Enables testing population dynamics and resource flow without waiting in real time. _Success: `npm run harness -- --days 30 --seed 1` completes in under a minute and prints population curves, births, deaths, extinctions, and resource totals._

- [x] **Heritable traits with small mutations** — Offspring inherit parent traits with small random variations; reproduction costs real parent reserves. A faint ambient daylight cycle lets lucents convert sky light into pigment so some lineages can persist without visitor input. _Success: offspring visibly differ from parents; resource cost is reflected in parent reserve depletion; 30-day harness runs without visitor light keep at least one advanced lineage alive and bounded._

- [x] **A second resource and body-eating consumer** — When a mortal body ends, its paid color becomes a located remain that slowly leaches into ordinary pigment; a small scavenger (marlgrub) can pay for itself from those remains. _Success: dead organisms become food for a consumer; resource accounting remains balanced._

- [x] **Catching up on time spent away** — Simulate elapsed time when the user returns; generate a "while you were gone" journal. _Success: reopening after an hour shows the world has advanced; journal summarizes key events._

- [x] **Fossils, eras, and linked pools** — Fossils in sediment record extinct populations; multiple pools connected by slow currents allow migration; named eras keep reviewed snapshots of earlier worlds. _Success: fossils visible in old sediment; organisms can move between pools; a visitor can open a named era, read its field note, and restore that frozen moment without gifts._ Fossils and linked pools already exist. Named eras are a static collection of three reviewed snapshots (`elsewhere-era` format, cap 8, 4 MB catalog). Automated capture is the format and `npm run capture-era`; replay uses the ordinary snapshot importer.

- [x] **New conditions** — Author physics and habitat, not species. A slow year, a deeper pool, or a mineral seam should create variety; life sorts itself out and extinction is allowed. No free populations, pigment, or energy.
  - [x] **Seasons** — first slice. A six-world-day year (2160 seconds) derived from elapsed time shifts daylight length and strength, rain span, and channel current. Opening climate matches the previous yearless world. Catch-up, eras, and the harness see the same year. Schema revision stays 13. _Success: a 30-day harness covers five complete years; the UI names the season; a while-you-were-gone journal can mention a season change._
  - [x] **A mineral seam** — second slice. An ochre vein in the opening pool's western sediment holds 24 pigment and dissolves at 0.00072 per second (faster in rain) into ordinary grains near the streak. Placement uses tick phase, not the PRNG. Opening worlds start with the rock, not extra loose color. Schema revision 14; revision-13 saves receive a full unused vein and no pigment. Catch-up, eras, and the harness dissolve the same rock. _Success: a 30-day harness leaves the vein partly spent and balanced; nearby life can use the color; extinction is still allowed; the UI names the seam._
  - [x] **A deeper pool** — third slice. A small deep basin in the opening pool's northeastern water. Light harvest (ambient and visitor) thins with depth; rain barely widens feeding reach there; currents go still, so sediment and remains settle downhill. Settling uses basin geometry, not the PRNG. Opening worlds and revision-14 saves receive the habitat, not extra life or color. Schema revision stays 14. Catch-up, eras, and the harness see the same depth. _Success: a 30-day harness leaves ledgers balanced; nearby life may use the stiller floor; extinction is still allowed; the UI names the basin._

- [x] **Traces of time away** — When a visitor returns, the shore keeps a few faint, bounded marks of what actually happened while nobody watched: settled color, a faded path, a note the world wrote from events. Opening and migrated worlds receive none. The pool stays a little mysterious and different every time; extinction is still allowed.
  - [x] **Faint return marks** — first slice. A real catch-up (the existing 30s–8h path) can leave at most five session-only marks derived from events recorded while away: up to two lineage endings at the last body's position, a faded channel path if color or bodies crossed, and stains at the deep basin, mineral seam, or inlet when color actually settled there. Placement uses those event positions and authored geometry, never the world PRNG. Marks grant no pigment, energy, organisms, or light; they sit outside the save (schema revision stays 14) and fade over eight minutes of watched time. Opening worlds, imported or pocketed snapshots, named eras, and migrated old saves receive none. The journal and observations list name them; reduced motion draws them still; portrait keeps the same world coordinates. _Success: a 1h return on seed 1 shows marks; harness ledgers for seeds 1 and 42 match main._
  - [x] **The shore remembers** — second slice. Unfaded return marks live in the snapshot (schema revision 15) so closing the tab does not erase them; they keep fading from `formedAt` across reload. Faded marks compact into at most four shore-memory notes, derived only from recorded events, which the observations list and field journal can quietly recall. Opening worlds, imported or pocketed snapshots, named eras, and revision-14 or older saves receive none. Caps stay five live marks and four remembered returns. Marks still grant nothing and never touch the world PRNG. _Success: a 1h return on seed 1 survives serialize/restore; harness ledgers for seeds 1 and 42 match main._

- [x] **A visitor's own named eras** — Automated capture of the live pool onto the shelf, using the existing `elsewhere-era` format, the 8-era / 4 MB catalog, and the ordinary importer. Opening a kept era restores that frozen moment without gifts, catch-up, or return marks. _Success: a visitor can keep a reviewed snapshot of their own shore; the live world is unchanged; extinction is still allowed._
  - [x] **Keep a live shore** — first slice. A deliberate Keep this shore action (keyboard-accessible, works in portrait) captures the live pool in `elsewhere-era` format with a short field note written from recorded state and events, not hand-authored lore. Kept eras persist in a separate local shelf (`elsewhere-kept-eras` revision 1; a raw array of era files migrates) and count toward the existing 8-era / 4 MB catalog. The shelf says when it is full; a visitor can remove one of their own kept eras, not the three reviewed ones. Opening a kept era uses the ordinary snapshot importer, then holds the live pool aside so returning continues it unchanged: no gifts, catch-up, return marks, shore memory, free pigment, energy, or organisms. Keeping does not touch the live world, its save, or the world PRNG. Schema revision stays 15. _Success: a visitor can keep a snapshot of their own shore; harness ledgers for seeds 1 and 42 match main._

- [x] **Life that changes on its own** — Heritable drift beyond cargo mites, now also in skimmers, siltstitchers, marlgrubs, and glass limpets. When a body is born from a parent, it inherits drive and bulk through the existing mutation helper, with small bounded variation paid from the parent's reserves. Founders and opening worlds stay at baseline. Extinction is still allowed.
  - [x] **Skimmer inheritance** — first slice. A mature skimmer can pay 0.3 reserve for a child (body 0.2 / reserve 0.1) that inherits mutated drive and bulk from `mutateTraits`. Drive raises sediment intake and maintenance together. Bulk raises paid reserve capacity and cuts seek reach and mobility. Nest-funded founders stay at baseline and do not draw the PRNG. Schema revision 16; revision-15 skimmers receive `parentId: null` and a first-birth deadline from their age, keep their existing traits, and receive no pigment, energy, or organisms. _Success: a 30-day harness on seeds 1 and 42 shows skimmer trait drift; the child is paid from the parent; remains and resource ledgers balance; extinction is still allowed._
  - [x] **Siltstitcher inheritance** — second slice. A mature siltstitcher can pay 0.3 surplus reserve for a child (body 0.2 / reserve 0.1) that inherits mutated drive and bulk from `mutateTraits` and may share the parent's nest. Birth is gated on the parent's own reserve above a 0.1 survival floor, not on a second nest payment: nest-funded founders still cost 0.3 (body 0.2 / reserve 0.1) and stay at baseline. A parent stocks that surplus from nest refill before loading cargo; cargo still cannot become health. Drive raises nest refill and maintenance together. Bulk raises paid reserve capacity and cuts mobility. Schema revision 17; revision-16 siltstitchers receive `parentId: null` and a first-birth deadline from their age, keep their existing traits and 0.1 reserve, and receive no pigment, energy, or organisms. _Success: a 30-day harness on seeds 1 and 42 shows siltstitcher trait drift; extinction times stay comparable to main; nested pigment does not collapse; the child is paid from the parent; remains and resource ledgers balance._
  - [x] **Marlgrub inheritance** — third slice. A mature marlgrub can pay 0.1 surplus reserve for a child (body 0.1 / reserve 0) that inherits mutated drive and bulk from `mutateTraits`. Birth is gated on the parent's own reserve above a 0.05 survival floor, so the event-offer founding payment of 0.2 cannot become a child. A stocking parent banks remain surplus into reserve before a new founder can take a remain still inside its seek reach. Drive raises remains intake and maintenance together. Bulk raises paid reserve capacity and cuts seek reach and mobility. Event-offer founders stay at baseline and do not draw the PRNG. Schema revision 18; revision-17 marlgrubs receive `parentId: null` and a first-birth deadline from their age, keep their existing traits and reserves, and receive no pigment, energy, remains, or organisms. _Success: a 30-day harness on seeds 1 and 42 shows marlgrub parent births and drive/bulk drift; lifetimes stay comparable to main; the child is paid from the parent; remains and resource ledgers balance; extinction is still allowed._
  - [x] **Glass limpet inheritance** — fourth slice. A mature glass limpet can pay 0.2 surplus reserve for a child (body 0.2 / reserve 0) that inherits mutated drive and bulk from `mutateTraits`. Birth is gated on the parent's own reserve above a 0.05 survival floor, so the shoreline founding payment of 0.3 cannot become a child. Those child values match the species: a starved limpet is a 0.2 body, and the 0.05 floor is a starvation buffer below the 0.1 founder starting reserve. A stocking parent banks leftover grains in reach into reserve before loading catch, and before a new founder can take a grain still inside its feed reach. Drive raises intake and maintenance together. Bulk raises paid reserve capacity and cuts feed reach. Shore-funded founders stay at baseline and do not draw the PRNG. Schema revision 19; revision-18 glass limpets receive `parentId: null` and a first-birth deadline from their age, keep their existing traits and reserves, and receive no pigment, energy, remains, or organisms. _Success: a 30-day harness on seeds 1 and 42 shows glass limpet parent births and drive/bulk drift; lifetimes stay comparable to main; the child is paid from the parent; remains and resource ledgers balance; extinction is still allowed._

- [ ] **A world that keeps going** — The terrarium stays alive without a visitor, a little different every time. Extinction is allowed, but a shared empty band around 170 simulated minutes on every seed is one exhausted condition, not life sorting itself out. Founding reports name the cause: after opening coarse grains, remain fragments, and nest surplus are spent, nothing in the physics re-opens those payments from real color still in the pool.
  - [x] **Rain re-sorts the shore** — first slice. During rain, sediment and remains wash toward the shoreline band and nearby pairs compact onto the more shoreward grain. Founders already pay from those coarse grains and remain cells; the wash grants no pigment, energy, or organisms. Tick phase and pool geometry, never the world PRNG. Schema revision stays 19. _Success: a 30-day harness on seed 1 or 42 shows a species that died near 170m on main either living later or re-founding later from real resources; extinction still happens on some runs; remains and fossil ledgers balance._
  - [x] **Unused nests slump** — second slice. Nests with no living siltstitcher slowly pour stored color toward the fullest unused nest in the same pool. Founders already pay from a home holding 1.5; the slump grants no pigment, energy, or organisms. Tick phase and pool geometry, never the world PRNG. Schema revision stays 19. _Success: a 30-day harness on seed 1 or 42 shows siltstitchers re-founding later from real nest color or living past their main-branch extinction time; extinction still happens on some runs; remains and fossil ledgers balance._
  - [x] **Unused remain stains slump** — third slice. Remain fragments with no hungry marlgrub in reach slowly pour stored color toward the fullest unused remain in the same pool. Founders already pay from a remnant holding 0.2; the slump grants no pigment, energy, remains, or organisms. Tick phase and pool geometry, never the world PRNG. Schema revision stays 19. _Success: a 30-day harness on seed 1 or 42 shows marlgrubs living later or re-founding later from real remain color; extinction still happens on some runs; remains and fossil ledgers balance._
  - [x] **Shell catch returns to the shore** — fourth slice. Catch locked in a living glass limpet slowly pours already-paid color onto the fullest underfilled shoreline grain in the same pool. Founders already pay from coarse shore grains; the return grants no pigment, energy, grains, or organisms. Occupied nests and held remains stay with unused nest/remain slump. Tick phase and pool geometry, never the world PRNG. Schema revision stays 19. _Success: a 30-day harness on seed 1 shows siltstitcher, glass limpet, and marlgrub living together from real color; seed 42 glass limpets re-found later than on main; extinction still happens on some runs; remains and fossil ledgers balance._
  - [x] **A tide and a bounded sea** — fifth slice. The pool is a temporary pocket of a larger sea. A slow tide from elapsed world time (one cycle per 360-second day; PRNG only for rare wash chance) opens a northern mouth at high water and cuts the pool off at low water. The sea is a real bounded basin with its own pigment and a coarse opening population of four lucents and eight grains, placed from the world seed without drawing the pool PRNG. Color and rare drifting bodies cross both ways while the mouth is open and carry their own reserves; nothing is granted. Schema revision 20. Revision-19 and older saves receive the empty basin and zero tide ledgers, not a gifted sea population: an old shore is not owed a second ecology. A lineage that dies in the pool can return only by a real arrival from the sea. _Success: 30- and 60-day harness runs on seeds 1 and 42 report pool and sea lineages, arrivals and departures, conserved pigment, and extinctions; remains and fossil ledgers still balance._
  - [x] **A strandline beyond the mouth** — sixth slice. Pigment, grains, and remains that actually leave the pool on the ebb settle on a small wrack line on the sea side of the north mouth instead of dispersing. The band is bounded and slowly leaches back into the sea's ordinary pigment. Visitor bodies already in the sea (siltstitchers, glass limpets, marlgrubs) can feed or found there by the same paid rules they use in the pool, and the next flood can carry them back. Nothing is gifted: the strandline holds only color and remains that really crossed the mouth, and its ledger balances against the pool and sea. Placement uses geometry and tick phase, never new PRNG draws in the pool's order. Schema revision 21. Revision-20 and older saves receive the empty strandline and zero strandline ledgers, not a gifted population. Catch-up, eras, return marks, and the harness see the same wrack. _Success: 30- and 60-day harness runs on seeds 1 and 42 report pool, sea, and strandline lineages; visitor lineages alive anywhere, summed over both seeds, were 3 at day 30 (not lower than main) and 3 at day 60 (strictly higher than main's 2); remains and fossil ledgers still balance._
  - [x] **A second pool on the same shore** — seventh slice. A small high rock pool sits on the same north shore, west of the main mouth, fed by the sea through its own mouth and by a high-tide spill from the opening pool. It is habitat, not a creature and not a third visitor world (`MAX_POOLS` stays 2). It opens empty, with no gifted pigment, and fills only from real color and bodies. The sill is higher (tide height 0.72) so the pocket is isolated longer than the opening pool; flood wash uses tick phase, never extra PRNG draws. Schema revision 22. Revision-21 and older saves receive the empty pocket and zero pocket ledgers. Catch-up, eras, return marks, and the harness see the same basin. _Success: on seed 1 at day 60, siltstitcher and glass limpet live across the shore where main kept only marlgrubs, and siltstitchers — gone on main by day 60 on both seeds — persist; day-30 visitor totals summed over seeds 1 and 42 match main (3); extinction still happens (seed 42 empties by day 60); remains and fossil ledgers balance. The summed day-60 visitor bar is 2 versus main's 3: the pocket does not hold a second living lineage through low tide on every seed._

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

**What remains later:** Replay tools beyond visiting a kept era as a held-aside frozen moment, and beyond opening a reviewed era as the live world. The format and `npm run capture-era` remain the contract.

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

**What the year did, honestly:** It did not save reedwells or rainbells, and it did not guarantee mites. It changed when nest-funded and shoreline types found and emptied, and it moved more loose color through the neck. First-year winters on both seeds emptied cargo mites; later years sometimes re-founded them. Seasonal bottlenecks are real; they are not a reason to grant bodies.

### Mineral seam (seeds 1 and 42)

**Geology, not a gift:** The vein is authored habitat in the opening pool at (575, 570). It holds 24 pigment and dissolves from elapsed time plus rain, the same clock catch-up, eras, and the harness already share. Opening worlds have the rock and the same 48 spring grains as before; none of the dissolved color is present at t=0. Revision-13 saves migrate with `seamAccrued: 0` and `seamDissolved: 0`. Placement uses tick phase, so the world PRNG is untouched.

**Thirty unwatched days, seeds 1 and 42:** Both seeds dissolved 8.300 and kept 15.671 in the rock plus 0.029 accrued (`24 = 15.671 + 0.029 + 8.300`). Ambient harvest stayed 7486.73. The extra color is ordinary pigment near the streak; grazers can carry it home, and fade plus gathering keep it from flooding the floor.

|                                             | Seed 1 seasons              | Seed 1 seam                 | Seed 42 seasons             | Seed 42 seam                     |
| ------------------------------------------- | --------------------------- | --------------------------- | --------------------------- | -------------------------------- |
| Ambient harvest                             | 7486.73                     | 7486.73                     | 7486.73                     | 7486.73                          |
| Seam dissolved / remaining                  | —                           | 8.300 / 15.671              | —                           | 8.300 / 15.671                   |
| Remains created = held + consumed + decayed | 25.875 = 0 + 2.507 + 23.368 | 20.863 = 0 + 1.162 + 19.701 | 26.451 = 0 + 5.789 + 20.663 | 34.488 = 0.125 + 10.792 + 23.571 |
| Fossils formed = held                       | 1.453                       | 1.699                       | 1.338                       | 1.166                            |
| Nested pigment                              | 1.05                        | 1.39                        | 1.19                        | 1.24                             |
| Loose pigment (inlet)                       | 0.80 (0.71)                 | 0.00 (0.00)                 | 1.71 (1.00)                 | 1.17 (0.65)                      |

**Seed 1, 30 unwatched days:** Lucents and grazers still hold. Skimmers ended at 3 (58 / 55) versus 1 (43 / 42) on seasons. A siltstitcher was still alive (10 / 9) instead of going extinct at 132m. Cargo mites closed at 2 (98 / 96) rather than cap 4. Glass limpets turned over less and ended earlier (3 / 3 at 52m versus 17 / 17 at 168m). Nested color rose to 1.39; loose color on the floor went quiet. Grazers had gathered the leach. Marlgrubs still died (5 / 5 at 168m).

**Seed 42, 30 unwatched days:** Skimmers ended at 2 (24 / 22) versus 2 (45 / 43) on seasons. Cargo mites closed at 2 (147 / 145) instead of emptying at 179m 48s. Siltstitchers lasted to 170m with 4 births versus 94m with 6. Reedwells and rainbells still boom-bust in the first quarter-hour. Marlgrubs had a larger pulse (43 / 43 versus 25 / 25) and still went extinct at 173m. A little loose color (0.047) remained within 90 of the seam.

**What the seam did, honestly:** It did not save reedwells or rainbells, and it did not freeze anyone in place. The same 8.3 units left the rock on both seeds; what happened next was seed-shaped gathering and founding. Nested color rose. Some nest-funded lives lasted longer. Shoreline glass limpets on seed 1 ended sooner. Extinction is still allowed. The remaining new-condition candidate is a deeper pool.

### Deeper pool (seeds 1 and 42)

**Habitat, not a species:** A small deep basin sits in the opening pool at (1090, 318). Light harvest scales with depth (`1 - 0.62 * depth`), rain widens feeding reach less (`1 - 0.75 * depth`), and currents go still (`1 - 0.88 * depth`). Sediment, remains, and fossils settle downhill at 1.15 world units/second at full depth. Living bodies are not pulled. Settling uses the basin geometry, so the world PRNG is untouched. Opening worlds have the same 24 lucents, 4 grazers, and 48 spring grains as before. Schema revision stays 14; revision-14 saves pick up the habitat going forward and receive no pigment, organisms, or energy.

**Thirty unwatched days, seeds 1 and 42:** Ambient harvest fell on both seeds (7486.73 → 7442.42 / 7449.66) because lucents that enter the basin convert less daylight. The seam still dissolved 8.300 on both seeds. Remains and fossils balanced. At day 30 neither seed held loose, remain, or fossil color in the basin; seed 1 had one body there. The floor did not become a pantry.

|                                             | Seed 1 seam                 | Seed 1 depth                | Seed 42 seam                     | Seed 42 depth               |
| ------------------------------------------- | --------------------------- | --------------------------- | -------------------------------- | --------------------------- |
| Ambient harvest                             | 7486.73                     | 7442.42                     | 7486.73                          | 7449.66                     |
| Seam dissolved / remaining                  | 8.300 / 15.671              | 8.300 / 15.671              | 8.300 / 15.671                   | 8.300 / 15.671              |
| Deep pigment / remains / bodies             | —                           | 0 / 0 / 1                   | —                                | 0 / 0 / 0                   |
| Remains created = held + consumed + decayed | 20.863 = 0 + 1.162 + 19.701 | 26.110 = 0 + 3.640 + 22.470 | 34.488 = 0.125 + 10.792 + 23.571 | 26.911 = 0 + 4.805 + 22.105 |
| Fossils formed = held                       | 1.699                       | 1.682                       | 1.166                            | 1.546                       |
| Nested pigment                              | 1.39                        | 0.81                        | 1.24                             | 1.44                        |
| Loose pigment (inlet)                       | 0.00 (0.00)                 | 1.33 (0.75)                 | 1.17 (0.65)                      | 1.99 (0.78)                 |

**Seed 1, 30 unwatched days:** Lucents and grazers still hold. Skimmers ended at 2 (42 / 40) versus 3 (58 / 55) on the seam. Siltstitchers went extinct at 157m (14 / 14) instead of surviving. Glass limpets turned over more and ended later (9 / 9 at 173m versus 3 / 3 at 52m). Cargo mites closed at 2 (121 / 119). One marlgrub was still alive (15 / 14) instead of going extinct at 168m. Nested color fell to 0.81; loose color returned to the floor and the inlet.

**Seed 42, 30 unwatched days:** Skimmers ended at 3 (57 / 54) versus 2 (24 / 22) on the seam. Cargo mites emptied at 179m 21s (117 / 117) after closing at 2 on the seam. A glass limpet was still alive (6 / 5) instead of going extinct at 127m. Siltstitchers lasted to 174m with 9 births versus 170m with 4. Reedwells and rainbells still boom-bust in the first quarter-hour. Marlgrubs still died (17 / 17 at 172m versus 43 / 43 at 173m).

**What the depth did, honestly:** It did not save reedwells or rainbells, and it did not fill the basin with free color. Ambient harvest is a little weaker when bodies enter the deep. Seam leaching is unchanged. Some shoreline lives lasted longer on one seed and emptied on the other. Extinction is still allowed. Step 6 new conditions is complete.

### Traces of time away, first slice (seeds 1 and 42)

**Memory, not a resource:** Return marks live in the session, not in the snapshot. Schema revision stays 14. `serializeWorld` after catch-up matches a live `stepWorld` loop of the same length. Opening worlds, imported snapshots, named eras, and migrated saves receive none.

**A 1h return already writes a small set of marks:** Seed 1's journal named siltstitcher, glass-limpet, and marlgrub endings, the seam leaking, and the shore keeping faint marks of that time. The observations list repeats "Faint marks remain from time away." Deep pigment did not rise enough for a basin stain. Marks fade over eight minutes of watched time and cap at five.

**Thirty unwatched days still match main:** The harness never creates traces. Ledgers, conservation checks, resources, and event counts for seeds 1 and 42 were identical to `main`.

|                                             | Seed 1 main / this slice    | Seed 42 main / this slice   |
| ------------------------------------------- | --------------------------- | --------------------------- |
| Ambient harvest                             | 7442.42                     | 7449.66                     |
| Seam dissolved / remaining                  | 8.300 / 15.671              | 8.300 / 15.671              |
| Remains created = held + consumed + decayed | 26.110 = 0 + 3.640 + 22.470 | 26.911 = 0 + 4.805 + 22.105 |
| Fossils formed = held                       | 1.682                       | 1.546                       |
| Nested pigment                              | 0.81                        | 1.44                        |
| Loose pigment (inlet)                       | 1.33 (0.75)                 | 1.99 (0.78)                 |

**What this slice did not persist:** Marks were session-only here. A refresh dropped them until another catch-up. The second slice stores unfaded marks in the snapshot, so a tab close keeps any that have not finished fading and they resume fading from `formedAt`. Extinction is still allowed.

### Traces of time away, second slice (seeds 1 and 42)

**Memory, still not a resource:** Unfaded return marks and a four-note shore memory live in the snapshot at schema revision 15. `stepWorld` never writes them. Catch-up records marks from events, then stores them; time away does not spend their fade. Opening worlds, imported snapshots, named eras, and revision-14 saves receive empty collections.

**A 1h return survives closing the tab:** Seed 1 still names siltstitcher, glass-limpet, and marlgrub endings, the seam leaking, and faint marks of that time. Marks that have not finished fading persist across a tab close and resume fading from `formedAt`. Serialize then restore keeps the same marks and remaining fade. After eight minutes of watched time they compact into shore memory; the observations list can still mention an earlier return.

**Thirty unwatched days still match main:** The harness never creates traces. Ledgers, conservation checks, resources, and event counts for seeds 1 and 42 were identical to `main`.

|                                             | Seed 1 main / this slice    | Seed 42 main / this slice   |
| ------------------------------------------- | --------------------------- | --------------------------- |
| Ambient harvest                             | 7442.42                     | 7449.66                     |
| Seam dissolved / remaining                  | 8.300 / 15.671              | 8.300 / 15.671              |
| Remains created = held + consumed + decayed | 26.110 = 0 + 3.640 + 22.470 | 26.911 = 0 + 4.805 + 22.105 |
| Fossils formed = held                       | 1.682                       | 1.546                       |
| Nested pigment                              | 0.81                        | 1.44                        |
| Loose pigment (inlet)                       | 1.33 (0.75)                 | 1.99 (0.78)                 |

**What this slice does not do:** Pocket import and named eras still arrive without marks, even if a revision-15 file had them. A visitor can now keep their own named era of the live pool. Extinction is still allowed.

### A visitor's own named eras, first slice (seeds 1 and 42)

**A shelf, not a new format:** Keep this shore captures the live pool as an `elsewhere-era` file: identity, a field note written from recorded census, fossils, pigment, season, and visitor-light, plus the ordinary snapshot. Kept files live in `elsewhere:kept-eras:v1` (`elsewhere-kept-eras` revision 1). A raw array of era JSON strings migrates. Schema revision stays 15; the live save is untouched. Opening worlds and older live saves receive no kept eras.

**Keeping does not change the pool:** The live world, its autosave, and the world PRNG are the same after a keep. Return marks and shore memory stay on the live shore and are stripped from the frozen file, the same as reviewed capture. The shelf counts kept eras toward eight files and 4 MB with the three reviewed snapshots. It says when it is full. A visitor can remove a kept era; reviewed worlds stay.

**Opening a kept era is a visit:** Restore uses `restoreWorld`, stamps `lastSeenAt` to now, skips catch-up, and grants nothing — no pigment, energy, organisms, return marks, or shore memory. The live pool is held aside and does not autosave over itself. Returning continues that live shore unchanged. Reviewed eras still replace the live pool after confirmation.

**Thirty unwatched days still match main:** The harness never keeps or opens eras. Ledgers, conservation checks, resources, and event counts for seeds 1 and 42 were identical to `main`.

|                                             | Seed 1 main / this slice    | Seed 42 main / this slice   |
| ------------------------------------------- | --------------------------- | --------------------------- |
| Ambient harvest                             | 7442.42                     | 7449.66                     |
| Seam dissolved / remaining                  | 8.300 / 15.671              | 8.300 / 15.671              |
| Remains created = held + consumed + decayed | 26.110 = 0 + 3.640 + 22.470 | 26.911 = 0 + 4.805 + 22.105 |
| Fossils formed = held                       | 1.682                       | 1.546                       |
| Nested pigment                              | 0.81                        | 1.44                        |
| Loose pigment (inlet)                       | 1.33 (0.75)                 | 1.99 (0.78)                 |

**What this slice does not do:** A kept era is local to this browser. Opening one does not make it the live save; returning restores the held shore. Visitor-written titles, comparing two eras, and replay tools beyond that visit remain later work. Extinction is still allowed.

### Skimmer drift (seeds 1 and 42)

**Parent-paid births, not a gift:** Nest-funded founders still open at drive/bulk 1 and do not draw the PRNG. A mature skimmer can pay 0.3 of its own reserve for a child (body 0.2 / reserve 0.1) that inherits through `mutateTraits`. Drive raises sediment intake and maintenance together. Bulk raises paid reserve capacity and cuts seek reach and mobility. Schema revision 16; revision-15 skimmers receive lineage fields and keep their traits. No pigment, energy, or organisms are granted.

**Turnover roughly doubles, and traits move during the run:** Net census births are still per-step population change, so same-tick opposite events cancel. Seed 1 went 94 / 91 versus 42 / 40 on main; seed 42 went 117 / 114 versus 57 / 54. Mid-run samples left baseline: seed 1 at 1m 48s averaged drive 1.016 / bulk 1.022, and at 95m 0.982 / 0.990; seed 42 at 1m 48s averaged 0.978 / 0.975, and at 79m 0.985 / 0.998. The day-30 living set on both seeds sat at drive 1.000 / bulk 1.000 — recent nest founders after turnover, not a frozen lineage. Seed 1 even left two skimmer fossils from an empty tick, then re-founded.

**Ledgers still balance, and extinction is still allowed:** Remains and fossils conserved on both seeds. Reedwells and rainbells still boom-bust on seed 42. Seed 1 lost siltstitchers at 129m and glass limpets at 147m (earlier than main). Seed 42 lost glass limpets at 104m after they had survived on main, and cargo mites emptied at 175m. The cap of six held.

|                                             | Seed 1 main                 | Seed 1 skimmer drift            | Seed 42 main                | Seed 42 skimmer drift       |
| ------------------------------------------- | --------------------------- | ------------------------------- | --------------------------- | --------------------------- |
| Skimmers at day 30 (births / deaths)        | 2 (42 / 40)                 | 3 (94 / 91)                     | 3 (57 / 54)                 | 3 (117 / 114)               |
| Mean skimmer drive / bulk at day 30         | 1.000 / 1.000               | 1.000 / 1.000                   | 1.000 / 1.000               | 1.000 / 1.000               |
| Ambient harvest                             | 7442.42                     | 7439.11                         | 7449.66                     | 7452.80                     |
| Remains created = held + consumed + decayed | 26.110 = 0 + 3.640 + 22.470 | 28.961 = 0.153 + 2.021 + 26.787 | 26.911 = 0 + 4.805 + 22.105 | 23.573 = 0 + 1.656 + 21.917 |
| Fossils formed = held                       | 1.682                       | 1.146                           | 1.546                       | 1.494                       |
| Nested pigment                              | 0.81                        | 0.87                            | 1.44                        | 2.19                        |
| Loose pigment (inlet)                       | 1.33 (0.75)                 | 0.58 (0.58)                     | 1.99 (0.78)                 | 1.43 (1.13)                 |

**What this slice does not do:** Lucents, grazers, reedwells, rainbells, siltstitchers, glass limpets, and marlgrubs still do not inherit. Their founders stay at baseline. Extinction is still allowed.

### Siltstitcher drift (seeds 1 and 42)

**Parent-paid births, not a second nest bill:** Nest-funded founders still cost 0.3 (body 0.2 / reserve 0.1), open at drive/bulk 1, and do not draw the PRNG. A mature parent can pay 0.3 of its own surplus reserve for a child (body 0.2 / reserve 0.1) only after stocking above a 0.1 survival floor, so founding and a child cannot spend the same nest surplus twice. Capacity 0.4 lets that surplus sit on the parent; cargo still cannot become health. At most two living carriers share a home. Drive raises nest refill and maintenance together. Bulk raises paid reserve capacity and cuts mobility. Schema revision 17; revision-16 siltstitchers receive lineage fields, keep their 0.1 reserve, and receive no pigment, energy, or organisms.

**Traits move while they live:** Net census births are still per-step population change. Seed 1 went 9 / 9 versus 8 / 8 on main; seed 42 went 12 / 12 versus 9 / 9. Mid-run samples left baseline: seed 1 at 5m 24s averaged drive 1.000 / bulk 0.985, and at 12m 36s 0.933 / 0.982; seed 42 at 5m 24s averaged 0.979 / 1.003, and a late pair at 176m 24s sat at 0.994 / 1.008.

**Extinction stays on the same clock, and nested pigment does not collapse:** An earlier cut that paid 0.6 at founding burned the line at 18–19m and dropped seed 42 nested pigment from 2.19 to 0.92. With the child paid only from the parent, seed 1 lasts 96m 49s (129m 55s on main) and seed 42 lasts 177m 44s (134m 17s on main). Seed 1 nested pigment ended at 1.60 versus 0.87 on main. Seed 42 nested pigment is lower (1.20 versus 2.19) with more turnover, not a nest-emptying collapse. Remains and fossils still conserved. The cap of six held.

|                                             | Seed 1 main                     | Seed 1 siltstitcher drift   | Seed 42 main                | Seed 42 siltstitcher drift  |
| ------------------------------------------- | ------------------------------- | --------------------------- | --------------------------- | --------------------------- |
| Siltstitchers at day 30 (births / deaths)   | 0 (8 / 8)                       | 0 (9 / 9)                   | 0 (9 / 9)                   | 0 (12 / 12)                 |
| Extinct at                                  | 129m 55s                        | 96m 49s                     | 134m 17s                    | 177m 44s                    |
| Ambient harvest                             | 7439.11                         | 7439.11                     | 7452.80                     | 7446.50                     |
| Remains created = held + consumed + decayed | 28.961 = 0.153 + 2.021 + 26.787 | 29.861 = 0 + 3.475 + 26.386 | 23.573 = 0 + 1.656 + 21.917 | 29.014 = 0 + 5.265 + 23.749 |
| Fossils formed = held                       | 1.146                           | 1.136                       | 1.494                       | 1.181                       |
| Nested pigment                              | 0.87                            | 1.60                        | 2.19                        | 1.20                        |
| Loose pigment (inlet)                       | 0.58 (0.58)                     | 1.03 (0.66)                 | 1.43 (1.13)                 | 0.68 (0.25)                 |

**What this slice does not do:** Glass limpets and marlgrubs still do not inherit. Their founders stay at baseline. Extinction is still allowed.

### Marlgrub drift (seeds 1 and 42)

**Parent-paid births, not a second remain bill:** Event-offer founders still cost 0.2 from a remnant (body 0.1 / reserve 0.1), open at drive/bulk 1, and do not draw the PRNG. A mature parent can pay 0.1 of its own surplus reserve for a 0.1 child body only after stocking above a 0.05 survival floor, so founding and a child cannot spend the same remain twice. Those child values match the species: marlgrubs are a 0.1 body, not a 0.2 siltstitcher, and the 0.05 floor is a starvation buffer below the 0.1 founder starting reserve. A stocking parent banks remain surplus into reserve before a new founder can take a remain still inside its seek reach. Drive raises remains intake and maintenance together. Bulk raises paid reserve capacity and cuts seek reach and mobility. Schema revision 18; revision-17 marlgrubs receive lineage fields, keep their traits and reserves, and receive no pigment, energy, remains, or organisms.

**Lifetimes stay on the same clock:** Net census births are still per-step population change. Seed 1 went 17 / 17 and ended at 170m 13s versus main 16 / 16 at 171m 27s. Seed 42 went 15 / 14 with one still alive at day 30 versus main 21 / 21 extinct at 167m 4s. Living drive/bulk drifted on both seeds (seed 1 bulk 1.000–1.079, seed 42 drive 1.000–1.075). Genealogical parent births: 1 on seed 1, 2 on seed 42.

**Ledgers still balance, and extinction is still allowed:** Remains and fossils conserved on both seeds. Reedwells and rainbells still boom-bust on seed 42. The cap of four held.

|                                             | Seed 1 main                 | Seed 1 marlgrub drift           | Seed 42 main                | Seed 42 marlgrub drift          |
| ------------------------------------------- | --------------------------- | ------------------------------- | --------------------------- | ------------------------------- |
| Marlgrubs at day 30 (births / deaths)       | 0 (16 / 16)                 | 0 (17 / 17)                     | 0 (21 / 21)                 | 1 (15 / 14)                     |
| Extinct at                                  | 171m 27s                    | 170m 13s                        | 167m 4s                     | survived                        |
| Mean marlgrub drive / bulk while living     | 1.000 / 1.000               | 1.000 / 1.002                   | 1.000 / 1.000               | 1.003 / 1.003                   |
| Drive min–max while living                  | 1.000–1.000                 | 0.996–1.000                     | 1.000–1.000                 | 1.000–1.075                     |
| Bulk min–max while living                   | 1.000–1.000                 | 1.000–1.079                     | 1.000–1.000                 | 1.000–1.050                     |
| Ambient harvest                             | 7439.11                     | 7439.11                         | 7446.50                     | 7451.00                         |
| Remains created = held + consumed + decayed | 29.861 = 0 + 3.475 + 26.386 | 29.867 = 0.170 + 3.497 + 26.200 | 29.014 = 0 + 5.265 + 23.749 | 27.637 = 0.099 + 3.465 + 24.072 |
| Fossils formed = held                       | 1.136                       | 1.136                           | 1.181                       | 1.350                           |
| Nested pigment                              | 1.60                        | 1.60                            | 1.20                        | 1.89                            |
| Loose pigment (inlet)                       | 1.03 (0.66)                 | 0.85 (0.66)                     | 0.68 (0.25)                 | 1.11 (0.69)                     |

**What this slice does not do:** Glass limpets still did not inherit in this slice. Their founders stay at baseline. Extinction is still allowed.

### Glass limpet drift (seeds 1 and 42)

**Parent-paid births, not a second shoreline bill:** Shore-funded founders still cost 0.3 from coarse grains (body 0.2 / reserve 0.1), open at drive/bulk 1, and do not draw the PRNG. A mature parent can pay 0.2 of its own surplus reserve for a 0.2 child body only after stocking above a 0.05 survival floor, so founding and a child cannot spend the same shoreline payment twice. Those child values match the species: a starved limpet is a 0.2 body, and the 0.05 floor is a starvation buffer below the 0.1 founder starting reserve. A first cut that kept the original 22-unit coarse-only current gate never reached the 0.25 stake (peak reserve 0.125). Stocking leftover grains in a 56-unit reach, including still leftovers and rain-washed food, is what let a parent actually pay. A stocking parent banks that surplus into reserve before loading catch, and before a new founder can take a grain still inside its feed reach. Drive raises intake and maintenance together. Bulk raises paid reserve capacity and cuts feed reach. Schema revision 19; revision-18 glass limpets receive lineage fields, keep their traits and reserves, and receive no pigment, energy, remains, or organisms.

**Lifetimes stay on the same clock:** Net census births are still per-step population change. Seed 1 went 9 / 9 and ended at 170m 3s versus main 14 / 14 at 162m 12s. Seed 42 went 13 / 12 with one still alive at day 30 versus main 10 / 10 extinct at 169m 55s. Living drive/bulk drifted on both seeds (seed 1 bulk 0.994–1.000, seed 42 drive 1.000–1.054). Genealogical parent births: 1 on seed 1, 1 on seed 42.

**Ledgers still balance, and extinction is still allowed:** Remains and fossils conserved on both seeds. Reedwells and rainbells still boom-bust on seed 42. The cap of four held.

|                                             | Seed 1 main                     | Seed 1 glass limpet drift       | Seed 42 main                    | Seed 42 glass limpet drift      |
| ------------------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- |
| Limpets at day 30 (births / deaths)         | 0 (14 / 14)                     | 0 (9 / 9)                       | 0 (10 / 10)                     | 1 (13 / 12)                     |
| Extinct at                                  | 162m 12s                        | 170m 3s                         | 169m 55s                        | survived                        |
| Mean limpet drive / bulk while living       | 1.000 / 1.000                   | 1.000 / 0.999                   | 1.000 / 1.000                   | 1.001 / 1.001                   |
| Drive min–max while living                  | 1.000–1.000                     | 1.000–1.001                     | 1.000–1.000                     | 1.000–1.054                     |
| Bulk min–max while living                   | 1.000–1.000                     | 0.994–1.000                     | 1.000–1.000                     | 1.000–1.029                     |
| Genealogical parent births                  | 0                               | 1                               | 0                               | 1                               |
| Ambient harvest                             | 7439.11                         | 7439.09                         | 7451.00                         | 7443.52                         |
| Remains created = held + consumed + decayed | 29.867 = 0.170 + 3.497 + 26.200 | 26.680 = 0.029 + 1.911 + 24.740 | 27.637 = 0.099 + 3.465 + 24.072 | 27.980 = 0.217 + 3.536 + 24.227 |
| Fossils formed = held                       | 1.136                           | 1.368                           | 1.350                           | 0.971                           |
| Nested pigment                              | 1.60                            | 1.02                            | 1.89                            | 1.85                            |
| Loose pigment (inlet)                       | 0.85 (0.66)                     | 1.14 (0.69)                     | 1.11 (0.69)                     | 1.27 (0.45)                     |

### A world that keeps going, first slice (seeds 1 and 42)

**Diagnosis:** The ~170m empty band was not a stuck founding cadence. Harness founding polls (one type per six ticks) fail as **no-resource**, not cap or rest: seed 1 glass limpets 8581/9000 no-resource with last founder at 166m 53s; siltstitchers 8433/9000, last 148m 11s; marlgrubs 23016 no-resource and 30220 no-offer. Opening stock is eight coarse shore grains that are gone by ~40m. Later shore pigment is often fine dust, remain cells stay below the 0.2 founding stake, and nest color is spread across four homes so none holds 1.5. Fossils fill by 135m and lock paid remain color. Offers still rotate; there is just nothing left in the form a founder already pays from.

**Rain re-sorts existing color, not a gift:** During rain, sediment and remains wash toward rho 0.78 at 3.6 world units/second (stilled in the deep basin by the ordinary rain scale). Once per six ticks a nearby pair within 28 units pours already-paid color onto the more shoreward grain. Schema revision stays 19. Opening worlds, catch-up, eras, and the harness see the same weather.

**The shared wall breaks, and extinction is still allowed:** Seed 1 glass limpets were empty at 165m on both runs; on main they died at 170m 3s (9/9, last founder 166m 53s). After the wash they re-founded from shore grains (2 living at 174m 36s, last founder 174m 56s, 13/12) and one was still alive at day 30. Seed 42 marlgrubs died at 179m 46s on main and were still alive at day 30 after the wash (19/18, last founder 177m 55s). Seed 42 glass limpets, which had survived on main, died at 175m 15s. Reedwells still boom-bust. Remains and fossils balanced.

|                                             | Seed 1 main                     | Seed 1 shore wash               | Seed 42 main                    | Seed 42 shore wash              |
| ------------------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- |
| Glass limpets at day 30 (births / deaths)   | 0 (9 / 9)                       | 1 (13 / 12)                     | 1 (13 / 12)                     | 0 (17 / 17)                     |
| Extinct at                                  | 170m 3s                         | survived                        | survived                        | 175m 15s                        |
| Last glass limpet founder                   | 166m 53s                        | 174m 56s                        | 177m 5s                         | 170m 40s                        |
| Siltstitchers at day 30 (births / deaths)   | 0 (14 / 14)                     | 0 (15 / 15)                     | 0 (13 / 13)                     | 0 (13 / 13)                     |
| Extinct at                                  | 152m 32s                        | 157m 53s                        | 176m 10s                        | 159m 38s                        |
| Marlgrubs at day 30 (births / deaths)       | 0 (9 / 9)                       | 0 (14 / 14)                     | 0 (15 / 15)                     | 1 (19 / 18)                     |
| Extinct at                                  | 164m 15s                        | 175m 33s                        | 179m 46s                        | survived                        |
| Coarse shore grains at 180m                 | 2                               | 3                               | 1                               | 0                               |
| Ambient harvest                             | 7439.09                         | 7440.13                         | 7443.52                         | 7443.90                         |
| Remains created = held + consumed + decayed | 26.680 = 0.029 + 1.911 + 24.740 | 28.939 = 0.176 + 2.948 + 25.815 | 27.980 = 0.217 + 3.536 + 24.227 | 29.606 = 0.000 + 3.932 + 25.674 |
| Fossils formed = held                       | 1.368                           | 1.456                           | 0.971                           | 1.669                           |
| Nested pigment                              | 1.02                            | 1.23                            | 1.85                            | 2.00                            |
| Loose pigment (inlet)                       | 1.14 (0.69)                     | 1.01 (0.62)                     | 1.27 (0.45)                     | 0.64 (0.24)                     |

**What this slice does not do:** Reedwells and rainbells still need a wet funded pocket. Nest-funded siltstitchers on seed 1 still empty when no home holds 1.5. Fossils stay memory; they do not leach. Extinction is still allowed.

### A world that keeps going, second slice (seeds 1 and 42)

**Diagnosis:** Siltstitchers still died on every first-slice run (seed 1: 157m 53s, last founder 155m 10s; seed 42: 159m 38s, last founder 156m 54s). Founding polls failed as **no-resource** (8256 / 8396), not cap or rest. Nested pigment often sat above the 1.5 stake (seed 1: 1.14–2.70; seed 42 ended at 2.00) but **rich nests stayed 0**: color was spread across four homes, and one nest on seed 1 emptied while the others held 0.3–1.3. Fossils were 16 tiny locked impressions; weathering them would not have filled a home.

**Unused nests slump existing color, not a gift:** A nest with no living siltstitcher pours 0.005 already-paid pigment, once per six ticks, toward the fullest unused nest in the same pool. Occupied homes are left alone. Tick phase and pool geometry, never the world PRNG. Schema revision stays 19. Opening worlds, catch-up, eras, and the harness see the same slump.

**Siltstitchers re-found from real nest color, and extinction is still allowed:** Seed 1 emptied in Year 5 (sil 0 at 147m 36s and 165m 36s) and re-founded after main's 157m 53s death (last founder 178m 35s, 1 living at day 30, 47/46 versus 15/15). Seed 42's last founder moved from 156m 54s to 179m 47s (1 living, 51/50 versus 13/13). Individuals still die. Reedwells still boom-bust. Seed 1 glass limpets, which had survived the wash, died at 177m 32s. Marlgrubs ended earlier on seed 1 (123m versus 175m) and died on seed 42 after surviving the wash. Seed 1 cargo mites closed at 1 rather than cap 4. Remains and fossils balanced.

|                                             | Seed 1 main                     | Seed 1 nest slump               | Seed 42 main                    | Seed 42 nest slump              |
| ------------------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- |
| Siltstitchers at day 30 (births / deaths)   | 0 (15 / 15)                     | 1 (47 / 46)                     | 0 (13 / 13)                     | 1 (51 / 50)                     |
| Extinct at                                  | 157m 53s                        | survived                        | 159m 38s                        | survived                        |
| Last siltstitcher founder                   | 155m 10s                        | 178m 35s                        | 156m 54s                        | 179m 47s                        |
| Glass limpets at day 30 (births / deaths)   | 1 (13 / 12)                     | 0 (17 / 17)                     | 0 (17 / 17)                     | 1 (15 / 14)                     |
| Extinct at                                  | survived                        | 177m 32s                        | 175m 15s                        | survived                        |
| Marlgrubs at day 30 (births / deaths)       | 0 (14 / 14)                     | 0 (4 / 4)                       | 1 (19 / 18)                     | 0 (13 / 13)                     |
| Extinct at                                  | 175m 33s                        | 123m 37s                        | survived                        | 179m 19s                        |
| Ambient harvest                             | 7440.13                         | 7440.13                         | 7443.90                         | 7443.90                         |
| Remains created = held + consumed + decayed | 28.939 = 0.176 + 2.948 + 25.815 | 29.125 = 0.030 + 0.889 + 28.206 | 29.606 = 0.000 + 3.932 + 25.674 | 31.477 = 0.000 + 2.828 + 28.649 |
| Fossils formed = held                       | 1.456                           | 2.025                           | 1.669                           | 1.946                           |
| Nested pigment                              | 1.23                            | 1.26                            | 2.00                            | 1.91                            |
| Loose pigment (inlet)                       | 1.01 (0.62)                     | 1.17 (1.17)                     | 0.64 (0.24)                     | 0.69 (0.37)                     |

**What this slice does not do:** Reedwells and rainbells still need a wet funded pocket. Fossils stay memory; they do not leach. Siltstitchers still empty when nested color falls below a payable home. Extinction is still allowed.

### A world that keeps going, third slice (seeds 1 and 42)

**Diagnosis:** After unused nests slump, marlgrubs died earlier (seed 1: 123m 37s, last founder 120m 13s, 4/4; seed 42: 179m 19s, last founder 173m 28s, 13/13). Founding polls failed as **no-resource** and **no-offer**, not cap: seed 1 23696 / 29743 of 54004, seed 42 24310 / 27858 of 54010. Remains were created (29.125 / 31.477) but almost all decayed (28.206 / 28.649); consumed fell to 0.889 / 2.828. Five-minute stock samples never saw a payable remnant (>= 0.2). Peak cells were 0.170 / 0.138, and nearest neighbors sat hundreds of units apart (mean 257 / 400), so rain compact's 28-unit pour could not gather them. A starved 0.2 body leaves only ~0.067 remain, which leaches at 0.003/s in about twenty seconds. The deep basin held none. Slice 2 did not steal marlgrub food for siltstitchers; it left remain color spread too thin to pay 0.2 before it became loose pigment or a fossil.

**Unused remain stains slump existing color, not a gift:** A remain with no hungry marlgrub in seek reach pours 0.005 already-paid pigment, once per six ticks, toward the fullest unused remain in the same pool. Occupied stains are left alone. Tick phase and pool geometry, never the world PRNG. Schema revision stays 19. Opening worlds, catch-up, eras, and the harness see the same slump.

**Marlgrubs re-found from real remain color, and extinction is still allowed:** Seed 1 emptied after main's 123m 37s death (Year 5 autumn mar 0 at 165m 36s) and re-founded (last founder 178m 2s, 1 living at day 30, 45/44 versus 4/4). Seed 42's last founder moved from 173m 28s to 178m 11s (1 living, 58/57 versus 13/13). Remains consumed rose (9.439 / 12.392 versus 0.889 / 2.828). Siltstitchers still re-found (1 living on both seeds). Glass limpets ended earlier on seed 1 (154m versus 177m) and died on seed 42 after surviving the nest slump; they still turned over (15/15 and 21/21). Reedwells still boom-bust. Remains and fossils balanced.

|                                             | Seed 1 main                     | Seed 1 remain slump             | Seed 42 main                    | Seed 42 remain slump             |
| ------------------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- | -------------------------------- |
| Marlgrubs at day 30 (births / deaths)       | 0 (4 / 4)                       | 1 (45 / 44)                     | 0 (13 / 13)                     | 1 (58 / 57)                      |
| Extinct at                                  | 123m 37s                        | survived                        | 179m 19s                        | survived                         |
| Last marlgrub founder                       | 120m 13s                        | 178m 2s                         | 173m 28s                        | 178m 11s                         |
| Siltstitchers at day 30 (births / deaths)   | 1 (47 / 46)                     | 1 (37 / 36)                     | 1 (51 / 50)                     | 1 (35 / 34)                      |
| Extinct at                                  | survived                        | survived                        | survived                        | survived                         |
| Glass limpets at day 30 (births / deaths)   | 0 (17 / 17)                     | 0 (15 / 15)                     | 1 (15 / 14)                     | 0 (21 / 21)                      |
| Extinct at                                  | 177m 32s                        | 154m 43s                        | survived                        | 169m 30s                         |
| Ambient harvest                             | 7440.13                         | 7440.13                         | 7443.90                         | 7443.90                          |
| Remains created = held + consumed + decayed | 29.125 = 0.030 + 0.889 + 28.206 | 34.719 = 0.102 + 9.439 + 25.178 | 31.477 = 0.000 + 2.828 + 28.649 | 36.296 = 0.044 + 12.392 + 23.860 |
| Fossils formed = held                       | 2.025                           | 2.647                           | 1.946                           | 2.379                            |
| Nested pigment                              | 1.26                            | 1.49                            | 1.91                            | 0.90                             |
| Loose pigment (inlet)                       | 1.17 (1.17)                     | 1.12 (1.12)                     | 0.69 (0.37)                     | 1.60 (0.87)                      |

**What this slice does not do:** Reedwells and rainbells still need a wet funded pocket. Fossils stay memory; they do not leach. A single starved death still cannot pay 0.2 on its own. Extinction is still allowed.

### A world that keeps going, fourth slice (seeds 1 and 42)

**Diagnosis:** After unused remain stains slump, marlgrubs lived to day 30 on both seeds, but glass limpets emptied on both (seed 1: 154m 43s, last founder 152m 3s, 15/15; seed 42: 169m 30s, last founder 166m 7s, 21/21). Founding polls failed as **no-resource**, not cap. Shore pigment was still there as fine dust; coarse neighborhoods could not pay 0.3. Marlgrubs do not eat sediment, so they were not competing for those grains. A 60-day harness on the same main showed founding was not a closed window: last founders sat past 320m (seed 1 sil 354m, gla 358m, mar 356m; seed 42 sil 323m, gla 342m, mar 359m), and accepted counts kept rising after day 30. Past 180m, rich nests and payable remains were still 0, occupied homes sat near 1.17 (below the 1.5 founding stake and the 1.2 refill floor), and coarse shore stayed thin. Color was locked in shells, nests, and remains rather than missing. Pouring occupied nest or held remain color onto the floor stole from slices 2–3 and swapped which two lineages survived. Shell catch is already-paid shore color that founders cannot use until it is a grain again.

**Shell catch returns existing color, not a gift:** Once per six ticks, tick phase picks one glass limpet holding catch and pours 0.005 already-paid pigment onto the fullest underfilled shoreline grain in the same pool. If the shore has no room, the nearest underfilled grain in that pool receives it. Occupied nests and held remains are left to unused nest/remain slump. Tick phase and pool geometry, never the world PRNG. Schema revision stays 19. Opening worlds, catch-up, eras, and the harness see the same return.

**Three lineages can share one pigment budget, and extinction is still allowed:** Seed 1 ended day 30 with siltstitcher, glass limpet, and marlgrub each living (gla last founder 178m 8s versus 152m 3s; 1 living, 14/13 versus 15/15). Seed 42's glass limpets also lived (last founder 179m 13s versus 166m 7s, 1 living, 17/16 versus 21/21) and siltstitchers still re-found; marlgrubs emptied at 176m 29s after sharing year-5 winter with both other lineages. Siltstitchers stayed on both seeds. Individuals still die. Reedwells still boom-bust. Remains and fossils balanced.

|                                             | Seed 1 main                     | Seed 1 catch return             | Seed 42 main                     | Seed 42 catch return            |
| ------------------------------------------- | ------------------------------- | ------------------------------- | -------------------------------- | ------------------------------- |
| Glass limpets at day 30 (births / deaths)   | 0 (15 / 15)                     | 1 (14 / 13)                     | 0 (21 / 21)                      | 1 (17 / 16)                     |
| Extinct at                                  | 154m 43s                        | survived                        | 169m 30s                         | survived                        |
| Last glass limpet founder                   | 152m 3s                         | 178m 8s                         | 166m 7s                          | 179m 13s                        |
| Siltstitchers at day 30 (births / deaths)   | 1 (37 / 36)                     | 1 (34 / 33)                     | 1 (35 / 34)                      | 1 (42 / 41)                     |
| Extinct at                                  | survived                        | survived                        | survived                         | survived                        |
| Marlgrubs at day 30 (births / deaths)       | 1 (45 / 44)                     | 1 (37 / 36)                     | 1 (58 / 57)                      | 0 (36 / 36)                     |
| Extinct at                                  | survived                        | survived                        | survived                         | 176m 29s                        |
| Last marlgrub founder                       | 178m 2s                         | 178m 7s                         | 178m 11s                         | 173m 47s                        |
| Ambient harvest                             | 7440.13                         | 7440.05                         | 7443.90                          | 7443.90                         |
| Remains created = held + consumed + decayed | 34.719 = 0.102 + 9.439 + 25.178 | 32.442 = 0.000 + 8.190 + 24.252 | 36.296 = 0.044 + 12.392 + 23.860 | 32.467 = 0.032 + 7.911 + 24.524 |
| Fossils formed = held                       | 2.647                           | 2.186                           | 2.379                            | 2.679                           |
| Nested pigment                              | 1.49                            | 1.38                            | 0.90                             | 1.41                            |
| Loose pigment (inlet)                       | 1.12 (1.12)                     | 0.14 (0.14)                     | 1.60 (0.87)                      | 1.14 (0.72)                     |

**What this slice does not do:** Reedwells and rainbells still need a wet funded pocket. Fossils stay memory; they do not leach. Occupied nests and held remains are not a fifth per-species slump. Seed 42 marlgrubs can still empty near day 30. Extinction is still allowed.

### A world that keeps going, sixth slice (seeds 1 and 42)

**Diagnosis:** After the bounded sea, 60-day harness runs on main emptied siltstitchers and marlgrubs in the pool on both seeds by ~350–358m. Seed 42 also lost siltstitcher, glass limpet, and marlgrub from the pool by day 30. One shore pocket meant every lineage shared one fate. The strandline (merged as schema 21) held wrack on the sea side of the north mouth without pulling living bodies. Visitor lineages alive anywhere, summed over seeds 1 and 42, stayed 3 at day 30 and rose to 3 at day 60 versus 2 on the pre-strandline main. Remains and fossils balanced. Pool–sea crossings fell; the mouth was left a corridor.

**What this slice does not do:** A wrack line is not a second basin. Siltstitchers still empty by day 60 on both seeds after the strandline.

### A world that keeps going, seventh slice (seeds 1 and 42)

**Diagnosis:** With only the opening pool and the sea, a lineage that dies in the pool can return only through the north mouth, and every visitor shares that one fate. A west-of-sea high pool with current-only flow never received anyone (zero pocket arrivals). A flood-and-ebb wash trapped sea lucents and grazers and flushed visitors back out. The landed geometry is a small high rock pool on the north shore west of the main mouth (`(580, 70)`, rx 40 / ry 22), open only when tide height ≥ 0.72, with a sea mouth and a high-tide spill from the opening pool. Tick-phase flood wash (no extra PRNG) moves visitor bodies already in reach; lucents and grazers are not pulled. Ebb through the pocket is 0.2× the flood. Opening worlds and revision-21 saves receive the empty basin and zero pocket ledgers.

**A high pool can change who persists, without gifting a population:** Seed 1 at day 60 keeps siltstitcher and glass limpet alive across the shore (one glass limpet is in the sea) where main kept only marlgrubs. Siltstitchers, gone on main by day 60 on both seeds, survive on this seed. Day-30 visitor totals summed over both seeds match main (3). Seed 42 still empties by day 60. Pocket arrivals are real (seed 42 day 30: 6 in / 0 out; seed 1 day 60: 3 in / 1 out). Remains and fossils balance on every run. The pocket is usually empty at the sampled low-tide snapshots: it is a high-water spill, not a permanently occupied tank. Summed visitor lineages at day 60 are 2 versus main's 3. Pool–sea crossings are lower than main.

|                                                      | Seed 1 main                      | Seed 1 high pool                 | Seed 42 main                     | Seed 42 high pool                |
| ---------------------------------------------------- | -------------------------------- | -------------------------------- | -------------------------------- | -------------------------------- |
| Visitors alive at day 30                             | marlgrub 1                       | marlgrub 1                       | glass limpet 1, marlgrub 1       | siltstitcher 1, glass limpet 1   |
| Visitors alive at day 60                             | marlgrub 2                       | siltstitcher 1, glass limpet 2   | glass limpet 1, marlgrub 1       | none                             |
| Tide arrivals / departures (day 30)                  | 161 / 163                        | 129 / 133                        | 151 / 156                        | 137 / 135                        |
| Pocket arrivals / departures (day 30)                | —                                | 0 / 1                            | —                                | 6 / 0                            |
| Tide arrivals / departures (day 60)                  | 309 / 308                        | 211 / 213                        | 296 / 300                        | 242 / 240                        |
| Pocket arrivals / departures (day 60)                | —                                | 3 / 1                            | —                                | 18 / 2                           |
| Remains created = held + consumed + decayed (day 30) | 25.141 = 0.030 + 7.193 + 17.919  | 20.440 = 0.000 + 3.177 + 17.263  | 31.704 = 0.000 + 9.059 + 22.645  | 37.918 = 0.000 + 9.078 + 28.840  |
| Fossils formed = held (day 30)                       | 1.785                            | 1.676                            | 1.753                            | 1.726                            |
| Remains (day 60)                                     | 45.680 = 0.000 + 13.895 + 31.785 | 56.438 = 0.142 + 14.232 + 42.063 | 61.018 = 0.142 + 16.871 + 44.005 | 74.460 = 0.212 + 20.718 + 53.530 |
| Fossils (day 60)                                     | 2.196                            | 2.506                            | 2.294                            | 2.596                            |

**What this slice does not do:** The pocket does not keep a living visitor lineage through every low tide. Reedwells and rainbells still need a wet funded neighborhood. Summed day-60 visitor lineages across both seeds are not higher than main. Extinction is still allowed.
