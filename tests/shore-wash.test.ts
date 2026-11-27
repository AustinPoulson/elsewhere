import { describe, expect, it } from 'vitest';
import { applyCurrentDrift } from '../src/world/currents';
import { compactShoreResources, SHORE_WASH, shoreWashVelocity } from '../src/world/environment/shore-wash';
import { OPENING_POOL } from '../src/world/habitat';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { createWorld, stepWorld } from '../src/world/simulation';
import { MIN_SEDIMENT_GRAIN } from '../src/world/species/resources';
import { FIXED_STEP, SCHEMA_REVISION } from '../src/world/types';
import { runHarness } from '../scripts/harness';

function pigment(world: { sediment: { strength: number }[]; remains: { pigment: number }[] }): number {
  return (
    world.sediment.reduce((sum, grain) => sum + grain.strength, 0) +
    world.remains.reduce((sum, remain) => sum + remain.pigment, 0)
  );
}

describe('rain shore wash', () => {
  it('pushes interior color toward the shore and stays still in calm', () => {
    const point = { x: OPENING_POOL.x + 80, y: OPENING_POOL.y };
    const calm = shoreWashVelocity(point, 0);
    expect(calm.x).toBe(0);
    expect(calm.y).toBe(0);
    const rain = shoreWashVelocity(point, 1);
    expect(rain.x).toBeGreaterThan(0);
    expect(rain.y).toBeCloseTo(0, 6);
    const rng = createWorld(1).randomState;
    const again = shoreWashVelocity(point, 1);
    expect(again).toEqual(rain);
    expect(createWorld(1).randomState).toBe(rng);
  });

  it('compacts nearby shore grains into a coarser payment without granting pigment', () => {
    const world = createWorld(1);
    world.elapsed = 40;
    world.tick = 6;
    world.sediment = [
      { id: 1, x: 1180, y: 500, radius: 6, hue: 40, strength: 0.08, age: 0 },
      { id: 2, x: 1188, y: 500, radius: 6, hue: 80, strength: 0.08, age: 0 },
    ];
    const before = pigment(world);
    const rng = world.randomState;
    compactShoreResources(world);
    expect(world.randomState).toBe(rng);
    expect(pigment(world)).toBeCloseTo(before, 9);
    const strongest = Math.max(...world.sediment.map((grain) => grain.strength));
    expect(strongest).toBeGreaterThan(0.08);
    expect(strongest).toBeCloseTo(0.08 + SHORE_WASH.compactAmount, 6);
  });

  it('compacts remain fragments without creating pigment', () => {
    const world = createWorld(1);
    world.elapsed = 40;
    world.tick = 12;
    world.sediment = [];
    world.remains = [
      {
        id: 11,
        species: 'remain',
        source: 'skimmer',
        x: 1180,
        y: 500,
        pigment: 0.12,
        hue: 20,
        age: 1,
        radius: 5,
      },
      {
        id: 12,
        species: 'remain',
        source: 'skimmer',
        x: 1186,
        y: 500,
        pigment: 0.12,
        hue: 40,
        age: 1,
        radius: 5,
      },
    ];
    const before = pigment(world);
    compactShoreResources(world);
    expect(pigment(world)).toBeCloseTo(before, 9);
    expect(Math.max(...world.remains.map((remain) => remain.pigment))).toBeGreaterThan(0.12);
  });

  it('re-sorts interior fines onto the shore as a coarser grain during one shower', () => {
    const world = createWorld(1);
    world.elapsed = 30;
    world.tick = 900;
    world.organisms = [];
    world.lights = [];
    world.grazers = [];
    world.nests = [];
    world.seamAccrued = 0;
    world.ecologyLedger.seamDissolved = 24;
    world.sediment = [
      { id: 21, x: 800, y: 500, radius: 6, hue: 30, strength: 0.08, age: 0 },
      { id: 22, x: 808, y: 500, radius: 6, hue: 40, strength: 0.08, age: 0 },
      { id: 23, x: 816, y: 500, radius: 6, hue: 50, strength: 0.08, age: 0 },
      { id: 24, x: 824, y: 500, radius: 6, hue: 60, strength: 0.08, age: 0 },
    ];
    const before = pigment(world);
    const rng = world.randomState;
    for (let i = 0; i < 40 * 30; i++) stepWorld(world);
    expect(world.randomState).toBe(rng);
    expect(pigment(world)).toBeLessThanOrEqual(before + 1e-9);
    expect(Math.max(...world.sediment.map((grain) => grain.x))).toBeGreaterThan(824);
    expect(Math.max(...world.sediment.map((grain) => grain.strength))).toBeGreaterThan(0.08);
  });

  it('leaves a grain inside a paid current to that current', () => {
    const world = createWorld(7);
    world.elapsed = 40;
    world.sediment = [{ id: world.nextId++, x: 800, y: 500, radius: 6, hue: 90, strength: 0.08, age: 0 }];
    world.currents = [{ id: world.nextId++, x: 800, y: 500, dx: -1, dy: 0, radius: 110, startedAt: 40, duration: 8 }];
    const grain = world.sediment[0];
    const startX = grain.x;
    applyCurrentDrift(world, FIXED_STEP);
    expect(grain.x).toBeLessThan(startX);
  });

  it('washes an interior grain outward during rain without touching the PRNG', () => {
    const world = createWorld(7);
    world.elapsed = 40;
    world.sediment = [{ id: world.nextId++, x: 800, y: 500, radius: 6, hue: 90, strength: 0.08, age: 0 }];
    const grain = world.sediment[0];
    const startX = grain.x;
    const rng = world.randomState;
    applyCurrentDrift(world, FIXED_STEP);
    expect(world.randomState).toBe(rng);
    expect(grain.x).toBeGreaterThan(startX);
  });

  it('does not drop compacted leftovers below the surviving grain floor as a gift', () => {
    const world = createWorld(1);
    world.elapsed = 40;
    world.tick = 6;
    world.sediment = [
      { id: 1, x: 1180, y: 500, radius: 6, hue: 10, strength: 0.99, age: 0 },
      { id: 2, x: 1184, y: 500, radius: 6, hue: 10, strength: MIN_SEDIMENT_GRAIN, age: 0 },
    ];
    const before = pigment(world);
    compactShoreResources(world);
    expect(pigment(world)).toBeCloseTo(before, 9);
  });

  it('leaves schema 19 unchanged and grants nothing to a restored world', () => {
    const world = createWorld(3);
    expect(world.schemaRevision).toBe(SCHEMA_REVISION);
    expect(SCHEMA_REVISION).toBe(22);
    const restored = restoreWorld(serializeWorld(world));
    expect(restored).not.toBeNull();
    expect(restored!.schemaRevision).toBe(SCHEMA_REVISION);
    expect(restored!.organisms.length).toBe(world.organisms.length);
    expect(restored!.sediment.length).toBe(world.sediment.length);
    expect(pigment(restored!)).toBeCloseTo(pigment(world), 9);
  });

  it('keeps ledgers balanced on a short harness run', () => {
    const report = runHarness({ days: 2, seed: 1, visitorLight: false });
    expect(report.conservationCheck.remainsBalanced).toBe(true);
    expect(report.conservationCheck.fossilsBalanced).toBe(true);
    expect(report.conservationCheck.seamBalanced).toBe(true);
  });
});

describe('rain shore wash determinism', () => {
  it('replays the same rain sort after serialize', () => {
    const world = createWorld(11);
    world.elapsed = 40;
    world.tick = 1200;
    world.sediment.push({ id: world.nextId++, x: 760, y: 520, radius: 6, hue: 70, strength: 0.11, age: 0 });
    const restored = restoreWorld(serializeWorld(world));
    expect(restored).not.toBeNull();
    for (let i = 0; i < 90; i++) {
      stepWorld(world);
      stepWorld(restored!);
    }
    expect(restored).toEqual(world);
  });
});
