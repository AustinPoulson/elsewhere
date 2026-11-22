import { describe, expect, it } from 'vitest';
import { INLET_POOL, OPENING_POOL } from '../src/world/habitat';
import { SHORE_SLUMP, slumpUnusedShoreGrains, unusedShoreGrainsSlumping } from '../src/world/environment/shore-slump';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { createWorld, stepWorld } from '../src/world/simulation';
import { SPECIES_CATALOG } from '../src/world/species/catalog';
import { MIN_SEDIMENT_GRAIN } from '../src/world/species/resources';
import { baselineTraits } from '../src/world/traits';
import { SCHEMA_REVISION, type GlassLimpet, type World } from '../src/world/types';
import { runHarness } from '../scripts/harness';

function pigment(world: { sediment: { strength: number }[] }): number {
  return world.sediment.reduce((sum, grain) => sum + grain.strength, 0);
}

function shoreGrain(world: World, x: number, y: number, strength: number, hue = 40) {
  return { id: world.nextId++, x, y, radius: 6, hue, strength, age: 0 };
}

function shell(world: World, x: number, y: number): GlassLimpet {
  return {
    id: world.nextId++,
    species: 'glassLimpet',
    x,
    y,
    body: 0.2,
    reserve: 0.1,
    cargo: 0,
    age: 10,
    hue: 40,
    starvedFor: 0,
    targetSedimentId: null,
    parentId: null,
    nextBirthAt: 100,
    traits: baselineTraits(),
  };
}

function twoGrains(a: number, b: number, tick = 12): World {
  const world = createWorld(1);
  world.elapsed = 40;
  world.tick = tick;
  world.grazers = [];
  world.skimmers = [];
  world.siltstitchers = [];
  world.glassLimpets = [];
  world.cargoMites = [];
  world.marlgrubs = [];
  world.sediment = [
    shoreGrain(world, OPENING_POOL.x + 480, OPENING_POOL.y, a, 40),
    shoreGrain(world, OPENING_POOL.x + 480, OPENING_POOL.y + 40, b, 80),
  ];
  return world;
}

describe('unused shore grain slump', () => {
  it('pours unused color toward the fuller shore grain without granting pigment', () => {
    const world = twoGrains(0.08, 0.14);
    const before = pigment(world);
    const rng = world.randomState;
    slumpUnusedShoreGrains(world);
    expect(world.randomState).toBe(rng);
    expect(pigment(world)).toBeCloseTo(before, 12);
    expect(world.sediment[0].strength).toBeCloseTo(0.08 - SHORE_SLUMP.amount, 12);
    expect(world.sediment[1].strength).toBeCloseTo(0.14 + SHORE_SLUMP.amount, 12);
  });

  it('does not drain a grain a stocking shell can already reach', () => {
    const world = twoGrains(0.08, 0.14);
    world.glassLimpets = [shell(world, world.sediment[0].x, world.sediment[0].y)];
    slumpUnusedShoreGrains(world);
    expect(world.sediment[0].strength).toBe(0.08);
    expect(world.sediment[1].strength).toBe(0.14);
  });

  it('leaves a held grain out of the unused pool so color can gather at an empty pocket', () => {
    const world = twoGrains(0.16, 0.08, 12);
    world.glassLimpets = [shell(world, world.sediment[0].x, world.sediment[0].y)];
    world.sediment[1].x = OPENING_POOL.x - 480;
    world.sediment[1].y = OPENING_POOL.y;
    world.sediment.push(shoreGrain(world, OPENING_POOL.x - 480, OPENING_POOL.y + 40, 0.06, 20));
    slumpUnusedShoreGrains(world);
    expect(world.sediment[0].strength).toBe(0.16);
    expect(world.sediment[1].strength).toBeCloseTo(0.08 + SHORE_SLUMP.amount, 12);
    expect(world.sediment[2].strength).toBeCloseTo(0.06 - SHORE_SLUMP.amount, 12);
  });

  it('keeps inlet color in the inlet', () => {
    const world = twoGrains(0.08, 0.14);
    world.sediment[0].x = INLET_POOL.x + 180;
    world.sediment[0].y = INLET_POOL.y;
    slumpUnusedShoreGrains(world);
    expect(world.sediment[0].strength).toBe(0.08);
    expect(world.sediment[1].strength).toBe(0.14);
  });

  it('leaves interior grains on the interior floor', () => {
    const world = twoGrains(0.08, 0.14);
    world.sediment[0].x = OPENING_POOL.x;
    world.sediment[0].y = OPENING_POOL.y;
    slumpUnusedShoreGrains(world);
    expect(world.sediment[0].strength).toBe(0.08);
    expect(world.sediment[1].strength).toBe(0.14);
  });

  it('merges leftovers below the surviving grain floor into the dest', () => {
    const world = twoGrains(MIN_SEDIMENT_GRAIN + 0.001, 0.14);
    const before = pigment(world);
    slumpUnusedShoreGrains(world);
    expect(pigment(world)).toBeCloseTo(before, 12);
    expect(world.sediment[0].strength).toBe(0);
    expect(world.sediment[1].strength).toBeCloseTo(before, 12);
  });

  it('does not overfill a grain or touch the PRNG', () => {
    const world = twoGrains(0.08, SHORE_SLUMP.capacity - 0.002);
    const rng = world.randomState;
    slumpUnusedShoreGrains(world);
    expect(world.randomState).toBe(rng);
    expect(world.sediment[1].strength).toBeCloseTo(SHORE_SLUMP.capacity, 12);
    expect(world.sediment[0].strength).toBeCloseTo(0.078, 12);
    expect(pigment(world)).toBeCloseTo(0.08 + SHORE_SLUMP.capacity - 0.002, 12);
  });

  it('concentrates spread shore dust above the glass limpet founding stake', () => {
    const world = twoGrains(0.14, 0.18);
    world.organisms = [];
    world.lights = [];
    world.grazers = [];
    world.skimmers = [];
    world.nextFoundingTick = Number.MAX_SAFE_INTEGER - 12;
    world.glassLimpetAdmissionAt = 1e9;
    world.skimmerAdmissionAt = 1e9;
    world.siltstitcherAdmissionAt = 1e9;
    world.marlgrubAdmissionAt = 1e9;
    world.seamAccrued = 0;
    world.ecologyLedger.seamDissolved = 24;
    const before = pigment(world);
    const rng = world.randomState;
    for (let i = 0; i < 20 * 30; i++) stepWorld(world);
    expect(world.randomState).toBe(rng);
    expect(world.glassLimpets).toHaveLength(0);
    expect(pigment(world)).toBeLessThanOrEqual(before + 1e-9);
    expect(Math.max(...world.sediment.map((grain) => grain.strength), 0)).toBeGreaterThanOrEqual(
      SPECIES_CATALOG.glassLimpet.admissionPigment,
    );
  });

  it('names slump only while unused shore grains actually differ', () => {
    const world = twoGrains(0.08, 0.14);
    expect(unusedShoreGrainsSlumping(world)).toBe(true);
    world.sediment[0].strength = 0.14;
    expect(unusedShoreGrainsSlumping(world)).toBe(false);
  });

  it('leaves schema 19 unchanged and grants nothing to a restored world', () => {
    const world = createWorld(3);
    expect(world.schemaRevision).toBe(SCHEMA_REVISION);
    expect(SCHEMA_REVISION).toBe(19);
    const restored = restoreWorld(serializeWorld(world));
    expect(restored).not.toBeNull();
    expect(restored!.schemaRevision).toBe(19);
    expect(pigment(restored!)).toBeCloseTo(pigment(world), 9);
    expect(restored!.glassLimpets).toEqual(world.glassLimpets);
  });

  it('keeps ledgers balanced on a short harness run', () => {
    const report = runHarness({ days: 2, seed: 1, visitorLight: false });
    expect(report.conservationCheck.remainsBalanced).toBe(true);
    expect(report.conservationCheck.fossilsBalanced).toBe(true);
    expect(report.conservationCheck.seamBalanced).toBe(true);
    expect(report.founding.glassLimpet.polls).toBeGreaterThan(0);
  });
});

describe('unused shore grain slump determinism', () => {
  it('replays the same slump after serialize', () => {
    const world = twoGrains(0.09, 0.13, 1200);
    const restored = restoreWorld(serializeWorld(world));
    expect(restored).not.toBeNull();
    for (let i = 0; i < 90; i++) {
      stepWorld(world);
      stepWorld(restored!);
    }
    expect(restored).toEqual(world);
  });
});
