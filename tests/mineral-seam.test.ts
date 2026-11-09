import { describe, expect, it } from 'vitest';
import { catchUpWorld, composeJournal, planCatchUp } from '../src/world/catchup';
import {
  MINERAL_SEAM,
  describeSeamChange,
  dissolveMineralSeam,
  pigmentNearSeam,
  seamRemaining,
} from '../src/world/environment/mineral-seam';
import { inOpeningPool } from '../src/world/habitat';
import { serializeWorld } from '../src/world/persistence';
import { createWorld, getStats, stepWorld } from '../src/world/simulation';
import { MIN_SEDIMENT_GRAIN } from '../src/world/species/resources';
import { FIXED_STEP } from '../src/world/types';
import { callRain } from '../src/world/weather';
import { parseHarnessArgs, runHarness } from '../scripts/harness';
import type { CatchUpEvents, ResourceSnapshot } from '../src/world/catchup';

function idleEvents(): CatchUpEvents {
  return {
    lucents: { births: 0, deaths: 0, extinctAt: null },
    grazers: { births: 0, deaths: 0, extinctAt: null },
    skimmers: { births: 0, deaths: 0, extinctAt: null },
    reedwells: { births: 0, deaths: 0, extinctAt: null },
    rainbells: { births: 0, deaths: 0, extinctAt: null },
    siltstitchers: { births: 0, deaths: 0, extinctAt: null },
    glassLimpets: { births: 0, deaths: 0, extinctAt: null },
    cargoMites: { births: 0, deaths: 0, extinctAt: null },
    marlgrubs: { births: 0, deaths: 0, extinctAt: null },
  };
}

const quietResources: ResourceSnapshot = {
  loosePigment: 1,
  nestedPigment: 1,
  remainPigment: 0,
  fossilPigment: 0,
  fossils: 0,
  seamRemaining: MINERAL_SEAM.capacity,
  seamDissolved: 0,
};

describe('mineral seam physics', () => {
  it('places a finite vein in the opening pool sediment', () => {
    expect(MINERAL_SEAM.capacity).toBe(24);
    expect(MINERAL_SEAM.rate).toBe(0.00072);
    expect(MINERAL_SEAM.grain).toBeGreaterThanOrEqual(MIN_SEDIMENT_GRAIN);
    expect(inOpeningPool(MINERAL_SEAM.x, MINERAL_SEAM.y)).toBe(true);
    expect(inOpeningPool(MINERAL_SEAM.ax, MINERAL_SEAM.ay)).toBe(true);
    expect(inOpeningPool(MINERAL_SEAM.bx, MINERAL_SEAM.by)).toBe(true);
    const world = createWorld(1);
    expect(world.seamAccrued).toBe(0);
    expect(world.ecologyLedger.seamDissolved).toBe(0);
    expect(seamRemaining(world)).toBe(MINERAL_SEAM.capacity);
    expect(pigmentNearSeam(world)).toBe(0);
    expect(getStats(world).seamRemaining).toBe(MINERAL_SEAM.capacity);
  });

  it('leaches located pigment from elapsed time without spending the PRNG', () => {
    const world = createWorld(7);
    const rng = world.randomState;
    const nextId = world.nextId;
    const steps = Math.ceil(90 / FIXED_STEP);
    for (let step = 0; step < steps; step++) {
      world.elapsed += FIXED_STEP;
      world.tick++;
      dissolveMineralSeam(world, FIXED_STEP);
    }
    expect(world.randomState).toBe(rng);
    expect(world.ecologyLedger.seamDissolved).toBeGreaterThan(0);
    expect(world.ecologyLedger.seamDissolved).toBeLessThan(
      MINERAL_SEAM.rate * (1 + MINERAL_SEAM.rainBonus) * 90 + 1e-9,
    );
    expect(seamRemaining(world) + world.seamAccrued + world.ecologyLedger.seamDissolved).toBeCloseTo(
      MINERAL_SEAM.capacity,
      10,
    );
    expect(pigmentNearSeam(world)).toBeGreaterThan(0);
    expect(world.nextId).toBeGreaterThan(nextId);
  });

  it('leaches faster in rain and still balances the vein', () => {
    const dry = createWorld(11);
    const wet = createWorld(11);
    callRain(wet);
    const steps = Math.ceil(20 / FIXED_STEP);
    for (let step = 0; step < steps; step++) {
      stepWorld(dry);
      stepWorld(wet);
    }
    expect(seamRemaining(wet)).toBeLessThan(seamRemaining(dry));
    expect(seamRemaining(wet) + wet.seamAccrued + wet.ecologyLedger.seamDissolved).toBeCloseTo(
      MINERAL_SEAM.capacity,
      10,
    );
  });

  it('stops when the vein is spent and keeps extinction possible', () => {
    const world = createWorld(3);
    world.ecologyLedger.seamDissolved = MINERAL_SEAM.capacity;
    const pigment = world.sediment.reduce((total, grain) => total + grain.strength, 0);
    const rng = world.randomState;
    dissolveMineralSeam(world, FIXED_STEP);
    stepWorld(world);
    expect(world.ecologyLedger.seamDissolved).toBe(MINERAL_SEAM.capacity);
    expect(world.seamAccrued).toBe(0);
    expect(seamRemaining(world)).toBe(0);
    expect(world.randomState).toBe(rng);
    expect(world.sediment.reduce((total, grain) => total + grain.strength, 0)).toBeLessThanOrEqual(pigment + 1e-9);
  });

  it('names a seam change in the while-you-were-gone journal', () => {
    expect(describeSeamChange(24, 20, 4)).toBe('A mineral seam leaked more color into the floor.');
    expect(describeSeamChange(0.1, 0, 0.1)).toBe('The mineral seam ran out.');
    expect(describeSeamChange(24, 23.9, 0.1)).toBeNull();
    const hour = composeJournal(
      { reason: 'ready', awaySeconds: 3600, simulateSeconds: 3600, sleptSeconds: 0 },
      idleEvents(),
      quietResources,
      { ...quietResources, seamRemaining: 20, seamDissolved: 4 },
      3600,
    );
    expect(hour.lines).toContain('A mineral seam leaked more color into the floor.');
  });

  it('matches a live step loop during catch-up', () => {
    const seconds = 120;
    const plan = planCatchUp(0, seconds * 1000);
    const caught = createWorld(1);
    const live = createWorld(1);
    const report = catchUpWorld(caught, plan);
    const steps = Math.ceil(seconds / FIXED_STEP);
    for (let i = 0; i < steps; i++) stepWorld(live);
    expect(report.steps).toBe(steps);
    expect(serializeWorld(caught)).toBe(serializeWorld(live));
    expect(caught.ecologyLedger.seamDissolved + caught.seamAccrued).toBeGreaterThan(0);
  });

  it('lets the harness see the same seam as stepped elapsed time', () => {
    expect(parseHarnessArgs(['--days', '1', '--seed', '1']).days).toBe(1);
    const report = runHarness({ days: 1, seed: 1, visitorLight: false });
    expect(report.conservationCheck.seamBalanced).toBe(true);
    expect(report.resources.seamDissolved).toBeGreaterThan(0);
    expect(report.resources.seamRemaining).toBeLessThan(MINERAL_SEAM.capacity);
    const caught = createWorld(1);
    catchUpWorld(caught, planCatchUp(0, 360 * 1000));
    expect(caught.elapsed).toBeCloseTo(report.worldSeconds, 5);
    expect(serializeWorld(caught)).toBe(
      serializeWorld(
        (() => {
          const live = createWorld(1);
          const steps = Math.ceil(360 / FIXED_STEP);
          for (let i = 0; i < steps; i++) stepWorld(live);
          return live;
        })(),
      ),
    );
  }, 20_000);
});
