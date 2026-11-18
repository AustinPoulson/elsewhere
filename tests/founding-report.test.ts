import { describe, expect, it } from 'vitest';
import { createWorld, stepWorld } from '../src/world/simulation';
import { runNormalFounding } from '../src/world/species/founding';
import { probeFoundingStock, watchFounding } from '../src/world/species/founding-report';
import { SPECIES_CATALOG } from '../src/world/species/catalog';
import { FIXED_STEP } from '../src/world/types';

describe('founding report', () => {
  it('counts rotation polls without changing paid ecology or the PRNG', () => {
    const world = createWorld(26);
    const census = watchFounding(world);
    const random = world.randomState;
    const pigment = world.sediment.reduce((sum, grain) => sum + grain.strength, 0);
    world.tick = 6;
    expect(runNormalFounding(world)).toBe(false);
    expect(census.skimmer.polls).toBe(1);
    expect(census.skimmer.noResource).toBe(1);
    expect(world.randomState).toBe(random);
    expect(world.sediment.reduce((sum, grain) => sum + grain.strength, 0)).toBeCloseTo(pigment, 9);
  });

  it('names coarse shore grains, payable remains, and rich nests from real stock', () => {
    const world = createWorld(1);
    world.sediment = [
      { id: 1, x: 1180, y: 500, radius: 6, hue: 40, strength: 0.2, age: 0 },
      { id: 2, x: 720, y: 500, radius: 6, hue: 40, strength: 0.2, age: 0 },
    ];
    world.remains = [
      {
        id: 3,
        species: 'remain',
        source: 'skimmer',
        x: 720,
        y: 500,
        pigment: SPECIES_CATALOG.marlgrub.admissionPigment,
        hue: 40,
        age: 0,
        radius: 6,
      },
    ];
    world.nests[0].pigment = SPECIES_CATALOG.siltstitcher.admissionThreshold;
    const stock = probeFoundingStock(world);
    expect(stock.coarseShore).toBeGreaterThanOrEqual(1);
    expect(stock.coarseAnywhere).toBe(2);
    expect(stock.payableRemains).toBe(1);
    expect(stock.richNests).toBe(1);
  });

  it('does not spend pigment when the harness is only watching', () => {
    const watched = createWorld(1);
    const quiet = createWorld(1);
    watchFounding(watched);
    for (let i = 0; i < 180; i++) {
      stepWorld(watched, FIXED_STEP);
      stepWorld(quiet, FIXED_STEP);
    }
    expect(watched.randomState).toBe(quiet.randomState);
    expect(watched.ecologyLedger).toEqual(quiet.ecologyLedger);
    expect(watched.glassLimpets.length).toBe(quiet.glassLimpets.length);
  });
});
