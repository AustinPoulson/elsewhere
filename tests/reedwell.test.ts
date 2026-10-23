import { describe, expect, it } from 'vitest';
import { applyCurrent } from '../src/world/actions/current';
import { daylight } from '../src/world/environment/daylight';
import { accrueFeedingPigment } from '../src/world/feeding';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { addLight, createWorld, stepWorld } from '../src/world/simulation';
import { NEW_TYPE_POPULATION_CAP, SPECIES_CATALOG } from '../src/world/species/catalog';
import { updateReedwells } from '../src/world/species/reedwell';
import { updateSkimmers } from '../src/world/species/skimmer';
import { FIXED_STEP, LIMITS, isInPool, type Reedwell, type World } from '../src/world/types';

function habitat(): World {
  const world = createWorld(0);
  world.elapsed = 40; world.tick = 1200;
  world.organisms = []; world.grazers = []; world.nests = []; world.lights = []; world.sediment = [];
  return world;
}
function grain(world: World, x = 720, y = 500, strength = .6, hue = 170) {
  const result = { id: world.nextId++, x, y, strength, hue, radius: 6, age: 0 };
  world.sediment.push(result); return result;
}
function born(world = habitat()): { world: World; reedwell: Reedwell } {
  grain(world); updateReedwells(world, FIXED_STEP);
  expect(world.reedwells).toHaveLength(1);
  return { world, reedwell: world.reedwells[0] };
}
function assertEnergy(world: World) {
  expect(world.ecologyLedger.daylightHarvested).toBeCloseTo(world.reedwells.reduce((sum, body) => sum + body.lightStore, 0)
    + world.ecologyLedger.reedwellEmittedLight + world.ecologyLedger.reedwellDissipatedLight, 8);
}

describe('rain-rooted daylight reedwell', () => {
  it('keeps catalog definitions separate from empty opening populations and uses deterministic bounded daylight', () => {
    const world = createWorld(90);
    expect(world.reedwells).toEqual([]);
    expect(world.skimmers).toEqual([]);
    expect(SPECIES_CATALOG.reedwell.cap).toBe(6);
    expect(NEW_TYPE_POPULATION_CAP).toBe(24);
    expect(daylight(world)).toBe(1);
    world.elapsed = 90; expect(daylight(world)).toBeCloseTo(0, 12);
    world.elapsed = 180; expect(daylight(world)).toBe(0);
    world.elapsed = 360; expect(daylight(world)).toBe(1);
    expect(world.ecologyLedger.daylightHarvested).toBe(0);
  });

  it('atomically pays .6 from distance/ID ordered sediment within32 and blends the paid hue', () => {
    const world = habitat();
    const center = grain(world, 720, 500, .1, 359);
    const first = grain(world, 730, 500, .3, 1);
    const last = grain(world, 710, 500, .4, 120);
    const outside = grain(world, 752.001, 500, 1);
    world.sediment.reverse();
    const beforeState = world.randomState; const next = world.nextId;
    updateReedwells(world, FIXED_STEP);
    expect(world.reedwells).toHaveLength(1);
    expect(world.reedwells[0]).toMatchObject({ x: 720, y: 500, body: .6, age: 0, lightStore: 0,
      lastEmissionAt: null, emissionNextAllowedAt: world.elapsed });
    expect(center.strength).toBe(0); expect(first.strength).toBe(0);
    expect(last.strength).toBeCloseTo(.2, 12); expect(outside.strength).toBe(1);
    expect(world.reedwells[0].hue).toBeGreaterThan(0);
    expect(world.reedwells[0].hue).toBeLessThan(90);
    expect(world.nextId).toBe(next + 1); expect(world.randomState).toBe(beforeState);
    expect(world.reedwellAdmissionAt).toBe(100);
  });

  it('refuses underfunding, dry weather, illegal shore, unsafe IDs and nonpolls without payment or random draws', () => {
    const cases = [
      { selected: true, setup: (world: World) => { world.sediment[0].strength = .6 - Number.EPSILON; } },
      { selected: false, setup: (world: World) => { world.elapsed = 0; } },
      { selected: false, setup: (world: World) => { world.sediment[0].x = 0; } },
      { selected: false, setup: (world: World) => { world.nextId = Number.MAX_SAFE_INTEGER; } },
      { selected: false, setup: (world: World) => { world.tick++; } },
      { selected: false, setup: (world: World) => { world.reedwellAdmissionAt = 41; } },
    ];
    for (const { selected, setup } of cases) {
      const world = habitat(); grain(world); setup(world);
      const before = structuredClone(world); updateReedwells(world, FIXED_STEP);
      if (selected) before.reedwellCandidateAfterId = world.sediment[0].id;
      expect(world).toEqual(before);
    }
  });

  it('accepts rain at exactly .5 and root resources at exactly 32 while refusing just below/outside', () => {
    const world = habitat(); world.elapsed = 33;
    grain(world, 720, 500, .2); grain(world, 752, 500, .4);
    updateReedwells(world, FIXED_STEP); expect(world.reedwells).toHaveLength(1);
    expect(world.sediment.reduce((sum, source) => sum + source.strength, 0)).toBeCloseTo(0, 12);
    const dry = habitat(); dry.elapsed = 33 - .000001; grain(dry);
    updateReedwells(dry, FIXED_STEP); expect(dry.reedwells).toHaveLength(0);
    const outside = habitat(); grain(outside, 720, 500, .2); grain(outside, 752.000001, 500, .4);
    const before = structuredClone(outside); updateReedwells(outside, FIXED_STEP);
    before.reedwellCandidateAfterId = outside.sediment[0].id;
    expect(outside).toEqual(before);
  });

  it('rotates one source-ID candidate per poll past unfunded pockets and wraps without random draws', () => {
    const world = habitat();
    const unfunded = grain(world, 400, 500, .1);
    const funded = grain(world, 900, 500, .6);
    const beforeState = world.randomState;
    world.sediment.reverse();
    updateReedwells(world, FIXED_STEP); expect(world.reedwells).toHaveLength(0);
    expect(world.reedwellCandidateAfterId).toBe(unfunded.id);
    expect(funded.strength).toBe(.6);
    world.elapsed += .2; world.tick += 6;
    updateReedwells(world, FIXED_STEP); expect(world.reedwells[0].x).toBe(900);
    expect(world.reedwellCandidateAfterId).toBe(funded.id);
    expect(unfunded.strength).toBe(.1);
    unfunded.strength = .6;
    world.elapsed = 101; world.tick = 1212;
    // Rain is also required after the cooldown; called rain is an existing input.
    world.weatherCall.startedAt = 91;
    updateReedwells(world, FIXED_STEP); expect(world.reedwells).toHaveLength(2);
    expect(world.reedwells[1].x).toBe(400);
    expect(world.reedwellCandidateAfterId).toBe(unfunded.id);
    expect(world.randomState).toBe(beforeState);
  });

  it('keeps spacing, per-type and shared admission caps without charging refusals', () => {
    const { world, reedwell } = born();
    const nearby = grain(world, 783.999, 500);
    world.reedwellAdmissionAt = 0;
    updateReedwells(world, FIXED_STEP);
    expect(world.reedwells).toHaveLength(1); expect(nearby.strength).toBe(.6);
    nearby.x = 784;
    updateReedwells(world, FIXED_STEP); expect(world.reedwells).toHaveLength(2);
    const full = habitat(); grain(full);
    full.reedwells = Array.from({ length: 6 }, (_, index) => ({ ...reedwell, id: full.nextId++, x: 300 + index * 100 }));
    updateReedwells(full, FIXED_STEP); expect(full.reedwells).toHaveLength(6); expect(full.sediment[0].strength).toBe(.6);
    // A future larger catalog still cannot multiply the aggregate admission cost.
    const shared = habitat(); grain(shared);
    const skimmerWorld = habitat(); skimmerWorld.nests = [{ id: skimmerWorld.nextId++, x: 500, y: 500, hue: 180, pigment: 1, age: 0 }];
    updateSkimmers(skimmerWorld, FIXED_STEP);
    const skimmer = skimmerWorld.skimmers[0];
    shared.skimmers = Array.from({ length: 24 }, () => ({ ...skimmer, id: shared.nextId++ }));
    updateReedwells(shared, FIXED_STEP); expect(shared.reedwells).toHaveLength(0); expect(shared.sediment[0].strength).toBe(.6);
    shared.skimmers = [];
    shared.reedwells = Array.from({ length: 24 }, () => ({ ...reedwell, id: shared.nextId++ }));
    shared.nests = [{ id: shared.nextId++, x: 500, y: 500, hue: 180, pigment: 1, age: 0 }];
    updateSkimmers(shared, FIXED_STEP); expect(shared.skimmers).toHaveLength(0); expect(shared.nests[0].pigment).toBe(1);
  });

  it('harvests only daylight at .18/second, names saturation overflow and emits exactly 1.5 without pigment conversion', () => {
    const { world, reedwell } = born();
    world.elapsed = 90;
    updateReedwells(world, .25);
    expect(reedwell.lightStore).toBe(.045); expect(world.ecologyLedger.daylightHarvested).toBe(.045);
    world.elapsed = 270; updateReedwells(world, .25); expect(reedwell.lightStore).toBe(.045);
    world.elapsed = 90; reedwell.lightStore = 2.99; reedwell.emissionNextAllowedAt = 100;
    world.ecologyLedger.daylightHarvested = 2.99;
    updateReedwells(world, .25);
    expect(reedwell.lightStore).toBe(3); expect(world.ecologyLedger.daylightUnharvested).toBeCloseTo(.035, 12);
    world.elapsed = 105; updateReedwells(world, .25);
    expect(world.lights).toHaveLength(1);
    expect(world.lights[0]).toMatchObject({ energy: 1.5, initialEnergy: 1.5, x: reedwell.x, y: reedwell.y, age: 0 });
    expect(reedwell.lightStore).toBe(1.5); expect(reedwell.emissionNextAllowedAt).toBe(120);
    expect(world.ecologyLedger.reedwellEmittedLight).toBe(1.5);
    expect(world.ecologyLedger.pigmentConverted).toBe(0); assertEnergy(world);
  });

  it('retains stored light on full-light and unsafe-ID refusal and respects cooldown and exact availability', () => {
    const { world, reedwell } = born(); world.elapsed = 270;
    reedwell.lightStore = 1.5;
    while (world.lights.length < LIMITS.lights) addLight(world, 720, 500);
    updateReedwells(world, .25); expect(reedwell.lightStore).toBe(1.5); expect(reedwell.lastEmissionAt).toBeNull();
    world.lights = []; const safe = world.nextId; world.nextId = Number.MAX_SAFE_INTEGER;
    updateReedwells(world, .25); expect(reedwell.lightStore).toBe(1.5); expect(world.lights).toHaveLength(0);
    world.nextId = safe; reedwell.lightStore = 1.5 - Number.EPSILON;
    updateReedwells(world, .25); expect(world.lights).toHaveLength(0);
    reedwell.lightStore = 3;
    updateReedwells(world, .25); expect(reedwell.lightStore).toBe(1.5);
    updateReedwells(world, .25); expect(world.lights).toHaveLength(1);
    world.elapsed += 15; updateReedwells(world, .25); expect(world.lights).toHaveLength(2); expect(reedwell.lightStore).toBe(0);
  });

  it('returns the .6 root once at 900s and explicitly dissipates remaining light without harvesting on the exit tick', () => {
    const { world, reedwell } = born(); reedwell.age = 899.9; reedwell.lightStore = 2;
    world.ecologyLedger.daylightHarvested = 2;
    updateReedwells(world, .25);
    expect(world.reedwells).toHaveLength(0);
    expect(world.sediment.at(-1)!.strength).toBe(.6);
    expect(world.ecologyLedger.reedwellDissipatedLight).toBe(2);
    expect(world.ecologyLedger.daylightHarvested).toBe(2);
    updateReedwells(world, .25); expect(world.sediment).toHaveLength(2); assertEnergy(world);
  });

  it('shares bounded root return with skimmers: nearest partial grain then named mineralization remainder', () => {
    const { world, reedwell } = born();
    world.sediment = [];
    for (let i = 0; i < LIMITS.sediment; i++) grain(world, 720, 500, 1);
    world.sediment[0].strength = .8; world.sediment[1].strength = .8;
    reedwell.age = 900; updateReedwells(world, .25);
    expect(world.sediment).toHaveLength(600);
    expect(world.sediment[0].strength).toBe(1); expect(world.sediment[1].strength).toBe(.8);
    expect(world.ecologyLedger.mineralizedPigment).toBeCloseTo(.4, 12);
  });

  it('pays lucent pigment only from actually consumed reedwell light, including tiny remnants', () => {
    const { world, reedwell } = born(); world.elapsed = 270; reedwell.lightStore = 1.5;
    updateReedwells(world, FIXED_STEP);
    const lucent = createWorld(0).organisms[0]; lucent.pigmentCredit = 0;
    accrueFeedingPigment(world, lucent, .0001);
    expect(lucent.pigmentCredit).toBeCloseTo(.000002, 15);
    expect(world.ecologyLedger.pigmentConverted).toBe(0);
    expect(world.lights[0].energy).toBe(1.5);
  });

  it('autonomously funds appearance, emits ordinary light, feeds a nearby lucent and conserves the named light budget', () => {
    const world = habitat(); grain(world, 720, 500, .61);
    const lucent = createWorld(0).organisms[0];
    Object.assign(lucent, { x: 750, y: 500, vx: 0, vy: 0, energy: .5, trail: [], pigmentCredit: 0 });
    world.organisms = [lucent];
    const control = structuredClone(world); control.reedwellAdmissionAt = 2000;
    let appeared = false; let emitted = false;
    for (let tick = 0; tick < 30 * 90; tick++) {
      stepWorld(world); stepWorld(control);
      appeared ||= world.reedwells.length > 0; emitted ||= world.ecologyLedger.reedwellEmittedLight > 0;
    }
    expect(appeared).toBe(true); expect(emitted).toBe(true);
    expect(world.consumed).toBeGreaterThan(0); expect(control.consumed).toBe(0);
    expect(world.organisms[0].pigmentCredit).toBeGreaterThan(0);
    assertEnergy(world);
    console.info(`Reedwell autonomous 90s pair: ${world.reedwells.length} rooted bodies, ${world.ecologyLedger.daylightHarvested.toFixed(6)} harvested, ${world.ecologyLedger.reedwellEmittedLight.toFixed(6)} emitted, ${world.consumed.toFixed(6)} lucent consumption, ${world.organisms[0].pigmentCredit.toFixed(6)} retained paid pigment credit; no-reedwell control consumed ${control.consumed}.`);
  });

  it('profiles paired twenty-minute worst-budget trajectories with restore continuation and aggregate bounds', () => {
    const world = createWorld(20261021);
    while (world.organisms.length < LIMITS.organisms) {
      const template = world.organisms[world.organisms.length % 24];
      world.organisms.push({ ...template, id: world.nextId++, trail: template.trail.map(point => ({ ...point })) });
    }
    while (world.lights.length < LIMITS.lights) addLight(world, 720, 500);
    while (world.sediment.length < LIMITS.sediment) grain(world, 350 + world.sediment.length % 20 * 35,
      320 + Math.floor(world.sediment.length / 20) * 12, .8, world.sediment.length % 360);
    while (world.nests.length < LIMITS.nests) {
      const i = world.nests.length;
      world.nests.push({ id: world.nextId++, x: 400 + i % 4 * 180, y: 300 + Math.floor(i / 4) * 120, hue: i * 20, pigment: 1, age: 0 });
    }
    while (world.grazers.length < LIMITS.grazers) {
      const template = world.grazers[world.grazers.length % 4];
      world.grazers.push({ ...template, id: world.nextId++, nestId: world.nests[world.grazers.length].id });
    }
    world.elapsed = 40; world.tick = 1200;
    for (let i = 0; i < 6; i++) {
      world.elapsed = 40 + i * 180; world.tick = Math.round(world.elapsed / FIXED_STEP);
      world.reedwellCandidateAfterId = 0; // Fixture deliberately presents this funded pocket first.
      world.sediment[0].strength = 1;
      world.sediment[0].x = 400 + i * 110; world.sediment[0].y = 450;
      updateReedwells(world, FIXED_STEP);
      updateSkimmers(world, FIXED_STEP);
    }
    expect(world.reedwells).toHaveLength(6); expect(world.skimmers).toHaveLength(6);
    expect(applyCurrent(world, { x: 640, y: 500 }, { x: 800, y: 500 }).status).toBe('applied');
    expect(applyCurrent(world, { x: 720, y: 420 }, { x: 720, y: 580 }).status).toBe('applied');
    expect(applyCurrent(world, { x: 650, y: 450 }, { x: 790, y: 550 }).status).toBe('applied');
    expect(world.reedwells.length + world.skimmers.length).toBeLessThanOrEqual(24);
    const restored = restoreWorld(serializeWorld(world))!; expect(restored).toEqual(world);
    const started = performance.now(); let samples = 0;
    for (let tick = 0; tick < 30 * 1200; tick++) {
      stepWorld(world); stepWorld(restored);
      if (world.reedwells.length > 6 || world.skimmers.length > 6 || world.reedwells.length + world.skimmers.length > 24
        || world.organisms.length > 42 || world.grazers.length > 8 || world.nests.length > 16
        || world.lights.length > 32 || world.sediment.length > 600 || world.currents.length > 3) throw new Error('Exceeded aggregate ecology budget');
      if (tick % 1800 === 0) {
        expect(restored).toEqual(world); assertEnergy(world);
        expect(world.reedwells.every(body => body.lightStore >= 0 && body.lightStore <= 3 && isInPool(body.x, body.y, 14))).toBe(true);
        expect(Object.values(world.ecologyLedger).every(value => Number.isFinite(value) && value >= 0)).toBe(true);
        samples++;
      }
    }
    expect(restored).toEqual(world); expect(samples).toBe(20); assertEnergy(world);
    const wallMs = performance.now() - started;
    console.info(`Reedwell initial-max-budget profile: 42 lucents/6 reedwells/6 skimmers/8 grazers/16 nests/3 currents/600 grains/32 lights; 2 x 36,000 fixed steps, 20 exact trajectory samples, ${wallMs.toFixed(1)} ms total; ${(wallMs / 72000).toFixed(4)} ms/whole-world step.`);
  }, 30_000);
});
