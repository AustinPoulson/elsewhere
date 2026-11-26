import { describe, expect, it } from 'vitest';
import { INLET_POOL, OPENING_POOL } from '../src/world/habitat';
import { REMAIN_SLUMP, slumpUnusedRemains, unusedRemainsSlumping } from '../src/world/environment/remain-slump';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { createWorld, stepWorld } from '../src/world/simulation';
import { remainRadius, heldRemainPigment } from '../src/world/species/remains';
import { SPECIES_CATALOG } from '../src/world/species/catalog';
import { baselineTraits } from '../src/world/traits';
import { REMAIN_CAPACITY, SCHEMA_REVISION, type Marlgrub, type Remain, type World } from '../src/world/types';
import { runHarness } from '../scripts/harness';

function stain(world: World, x: number, y: number, pigment: number, hue = 40): Remain {
  return {
    id: world.nextId++,
    species: 'remain',
    source: 'unknown',
    x,
    y,
    pigment,
    hue,
    age: 1,
    radius: remainRadius(pigment),
  };
}

function scavenger(world: World, x: number, y: number): Marlgrub {
  return {
    id: world.nextId++,
    species: 'marlgrub',
    x,
    y,
    vx: 0,
    vy: 0,
    body: 0.1,
    reserve: 0,
    age: 10,
    hue: 40,
    starvedFor: 0,
    targetRemainId: null,
    parentId: null,
    nextBirthAt: 100,
    traits: baselineTraits(),
  };
}

function twoRemains(a: number, b: number, tick = 12): World {
  const world = createWorld(1);
  world.elapsed = 40;
  world.tick = tick;
  world.grazers = [];
  world.skimmers = [];
  world.siltstitchers = [];
  world.glassLimpets = [];
  world.cargoMites = [];
  world.marlgrubs = [];
  world.remains = [
    stain(world, OPENING_POOL.x - 80, OPENING_POOL.y, a, 40),
    stain(world, OPENING_POOL.x + 80, OPENING_POOL.y, b, 80),
  ];
  return world;
}

describe('unused remain slump', () => {
  it('pours unused color toward the fuller stain without granting pigment', () => {
    const world = twoRemains(0.08, 0.14);
    const before = heldRemainPigment(world);
    const rng = world.randomState;
    slumpUnusedRemains(world);
    expect(world.randomState).toBe(rng);
    expect(heldRemainPigment(world)).toBeCloseTo(before, 12);
    expect(world.remains[0].pigment).toBeCloseTo(0.08 - REMAIN_SLUMP.amount, 12);
    expect(world.remains[1].pigment).toBeCloseTo(0.14 + REMAIN_SLUMP.amount, 12);
  });

  it('does not drain a remain a hungry scavenger can already reach', () => {
    const world = twoRemains(0.08, 0.14);
    world.marlgrubs = [scavenger(world, world.remains[0].x, world.remains[0].y)];
    slumpUnusedRemains(world);
    expect(world.remains[0].pigment).toBe(0.08);
    expect(world.remains[1].pigment).toBe(0.14);
  });

  it('leaves a held stain out of the unused pool so color can gather at an empty remnant', () => {
    const world = twoRemains(0.16, 0.08, 12);
    world.marlgrubs = [scavenger(world, world.remains[0].x, world.remains[0].y)];
    world.remains.push(stain(world, OPENING_POOL.x, OPENING_POOL.y + 200, 0.06, 20));
    slumpUnusedRemains(world);
    expect(world.remains[0].pigment).toBe(0.16);
    expect(world.remains[1].pigment).toBeCloseTo(0.08 + REMAIN_SLUMP.amount, 12);
    expect(world.remains[2].pigment).toBeCloseTo(0.06 - REMAIN_SLUMP.amount, 12);
  });

  it('keeps inlet color in the inlet', () => {
    const world = twoRemains(0.08, 0.14);
    world.remains[0].x = INLET_POOL.x;
    world.remains[0].y = INLET_POOL.y;
    slumpUnusedRemains(world);
    expect(world.remains[0].pigment).toBe(0.08);
    expect(world.remains[1].pigment).toBe(0.14);
  });

  it('does not overfill a remain or touch the PRNG', () => {
    const world = twoRemains(0.08, REMAIN_CAPACITY - 0.002);
    const rng = world.randomState;
    slumpUnusedRemains(world);
    expect(world.randomState).toBe(rng);
    expect(world.remains[1].pigment).toBeCloseTo(REMAIN_CAPACITY, 12);
    expect(world.remains[0].pigment).toBeCloseTo(0.078, 12);
    expect(heldRemainPigment(world)).toBeCloseTo(0.08 + REMAIN_CAPACITY - 0.002, 12);
  });

  it('concentrates spread fragments above the marlgrub founding stake', () => {
    const world = twoRemains(0.12, 0.18);
    world.organisms = [];
    world.lights = [];
    world.grazers = [];
    world.skimmers = [];
    world.nextFoundingTick = Number.MAX_SAFE_INTEGER - 12;
    world.marlgrubAdmissionAt = 1e9;
    world.skimmerAdmissionAt = 1e9;
    world.siltstitcherAdmissionAt = 1e9;
    world.glassLimpetAdmissionAt = 1e9;
    world.seamAccrued = 0;
    world.ecologyLedger.seamDissolved = 24;
    const before = heldRemainPigment(world);
    const rng = world.randomState;
    for (let i = 0; i < 4 * 30; i++) stepWorld(world);
    expect(world.randomState).toBe(rng);
    expect(world.marlgrubs).toHaveLength(0);
    expect(heldRemainPigment(world)).toBeLessThanOrEqual(before + 1e-9);
    expect(Math.max(...world.remains.map((remain) => remain.pigment), 0)).toBeGreaterThanOrEqual(
      SPECIES_CATALOG.marlgrub.admissionPigment,
    );
  });

  it('names slump only while unused stains actually differ', () => {
    const world = twoRemains(0.08, 0.14);
    expect(unusedRemainsSlumping(world)).toBe(true);
    world.remains[0].pigment = 0.14;
    expect(unusedRemainsSlumping(world)).toBe(false);
  });

  it('leaves schema 19 unchanged and grants nothing to a restored world', () => {
    const world = createWorld(3);
    expect(world.schemaRevision).toBe(SCHEMA_REVISION);
    expect(SCHEMA_REVISION).toBe(21);
    const restored = restoreWorld(serializeWorld(world));
    expect(restored).not.toBeNull();
    expect(restored!.schemaRevision).toBe(SCHEMA_REVISION);
    expect(heldRemainPigment(restored!)).toBeCloseTo(heldRemainPigment(world), 9);
    expect(restored!.marlgrubs).toEqual(world.marlgrubs);
  });

  it('keeps ledgers balanced on a short harness run', () => {
    const report = runHarness({ days: 2, seed: 1, visitorLight: false });
    expect(report.conservationCheck.remainsBalanced).toBe(true);
    expect(report.conservationCheck.fossilsBalanced).toBe(true);
    expect(report.conservationCheck.seamBalanced).toBe(true);
  });
});

describe('unused remain slump determinism', () => {
  it('replays the same slump after serialize', () => {
    const world = twoRemains(0.09, 0.13, 1200);
    const restored = restoreWorld(serializeWorld(world));
    expect(restored).not.toBeNull();
    for (let i = 0; i < 90; i++) {
      stepWorld(world);
      stepWorld(restored!);
    }
    expect(restored).toEqual(world);
  });
});
