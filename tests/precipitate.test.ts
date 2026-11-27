import { describe, expect, it } from 'vitest';
import { inDeep } from '../src/world/environment/depth';
import { PRECIPITATE, looseColorSettling, stillRegionAt } from '../src/world/environment/precipitate';
import { OPENING_POOL, SEA_POOL, syncTide, tideConnectedAt } from '../src/world/habitat';
import { createWorld, stepWorld } from '../src/world/simulation';
import { SCHEMA_REVISION, type Sediment } from '../src/world/types';
import { effectiveWeather } from '../src/world/weather';

function grain(world: ReturnType<typeof createWorld>, x: number, y: number, strength: number): Sediment {
  const entry: Sediment = {
    id: world.nextId++,
    x,
    y,
    radius: 6,
    hue: 40,
    strength,
    age: 0,
  };
  world.sediment.push(entry);
  return entry;
}

function pigment(world: { sediment: { strength: number }[] }): number {
  return world.sediment.reduce((sum, entry) => sum + entry.strength, 0);
}

describe('still-water precipitation', () => {
  it('opens with a zero ledger and does not gift pigment', () => {
    expect(SCHEMA_REVISION).toBe(22);
    const world = createWorld(7);
    expect(world.schemaRevision).toBe(SCHEMA_REVISION);
    expect(world.ecologyLedger.precipitatedPigment).toBe(0);
  });

  it('pours loose pigment onto a coarse grain in the cut-off pool without a gift', () => {
    const world = createWorld(3);
    world.elapsed = 270;
    world.tick = 5;
    syncTide(world.elapsed);
    expect(tideConnectedAt(world.elapsed)).toBe(false);
    expect(effectiveWeather(world).intensity).toBe(0);
    const fine = grain(world, OPENING_POOL.x, OPENING_POOL.y, 0.08);
    const coarse = grain(world, OPENING_POOL.x + 12, OPENING_POOL.y, 0.16);
    const held = pigment(world);
    const random = world.randomState;
    expect(stillRegionAt(world, fine.x, fine.y)).toBe('pool');
    expect(looseColorSettling(world)).toBe(true);
    for (let step = 0; step < 12; step++) stepWorld(world);
    expect(coarse.strength).toBeGreaterThan(0.16);
    expect(fine.strength).toBeLessThan(0.08);
    expect(world.ecologyLedger.precipitatedPigment).toBeGreaterThan(0);
    expect(world.ecologyLedger.precipitatedPigment).toBeLessThan(held);
    expect(world.randomState).toBe(random);
  });

  it('stays still during rain and while the mouth is open, except in the deep basin and the sea', () => {
    const raining = createWorld(5);
    raining.elapsed = 49;
    raining.tick = 2;
    syncTide(raining.elapsed);
    grain(raining, OPENING_POOL.x, OPENING_POOL.y, 0.08);
    grain(raining, OPENING_POOL.x + 10, OPENING_POOL.y, 0.16);
    expect(effectiveWeather(raining).intensity).toBeGreaterThan(0);
    expect(stillRegionAt(raining, OPENING_POOL.x, OPENING_POOL.y)).toBeNull();
    const high = createWorld(5);
    high.elapsed = 90;
    high.tick = 2;
    syncTide(high.elapsed);
    expect(tideConnectedAt(high.elapsed)).toBe(true);
    expect(stillRegionAt(high, OPENING_POOL.x, OPENING_POOL.y)).toBeNull();
    expect(inDeep(1090, 318)).toBe(true);
    expect(stillRegionAt(high, 1090, 318)).toBe('deep');
    expect(stillRegionAt(high, SEA_POOL.x, SEA_POOL.y - 40)).toBe('sea');
  });

  it('forms a new grain beside a packed dest only inside the sediment cap', () => {
    const world = createWorld(9);
    world.elapsed = 270;
    world.tick = 5;
    syncTide(world.elapsed);
    world.sediment = [];
    const packed = grain(world, OPENING_POOL.x + 20, OPENING_POOL.y, 1);
    const fine = grain(world, OPENING_POOL.x, OPENING_POOL.y, 0.08);
    const before = world.sediment.length;
    for (let step = 0; step < 12; step++) stepWorld(world);
    expect(world.sediment.length).toBeGreaterThan(before);
    expect(world.sediment.length).toBeLessThanOrEqual(600);
    expect(packed.strength).toBeGreaterThan(1 - PRECIPITATE.amount);
    expect(fine.strength).toBeLessThan(0.08);
    expect(world.ecologyLedger.precipitatedPigment).toBeGreaterThan(0);
  });
});
