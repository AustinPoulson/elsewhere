import { describe, expect, it } from 'vitest';
import { runHarness } from '../scripts/harness';
import { DEEP_BASIN } from '../src/world/environment/depth';
import {
  PRECIPITATION,
  describePrecipitationChange,
  heldSedimentPigment,
  inStillWater,
  looseColorSettling,
  precipitateLooseColor,
} from '../src/world/environment/precipitation';
import { OPENING_POOL, SEA_POOL, mouthSegment, syncTide, tideConnectedAt } from '../src/world/habitat';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { createWorld, stepWorld } from '../src/world/simulation';
import { MIN_SEDIMENT_GRAIN } from '../src/world/species/resources';
import { LIMITS, SCHEMA_REVISION, type World } from '../src/world/types';

function pigment(world: World): number {
  return heldSedimentPigment(world) + world.ecologyLedger.mineralizedPigment;
}

function stillShore(world: World): void {
  world.elapsed = 270;
  world.tick = 5;
  world.weatherCall = { startedAt: null, nextAllowedAt: 0 };
  syncTide(world.elapsed);
}

describe('loose color precipitation', () => {
  it('pours still-water fines onto the nearest underfilled coarse grain without granting pigment', () => {
    const world = createWorld(1);
    stillShore(world);
    expect(tideConnectedAt(world.elapsed)).toBe(false);
    world.sediment = [
      { id: 1, x: OPENING_POOL.x - 20, y: OPENING_POOL.y, radius: 6, hue: 40, strength: 0.08, age: 0 },
      { id: 2, x: OPENING_POOL.x + 20, y: OPENING_POOL.y, radius: 6, hue: 80, strength: 0.2, age: 0 },
    ];
    const before = pigment(world);
    const rng = world.randomState;
    precipitateLooseColor(world);
    expect(world.randomState).toBe(rng);
    expect(pigment(world)).toBeCloseTo(before, 12);
    expect(world.sediment[0].strength).toBeCloseTo(0.08 - PRECIPITATION.amount, 12);
    expect(world.sediment[1].strength).toBeCloseTo(0.2 + PRECIPITATION.amount, 12);
    expect(world.ecologyLedger.precipitated).toBeCloseTo(PRECIPITATION.amount, 12);
  });

  it('forms a new grain only within the existing grain cap', () => {
    const world = createWorld(1);
    stillShore(world);
    world.sediment = [{ id: 1, x: OPENING_POOL.x, y: OPENING_POOL.y, radius: 6, hue: 40, strength: 0.08, age: 0 }];
    const before = pigment(world);
    const nextId = world.nextId;
    precipitateLooseColor(world);
    expect(pigment(world)).toBeCloseTo(before, 12);
    expect(world.sediment.length).toBe(2);
    expect(world.nextId).toBe(nextId + 1);
    expect(world.ecologyLedger.precipitated).toBeGreaterThanOrEqual(MIN_SEDIMENT_GRAIN);
    world.sediment = Array.from({ length: LIMITS.sediment }, (_, index) => ({
      id: index + 1,
      x: OPENING_POOL.x,
      y: OPENING_POOL.y,
      radius: 6,
      hue: 40,
      strength: index === 0 ? 0.08 : 1,
      age: 0,
    }));
    world.tick = 5;
    world.ecologyLedger.precipitated = 0;
    world.nextId = LIMITS.sediment + 2;
    precipitateLooseColor(world);
    expect(world.sediment).toHaveLength(LIMITS.sediment);
    expect(world.ecologyLedger.precipitated).toBe(0);
  });

  it('stays still in the deep basin and in the sea away from the mouth, not in rain or an open mouth', () => {
    const world = createWorld(1);
    world.weatherCall = { startedAt: null, nextAllowedAt: 0 };
    world.elapsed = 270;
    syncTide(world.elapsed);
    expect(inStillWater(world, OPENING_POOL.x, OPENING_POOL.y)).toBe(true);
    expect(inStillWater(world, DEEP_BASIN.x, DEEP_BASIN.y)).toBe(true);
    expect(inStillWater(world, SEA_POOL.x, SEA_POOL.y)).toBe(true);
    const link = mouthSegment();
    expect(inStillWater(world, (link.ax + link.bx) / 2, (link.ay + link.by) / 2)).toBe(false);
    world.elapsed = 90;
    syncTide(world.elapsed);
    expect(tideConnectedAt(world.elapsed)).toBe(true);
    expect(inStillWater(world, OPENING_POOL.x, OPENING_POOL.y)).toBe(false);
    expect(inStillWater(world, DEEP_BASIN.x, DEEP_BASIN.y)).toBe(true);
    expect(inStillWater(world, SEA_POOL.x, SEA_POOL.y)).toBe(true);
    world.elapsed = 220;
    syncTide(world.elapsed);
    expect(inStillWater(world, OPENING_POOL.x, OPENING_POOL.y)).toBe(false);
    expect(inStillWater(world, DEEP_BASIN.x, DEEP_BASIN.y)).toBe(true);
    expect(inStillWater(world, SEA_POOL.x, SEA_POOL.y)).toBe(false);
  });

  it('does not draw the PRNG during a live step', () => {
    const world = createWorld(1);
    stillShore(world);
    world.sediment = [
      { id: 1, x: OPENING_POOL.x - 12, y: OPENING_POOL.y, radius: 6, hue: 24, strength: 0.07, age: 0 },
      { id: 2, x: OPENING_POOL.x + 12, y: OPENING_POOL.y, radius: 6, hue: 48, strength: 0.18, age: 0 },
    ];
    world.tick = 4;
    const rng = world.randomState;
    stepWorld(world);
    expect(world.tick % 6).toBe(5);
    expect(world.randomState).toBe(rng);
  });

  it('names settling while loose color can actually precipitate', () => {
    const world = createWorld(1);
    stillShore(world);
    world.sediment = [
      { id: 1, x: OPENING_POOL.x - 10, y: OPENING_POOL.y, radius: 6, hue: 40, strength: 0.06, age: 0 },
      { id: 2, x: OPENING_POOL.x + 10, y: OPENING_POOL.y, radius: 6, hue: 80, strength: 0.22, age: 0 },
    ];
    expect(looseColorSettling(world)).toBe(true);
    expect(describePrecipitationChange(0, 0.25)).toBe('Loose color settled into grains.');
    expect(describePrecipitationChange(0.1, 0.11)).toBeNull();
    world.sediment = [];
    expect(looseColorSettling(world)).toBe(false);
  });

  it('keeps ledgers balanced on a short harness run', () => {
    const report = runHarness({ days: 2, seed: 1, visitorLight: false });
    expect(report.conservationCheck.remainsBalanced).toBe(true);
    expect(report.conservationCheck.fossilsBalanced).toBe(true);
    expect(report.conservationCheck.seamBalanced).toBe(true);
    expect(report.conservationCheck.tidePartitioned).toBe(true);
    expect(report.conservationCheck.precipitationBalanced).toBe(true);
    expect(report.ledger.precipitated).toBeGreaterThan(0);
  });
});

describe('precipitation determinism', () => {
  it('replays the same pour after serialize', () => {
    const world = createWorld(1);
    stillShore(world);
    world.sediment = [
      { id: world.nextId++, x: OPENING_POOL.x - 16, y: OPENING_POOL.y, radius: 6, hue: 30, strength: 0.09, age: 0 },
      { id: world.nextId++, x: OPENING_POOL.x + 16, y: OPENING_POOL.y, radius: 6, hue: 70, strength: 0.16, age: 0 },
    ];
    const restored = restoreWorld(serializeWorld(world));
    expect(restored).not.toBeNull();
    for (let i = 0; i < 90; i++) {
      stepWorld(world);
      stepWorld(restored!);
    }
    expect(restored).toEqual(world);
    expect(world.schemaRevision).toBe(SCHEMA_REVISION);
  });
});
