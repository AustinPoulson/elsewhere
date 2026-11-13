# Next expeditions

These are proposed creative directions, not work already implemented. Choose one relationship at a time, play with the result, and keep the additions that make the world more interesting.

## 1. The pigment grazer — implemented in Expedition 001

A small organism consumes lucent sediment and gathers it into nests. Its arrival makes the history of feeding an active resource. Watching it should explain what it does without a tutorial.

Four grazers gather pigment into their own bounded woven nests. [Expedition 001](expedition-001-pigment-grazers.md) records the behavior, migration, and acceptance evidence. Passing rain now changes where lucents feed before those traces reach the grazers.

## 2. Weather that changes a relationship — implemented in Expedition 002

Rain briefly spreads light across the water, widening the area where lucents can feed. Ringlets and a countdown mark each 38-second shower. [Expedition 002](expedition-002-passing-rain.md) records the relationship and acceptance evidence. Observe the wider pigment field and nest response before adding drought or a second weather rule.

## 3. Beyond the opening frame

Before expanding the camera, [Expedition 003](expedition-003-borrowed-color.md) closes another relationship inside this pool: the visitor can return a nest's stored color as six visible grains, and the grazers gather it home again. Observe this resource loop before adding another habitat.

Add a second pool and a gentle pan/zoom camera. Organisms or resources cross a connection between the pools. Exploration then discovers a new ecological relationship rather than empty map area. Keep the original tidepool as a composed opening scene. **Implemented in this linked-pools slice:** a southern inlet joined by a slow reversing channel, with pan/zoom from the original opening frame. Named eras are implemented as the remainder of roadmap step 5.

## 4. Become an inhabitant

Let the visitor pilot a luminous organism. Movement leaves or transports a resource already used by the ecosystem. Compare the experience with direct cultivation before making embodiment the default. A small movement model may be enough; choose a full physics/game engine only when collisions and character systems demand it.

## 5. Preserve eras — implemented as named eras

Curate named snapshots of earlier worlds alongside short field notes about the experiment that created each one. **This slice:** a static collection of three reviewed snapshots plus visitor-kept live shores on the same shelf. Each file is `elsewhere-era` format revision 1: identity, field note, provenance, and a world snapshot validated by `restoreWorld`. Kept eras persist locally (`elsewhere-kept-eras` revision 1) and count toward the catalog. Opening a reviewed era restores that frozen moment the same way pocket import does. Opening a kept era holds the live pool aside. Catalog budget: at most 8 eras, 1,000,000 characters per inner snapshot, 4 MB for the shelf. `npm run capture-era` writes a file in that format. Replay beyond visiting a kept era as a held-aside frozen moment, and beyond loading a reviewed era as the active world, remain later work.

## How to pick

Maintenance to schedule separately: upgrade the baseline Vitest tooling to address its development-only audit advisories. The shipped runtime audit is currently clean. Review that dependency change on its own branch and PR before broadening the ecosystem.

A good next expedition adds one visible relationship, fits a short review cycle, and leaves enough space for the following idea. The agent brief in [architecture.md](architecture.md) keeps behavior, limits, persistence, and verification concrete.

These sessions can also explore development itself: separate concept and implementation agents, compare two interpretations of a brief, or let an agent propose a mutation within a small scope. The ecosystem is the shared material that makes those experiments tangible.
