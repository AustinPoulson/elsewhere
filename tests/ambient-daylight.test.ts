import { describe, expect, it } from 'vitest';
import { ambientOffer, daylight } from '../src/world/environment/daylight';
import { createWorld, getStats, stepWorld } from '../src/world/simulation';
import { FIXED_STEP } from '../src/world/types';

describe('faint ambient daylight', () => {
  it('feeds lucents during day without visitor lights and rests at night', () => {
    const world = createWorld(1);
    world.lights = [];
    world.sediment = [];
    expect(daylight(world)).toBeGreaterThan(0);
    for (let i = 0; i < 30 * 180; i++) stepWorld(world);
    expect(world.ecologyLedger.ambientHarvested).toBeGreaterThan(1);
    expect(world.consumed).toBe(0);
    expect(getStats(world).pigment).toBeGreaterThan(0);
    expect(world.organisms).toHaveLength(24);

    const night = createWorld(1);
    night.elapsed = 180;
    night.lights = [];
    const before = night.ecologyLedger.ambientHarvested;
    expect(daylight(night)).toBe(0);
    expect(ambientOffer(night, FIXED_STEP)).toBe(0);
    stepWorld(night);
    expect(night.ecologyLedger.ambientHarvested).toBe(before);
  });

  it('stays weaker than a visitor light while still converting daylight into pigment', () => {
    const ambient = createWorld(1);
    ambient.lights = [];
    const visited = createWorld(1);
    for (let i = 0; i < 30 * 20; i++) {
      stepWorld(ambient);
      stepWorld(visited);
    }
    expect(visited.consumed).toBeGreaterThan(ambient.ecologyLedger.ambientHarvested);
    expect(ambient.ecologyLedger.ambientHarvested).toBeGreaterThan(0);
  });
});
