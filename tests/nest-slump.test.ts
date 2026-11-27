import { describe, expect, it } from 'vitest';
import { INLET_POOL, OPENING_POOL } from '../src/world/habitat';
import {
  heldNestPigment,
  NEST_SLUMP,
  slumpUnusedNests,
  unusedNestsSlumping,
} from '../src/world/environment/nest-slump';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { createWorld, stepWorld } from '../src/world/simulation';
import { baselineTraits } from '../src/world/traits';
import { NEST_CAPACITY, SCHEMA_REVISION, type Siltstitcher, type World } from '../src/world/types';
import { runHarness } from '../scripts/harness';

function occupant(world: World, nestId: number): Siltstitcher {
  return {
    id: world.nextId++,
    species: 'siltstitcher',
    x: 720,
    y: 500,
    vx: 0,
    vy: 0,
    body: 0.2,
    reserve: 0.1,
    cargo: 0,
    age: 10,
    hue: 40,
    homeNestId: nestId,
    starvedFor: 0,
    mode: 'home',
    destination: null,
    blockedFor: 0,
    parentId: null,
    nextBirthAt: 100,
    traits: baselineTraits(),
  };
}

function twoNests(a: number, b: number, tick = 12): World {
  const world = createWorld(1);
  world.elapsed = 40;
  world.tick = tick;
  world.grazers = [];
  world.skimmers = [];
  world.siltstitchers = [];
  world.nests = [
    { id: world.nextId++, x: OPENING_POOL.x - 80, y: OPENING_POOL.y, hue: 40, pigment: a, age: 1 },
    { id: world.nextId++, x: OPENING_POOL.x + 80, y: OPENING_POOL.y, hue: 80, pigment: b, age: 1 },
  ];
  return world;
}

describe('unused nest slump', () => {
  it('pours unused color toward the fuller home without granting pigment', () => {
    const world = twoNests(0.4, 0.9);
    const before = heldNestPigment(world);
    const rng = world.randomState;
    slumpUnusedNests(world);
    expect(world.randomState).toBe(rng);
    expect(heldNestPigment(world)).toBeCloseTo(before, 12);
    expect(world.nests[0].pigment).toBeCloseTo(0.4 - NEST_SLUMP.amount, 12);
    expect(world.nests[1].pigment).toBeCloseTo(0.9 + NEST_SLUMP.amount, 12);
  });

  it('does not drain a nest that still has a living carrier', () => {
    const world = twoNests(0.4, 0.9);
    world.siltstitchers = [occupant(world, world.nests[0].id)];
    slumpUnusedNests(world);
    expect(world.nests[0].pigment).toBe(0.4);
    expect(world.nests[1].pigment).toBe(0.9);
  });

  it('leaves an occupied home out of the unused pool so color can gather at an empty nest', () => {
    const world = twoNests(1.2, 0.4, 12);
    world.siltstitchers = [occupant(world, world.nests[0].id)];
    world.nests.push({
      id: world.nextId++,
      x: OPENING_POOL.x,
      y: OPENING_POOL.y + 80,
      hue: 20,
      pigment: 0.3,
      age: 1,
    });
    slumpUnusedNests(world);
    expect(world.nests[0].pigment).toBe(1.2);
    expect(world.nests[1].pigment).toBeCloseTo(0.4 + NEST_SLUMP.amount, 12);
    expect(world.nests[2].pigment).toBeCloseTo(0.3 - NEST_SLUMP.amount, 12);
  });

  it('keeps inlet color in the inlet', () => {
    const world = twoNests(0.4, 0.9);
    world.nests[0].x = INLET_POOL.x;
    world.nests[0].y = INLET_POOL.y;
    slumpUnusedNests(world);
    expect(world.nests[0].pigment).toBe(0.4);
    expect(world.nests[1].pigment).toBe(0.9);
  });

  it('does not overfill a nest or touch the PRNG', () => {
    const world = twoNests(0.4, NEST_CAPACITY - 0.002);
    const rng = world.randomState;
    slumpUnusedNests(world);
    expect(world.randomState).toBe(rng);
    expect(world.nests[1].pigment).toBeCloseTo(NEST_CAPACITY, 12);
    expect(world.nests[0].pigment).toBeCloseTo(0.398, 12);
    expect(heldNestPigment(world)).toBeCloseTo(0.4 + NEST_CAPACITY - 0.002, 12);
  });

  it('concentrates spread color above the siltstitcher founding stake', () => {
    const world = twoNests(0.8, 1.0);
    world.organisms = [];
    world.lights = [];
    world.grazers = [];
    world.skimmers = [];
    world.nextFoundingTick = Number.MAX_SAFE_INTEGER - 12;
    world.siltstitcherAdmissionAt = 1e9;
    world.skimmerAdmissionAt = 1e9;
    world.seamAccrued = 0;
    world.ecologyLedger.seamDissolved = 24;
    const before = heldNestPigment(world);
    const rng = world.randomState;
    for (let i = 0; i < 30 * 90; i++) stepWorld(world);
    expect(world.randomState).toBe(rng);
    expect(heldNestPigment(world)).toBeLessThanOrEqual(before + 1e-9);
    expect(Math.max(...world.nests.map((nest) => nest.pigment))).toBeGreaterThanOrEqual(1.5);
  });

  it('names slump only while unused homes actually differ', () => {
    const world = twoNests(0.4, 0.9);
    expect(unusedNestsSlumping(world)).toBe(true);
    world.nests[0].pigment = 0.9;
    expect(unusedNestsSlumping(world)).toBe(false);
  });

  it('leaves schema 19 unchanged and grants nothing to a restored world', () => {
    const world = createWorld(3);
    expect(world.schemaRevision).toBe(SCHEMA_REVISION);
    expect(SCHEMA_REVISION).toBe(22);
    const restored = restoreWorld(serializeWorld(world));
    expect(restored).not.toBeNull();
    expect(restored!.schemaRevision).toBe(SCHEMA_REVISION);
    expect(restored!.nests.map((nest) => nest.pigment)).toEqual(world.nests.map((nest) => nest.pigment));
  });

  it('keeps ledgers balanced on a short harness run', () => {
    const report = runHarness({ days: 2, seed: 1, visitorLight: false });
    expect(report.conservationCheck.remainsBalanced).toBe(true);
    expect(report.conservationCheck.fossilsBalanced).toBe(true);
    expect(report.conservationCheck.seamBalanced).toBe(true);
  });
});

describe('unused nest slump determinism', () => {
  it('replays the same slump after serialize', () => {
    const world = twoNests(0.55, 0.8, 1200);
    const restored = restoreWorld(serializeWorld(world));
    expect(restored).not.toBeNull();
    for (let i = 0; i < 90; i++) {
      stepWorld(world);
      stepWorld(restored!);
    }
    expect(restored).toEqual(world);
  });
});
