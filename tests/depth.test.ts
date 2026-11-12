import { describe, expect, it } from 'vitest';
import { catchUpWorld, composeJournal, planCatchUp } from '../src/world/catchup';
import {
  DEEP_BASIN,
  deepBasinInOpeningPool,
  depthAt,
  describeDeepChange,
  inDeep,
  lightScale,
  pigmentInDeep,
  rainScale,
  remainsInDeep,
  settleVelocity,
  stillScale,
} from '../src/world/environment/depth';
import { inOpeningPool, OPENING_POOL } from '../src/world/habitat';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { createWorld, getStats, SPRINGS, stepWorld } from '../src/world/simulation';
import { applyCurrentDrift } from '../src/world/currents';
import { withoutAwayMemory } from '../src/world/traces';
import { SCHEMA_REVISION, FIXED_STEP } from '../src/world/types';
import { CALM_LIGHT_REACH, lightReachAt, rainIntensityAt } from '../src/world/weather';
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
  seamRemaining: 24,
  seamDissolved: 0,
  deepPigment: 0,
};

describe('deeper basin physics', () => {
  it('places a deep basin in northeastern opening-pool water', () => {
    expect(deepBasinInOpeningPool()).toBe(true);
    expect(inOpeningPool(DEEP_BASIN.x, DEEP_BASIN.y)).toBe(true);
    expect(depthAt(DEEP_BASIN.x, DEEP_BASIN.y)).toBe(1);
    expect(depthAt(OPENING_POOL.x, OPENING_POOL.y)).toBe(0);
    expect(inDeep(DEEP_BASIN.x + DEEP_BASIN.rx + 1, DEEP_BASIN.y)).toBe(false);
    for (const spring of SPRINGS) expect(inDeep(spring.x, spring.y)).toBe(false);
    expect(lightScale(1)).toBeCloseTo(1 - DEEP_BASIN.lightLoss, 10);
    expect(rainScale(0)).toBe(1);
    expect(stillScale(1)).toBeCloseTo(1 - DEEP_BASIN.stillLoss, 10);
  });

  it('dims ambient harvest in the deep without spending the PRNG', () => {
    const world = createWorld(1);
    world.lights = [];
    const shallow = world.organisms[0];
    const deep = world.organisms[1];
    shallow.pigmentCredit = 0;
    deep.pigmentCredit = 0;
    const rng = world.randomState;
    const harvested = world.ecologyLedger.ambientHarvested;
    for (let step = 0; step < 90; step++) {
      Object.assign(shallow, { x: OPENING_POOL.x, y: OPENING_POOL.y, vx: 0, vy: 0 });
      Object.assign(deep, { x: DEEP_BASIN.x, y: DEEP_BASIN.y, vx: 0, vy: 0 });
      stepWorld(world);
    }
    expect(world.randomState).toBe(rng);
    expect(world.ecologyLedger.ambientHarvested).toBeGreaterThan(harvested);
    expect(deep.pigmentCredit).toBeLessThan(shallow.pigmentCredit);
    expect(lightScale(depthAt(deep.x, deep.y))).toBeLessThan(lightScale(depthAt(shallow.x, shallow.y)));
  });

  it('shortens rain light reach in the deep', () => {
    const world = createWorld(11);
    world.elapsed = 49;
    expect(rainIntensityAt(world, DEEP_BASIN.x, DEEP_BASIN.y)).toBeLessThan(
      rainIntensityAt(world, OPENING_POOL.x, OPENING_POOL.y),
    );
    expect(lightReachAt(world, { x: DEEP_BASIN.x, y: DEEP_BASIN.y })).toBeLessThan(
      lightReachAt(world, { x: OPENING_POOL.x, y: OPENING_POOL.y }),
    );
    expect(lightReachAt(world, { x: OPENING_POOL.x, y: OPENING_POOL.y })).toBeGreaterThan(CALM_LIGHT_REACH);
  });

  it('settles sediment and remains downhill without spending the PRNG', () => {
    const world = createWorld(7);
    const rng = world.randomState;
    const grain = world.sediment[0];
    Object.assign(grain, { x: DEEP_BASIN.x - 48, y: DEEP_BASIN.y, strength: 0.4 });
    const startX = grain.x;
    world.remains = [
      {
        id: world.nextId++,
        species: 'remain',
        source: 'skimmer',
        x: DEEP_BASIN.x + 36,
        y: DEEP_BASIN.y,
        pigment: 0.4,
        hue: 40,
        age: 1,
        radius: 6,
      },
    ];
    const remainStart = world.remains[0].x;
    for (let step = 0; step < 120; step++) applyCurrentDrift(world, FIXED_STEP);
    expect(world.randomState).toBe(rng);
    expect(grain.x).toBeGreaterThan(startX);
    expect(world.remains[0].x).toBeLessThan(remainStart);
    expect(Math.abs(grain.y - DEEP_BASIN.y)).toBeLessThan(2);
    expect(pigmentInDeep(world)).toBeGreaterThan(0);
    expect(remainsInDeep(world)).toBeGreaterThan(0);
    const rest = settleVelocity({ x: DEEP_BASIN.x, y: DEEP_BASIN.y });
    expect(rest).toEqual({ x: 0, y: 0 });
  });

  it('stills visitor current in the deep', () => {
    const deep = createWorld(5);
    const shallow = createWorld(5);
    const current = {
      id: 1,
      x: 0,
      y: 0,
      dx: 1,
      dy: 0,
      startedAt: 0,
      duration: 8 as const,
      radius: 110 as const,
    };
    Object.assign(deep.sediment[0], { x: DEEP_BASIN.x, y: DEEP_BASIN.y, strength: 0.4 });
    Object.assign(shallow.sediment[0], { x: OPENING_POOL.x, y: OPENING_POOL.y, strength: 0.4 });
    deep.currents = [{ ...current, x: DEEP_BASIN.x, y: DEEP_BASIN.y }];
    shallow.currents = [{ ...current, x: OPENING_POOL.x, y: OPENING_POOL.y }];
    const deepStart = deep.sediment[0].x;
    const shallowStart = shallow.sediment[0].x;
    applyCurrentDrift(deep, 0.5);
    applyCurrentDrift(shallow, 0.5);
    expect(deep.sediment[0].x - deepStart).toBeLessThan(shallow.sediment[0].x - shallowStart);
  });

  it('opens with the habitat only: no extra life, pigment, or energy', () => {
    expect(SCHEMA_REVISION).toBe(15);
    const world = createWorld(1);
    expect(world.schemaRevision).toBe(15);
    expect(world.organisms).toHaveLength(24);
    expect(world.grazers).toHaveLength(4);
    expect(world.sediment).toHaveLength(48);
    expect(world.skimmers).toEqual([]);
    expect(world.remains).toEqual([]);
    expect(getStats(world).deepPigment).toBeGreaterThanOrEqual(0);
    expect(restoreWorld(serializeWorld(world))).toEqual(world);
    const previous = structuredClone(world) as unknown as Record<string, unknown>;
    previous.schemaRevision = 16;
    expect(restoreWorld(JSON.stringify(previous))).toBeNull();
  });

  it('names collected color in the while-you-were-gone journal', () => {
    expect(describeDeepChange(0, 0.4)).toBe('Color settled into the deeper water.');
    expect(describeDeepChange(0.3, 0.31)).toBeNull();
    const hour = composeJournal(
      { reason: 'ready', awaySeconds: 3600, simulateSeconds: 3600, sleptSeconds: 0 },
      idleEvents(),
      quietResources,
      { ...quietResources, deepPigment: 0.5 },
      3600,
    );
    expect(hour.lines).toContain('Color settled into the deeper water.');
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
    expect(serializeWorld(withoutAwayMemory(caught))).toBe(serializeWorld(withoutAwayMemory(live)));
  });

  it('lets the harness see the same depth rules as stepped elapsed time', () => {
    expect(parseHarnessArgs(['--days', '1', '--seed', '1']).days).toBe(1);
    const report = runHarness({ days: 1, seed: 1, visitorLight: false });
    expect(report.conservationCheck.remainsBalanced).toBe(true);
    expect(report.conservationCheck.fossilsBalanced).toBe(true);
    expect(report.conservationCheck.seamBalanced).toBe(true);
    const caught = createWorld(1);
    catchUpWorld(caught, planCatchUp(0, 360 * 1000));
    expect(caught.elapsed).toBeCloseTo(report.worldSeconds, 5);
    expect(serializeWorld(withoutAwayMemory(caught))).toBe(
      serializeWorld(
        withoutAwayMemory(
          (() => {
            const live = createWorld(1);
            const steps = Math.ceil(360 / FIXED_STEP);
            for (let i = 0; i < steps; i++) stepWorld(live);
            return live;
          })(),
        ),
      ),
    );
  }, 20_000);
});
