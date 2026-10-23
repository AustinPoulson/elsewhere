import { describe, expect, it } from 'vitest';
import { applyCurrent } from '../src/world/actions/current';
import { applyCurrentDrift } from '../src/world/currents';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { addLight, createWorld, stepWorld } from '../src/world/simulation';
import { activeNewTypePopulation, SPECIES_CATALOG } from '../src/world/species/catalog';
import { updateRainbells } from '../src/world/species/rainbell';
import { updateReedwells } from '../src/world/species/reedwell';
import { updateSkimmers } from '../src/world/species/skimmer';
import { FIXED_STEP, LIMITS, isInPool, type Rainbell, type World } from '../src/world/types';

function habitat(): World {
  const world = createWorld(0);
  world.elapsed = 40; world.tick = 1200;
  world.organisms = []; world.grazers = []; world.nests = []; world.lights = []; world.sediment = [];
  world.reedwellAdmissionAt = 0;
  return world;
}
function grain(world: World, x = 720, y = 500, strength = .6, hue = 180) {
  const entry = { id: world.nextId++, x, y, strength, hue, radius: 6, age: 0 };
  world.sediment.push(entry); return entry;
}
function born(): { world: World; bell: Rainbell } {
  const world = habitat(); grain(world);
  updateRainbells(world, FIXED_STEP);
  expect(world.rainbells).toHaveLength(1);
  world.sediment = [];
  return { world, bell: world.rainbells[0] };
}
function searchPhase(world: World, bell: Rainbell) { world.tick = (6 - bell.id % 6) % 6; }
function pigment(world: World) {
  return world.sediment.reduce((sum, entry) => sum + entry.strength, 0)
    + world.rainbells.reduce((sum, entry) => sum + entry.body + entry.reserve, 0);
}
function advanceRainbells(world: World, seconds: number) {
  for (let tick = 0; tick < Math.round(seconds / FIXED_STEP); tick++) {
    world.elapsed += FIXED_STEP; world.tick++;
    updateRainbells(world, FIXED_STEP); applyCurrentDrift(world, FIXED_STEP);
  }
}

describe('rainbell polyp paid sediment pump', () => {
  it('keeps possible types distinct from opening populations and counts all new types in the shared cap', () => {
    const world = createWorld(0);
    expect(world.rainbells).toEqual([]); expect(world.rainbellCandidateAfterId).toBe(0);
    expect(SPECIES_CATALOG.rainbell.cap).toBe(4); expect(activeNewTypePopulation(world)).toBe(0);
    const { bell } = born();
    world.rainbells = [bell]; expect(activeNewTypePopulation(world)).toBe(1);
  });

  it('pays exactly .6 by distance then ID into .2 body and .4 reserve with no random draw', () => {
    const world = habitat();
    const center = grain(world, 720, 500, .1, 359);
    const first = grain(world, 730, 500, .3, 1);
    const last = grain(world, 710, 500, .4, 120);
    const outside = grain(world, 752.001, 500, 1);
    world.sediment.reverse();
    const beforeRandom = world.randomState; const beforeId = world.nextId;
    const beforePigment = pigment(world);
    updateRainbells(world, FIXED_STEP);
    expect(world.rainbells).toHaveLength(1);
    expect(world.rainbells[0]).toMatchObject({ x: 720, y: 500, body: .2, reserve: .4, age: 0,
      starvedFor: 0, feedTargetSedimentId: null, pumpTargetSedimentId: null,
      pulseNextAllowedAt: 40, lastPulseAt: null });
    expect(center.strength).toBe(0); expect(first.strength).toBe(0);
    expect(last.strength).toBeCloseTo(.2, 12); expect(outside.strength).toBe(1);
    expect(pigment(world)).toBeCloseTo(beforePigment, 12);
    expect(world.rainbellAdmissionAt).toBe(100); expect(world.nextId).toBe(beforeId + 1);
    expect(world.randomState).toBe(beforeRandom);
  });

  it('rotates past one underfunded candidate, wraps after cooldown and never overspends a near-.6 pocket', () => {
    const world = habitat();
    const first = grain(world, 400, 500, .6 - Number.EPSILON);
    const second = grain(world, 900, 500, .6);
    world.sediment.reverse();
    const random = world.randomState; const id = world.nextId;
    updateRainbells(world, FIXED_STEP);
    expect(world.rainbells).toHaveLength(0); expect(world.rainbellCandidateAfterId).toBe(first.id);
    expect(first.strength).toBe(.6 - Number.EPSILON); expect(world.nextId).toBe(id);
    world.elapsed += .2; world.tick += 6;
    updateRainbells(world, FIXED_STEP);
    expect(world.rainbells[0].x).toBe(900); expect(world.rainbellCandidateAfterId).toBe(second.id);
    first.strength = .6; world.elapsed = 101; world.tick += 6; world.weatherCall.startedAt = 91;
    updateRainbells(world, FIXED_STEP);
    expect(world.rainbells).toHaveLength(2); expect(world.rainbells[1].x).toBe(400);
    expect(world.rainbellCandidateAfterId).toBe(first.id); expect(world.randomState).toBe(random);
  });

  it('refuses dry/nonpoll/rest/shore/unsafe entry, accepts rain=.5 and root radius32, and enforces spacing64', () => {
    const setups = [
      (world: World) => { world.elapsed = 33 - .000001; },
      (world: World) => { world.tick++; },
      (world: World) => { world.rainbellAdmissionAt = 41; },
      (world: World) => { world.sediment[0].x = 0; },
      (world: World) => { world.nextId = Number.MAX_SAFE_INTEGER; },
    ];
    for (const setup of setups) {
      const world = habitat(); grain(world); setup(world);
      const before = structuredClone(world); updateRainbells(world, FIXED_STEP); expect(world).toEqual(before);
    }
    const edge = habitat(); edge.elapsed = 33;
    grain(edge, 720, 500, .2); grain(edge, 752, 500, .4);
    updateRainbells(edge, FIXED_STEP); expect(edge.rainbells).toHaveLength(1);
    const { world } = born(); world.rainbellAdmissionAt = 0;
    const nearby = grain(world, 783.999, 500);
    updateRainbells(world, FIXED_STEP); expect(world.rainbells).toHaveLength(1); expect(nearby.strength).toBe(.6);
    nearby.x = 784; updateRainbells(world, FIXED_STEP); expect(world.rainbells).toHaveLength(2);
  });

  it('keeps funded habitat at the four-body and shared24 admission limits', () => {
    const { bell } = born();
    const world = habitat(); const source = grain(world, 950, 500);
    world.rainbells = Array.from({ length: 4 }, (_, index) => ({ ...bell, id: world.nextId++, x: 350 + index * 100 }));
    updateRainbells(world, FIXED_STEP); expect(world.rainbells).toHaveLength(4); expect(source.strength).toBe(.6);
    world.rainbells = [];
    const seed = habitat(); grain(seed); updateReedwells(seed, FIXED_STEP);
    world.reedwells = Array.from({ length: 24 }, () => ({ ...seed.reedwells[0], id: world.nextId++ }));
    updateRainbells(world, FIXED_STEP); expect(world.rainbells).toHaveLength(0); expect(source.strength).toBe(.6);
  });

  it('searches both food and pump by distance/ID at the saved phase, then revalidates live target distance and actual strength', () => {
    const { world, bell } = born();
    const food = grain(world, 748, 500, .9, 359);
    const foodTie = grain(world, 692, 500, .9, 120);
    const pump = grain(world, 756, 500, .9);
    grain(world, 684, 500, .9);
    world.sediment.reverse(); searchPhase(world, bell);
    bell.pulseNextAllowedAt = 100;
    const initialReserve = bell.reserve;
    updateRainbells(world, .25);
    expect(bell.feedTargetSedimentId).toBe(food.id); expect(bell.pumpTargetSedimentId).toBe(pump.id);
    expect(food.strength).toBeCloseTo(.895, 12); expect(foodTie.strength).toBe(.9);
    expect(bell.reserve).toBeCloseTo(initialReserve + .005 - .00025, 12);
    expect(world.ecologyLedger.rainbellIntake).toBe(.005);
    expect(world.ecologyLedger.rainbellMaintenancePigment).toBe(.00025);
    world.tick++; food.x = 748.001; pump.x = 749.999;
    const beforeFood = food.strength;
    updateRainbells(world, .25);
    expect(bell.feedTargetSedimentId).toBeNull(); expect(bell.pumpTargetSedimentId).toBeNull();
    expect(food.strength).toBe(beforeFood); expect(world.ecologyLedger.rainbellIntake).toBe(.005);
  });

  it('caps intake at actual food and reserve1, resets continuous starvation after food, and accounts maintenance', () => {
    const { world, bell } = born();
    const food = grain(world, 720, 500, .003); searchPhase(world, bell);
    bell.reserve = 0; bell.starvedFor = 59.9;
    updateRainbells(world, .25);
    expect(food.strength).toBe(0); expect(bell.reserve).toBeCloseTo(.00275, 12);
    expect(bell.starvedFor).toBe(0); expect(world.ecologyLedger.rainbellIntake).toBe(.003);
    food.strength = 1; bell.reserve = .999;
    updateRainbells(world, .25);
    expect(bell.reserve).toBeCloseTo(.99975, 12); expect(food.strength).toBeCloseTo(.999, 12);
  });

  it('contracts into the existing midpoint/coast/current lifecycle and charges exactly .04 only on successful rain pulses', () => {
    const { world, bell } = born(); const source = grain(world, 756, 500, 1);
    searchPhase(world, bell); const random = world.randomState; const next = world.nextId;
    updateRainbells(world, .25);
    expect(world.currents).toHaveLength(1);
    expect(world.currents[0]).toEqual({ id: next, x: 738, y: 500, dx: -1, dy: 0, startedAt: 40, duration: 8, radius: 110 });
    expect(bell.reserve).toBeCloseTo(.4 - .00025 - .04, 12);
    expect(world.ecologyLedger.rainbellPumpingPigment).toBe(.04);
    expect(bell.lastPulseAt).toBe(40); expect(bell.pulseNextAllowedAt).toBe(55);
    expect(source.strength).toBe(1); expect(world.randomState).toBe(random);
    updateRainbells(world, .25); expect(world.currents).toHaveLength(1);
    world.elapsed = 48; applyCurrentDrift(world, FIXED_STEP); expect(world.currents).toHaveLength(0);
  });

  it('retains pulse pigment/rest on dry/full/unsafe/coast/missing/out-of-range failures without random draws', () => {
    const setups = [
      (world: World, _bell: Rainbell) => { world.elapsed = 80; },
      (world: World, _bell: Rainbell) => { for (let i = 0; i < 3; i++) applyCurrent(world, { x: 640, y: 500 }, { x: 800, y: 500 }); },
      (world: World, _bell: Rainbell) => { world.nextId = Number.MAX_SAFE_INTEGER; },
      (world: World, bell: Rainbell) => { let x = 720; while (isInPool(x + 1, 500, 14)) x++; bell.x = x; world.sediment[0].x = x + 40; },
      (world: World, _bell: Rainbell) => { world.sediment = []; },
      (world: World, _bell: Rainbell) => { world.sediment[0].x = 780.001; },
      (world: World, _bell: Rainbell) => { world.sediment[0].strength = 0; },
    ];
    for (const setup of setups) {
      const { world, bell } = born(); grain(world, 756, 500, 1);
      searchPhase(world, bell); setup(world, bell);
      const random = world.randomState; const pulse = bell.pulseNextAllowedAt; const currents = structuredClone(world.currents);
      updateRainbells(world, .25);
      expect(bell.reserve).toBeCloseTo(.39975, 12);
      expect(bell.pulseNextAllowedAt).toBe(pulse); expect(bell.lastPulseAt).toBeNull();
      expect(world.ecologyLedger.rainbellPumpingPigment).toBe(0);
      expect(world.currents).toEqual(currents); expect(world.randomState).toBe(random);
    }
  });

  it('refuses below exact .04 availability and pumps at the30 and60 range boundaries', () => {
    for (const distance of [30, 60]) {
      const { world, bell } = born(); grain(world, 720 + distance, 500, 1); searchPhase(world, bell);
      bell.reserve = .04; updateRainbells(world, .25);
      expect(world.currents).toHaveLength(0); expect(bell.lastPulseAt).toBeNull();
      bell.reserve = .04 + .00025; updateRainbells(world, .25);
      expect(world.currents).toHaveLength(1); expect(bell.reserve).toBeCloseTo(0, 12);
    }
  });

  it('moves actual sediment from36 into feeding reach at normal rates, with a no-pumping paired control', () => {
    const { world, bell } = born(); const source = grain(world, 756, 500, 1);
    world.reedwellAdmissionAt = 2000; world.rainbellAdmissionAt = 2000;
    const control = structuredClone(world); control.rainbells[0].pulseNextAllowedAt = 2000;
    const initial = pigment(world);
    advanceRainbells(world, 12); advanceRainbells(control, 12);
    expect(source.x).toBeLessThanOrEqual(748);
    expect(world.ecologyLedger.rainbellIntake).toBeGreaterThan(0);
    expect(control.ecologyLedger.rainbellIntake).toBe(0);
    expect(control.sediment[0].x).toBe(756);
    expect(bell.x).toBe(720); expect(bell.y).toBe(500);
    expect(pigment(world) + world.ecologyLedger.rainbellMaintenancePigment + world.ecologyLedger.rainbellPumpingPigment
      + world.ecologyLedger.mineralizedPigment).toBeCloseTo(initial, 10);
    console.info(`Rainbell normal-rate 12s pair: grain 36 moved to ${(source.x - bell.x).toFixed(6)} from root; ${world.ecologyLedger.rainbellIntake.toFixed(6)} actual intake, ${world.ecologyLedger.rainbellPumpingPigment.toFixed(6)} paid pump; no-pump control intake ${control.ecologyLedger.rainbellIntake}.`);
  });

  it('appears through paid natural-rain admission and then moves and consumes real sediment during hands-off whole-world play', () => {
    const world = habitat(); const root = grain(world, 720, 500, .61);
    const source = grain(world, 756, 500, 1);
    // Isolate this new type's funded opportunity while preserving real rain,
    // current drift, sediment fade and the ordinary simulation update order.
    world.reedwellAdmissionAt = world.elapsed + 60;
    const control = structuredClone(world); control.rainbellAdmissionAt = control.elapsed + 60;
    expect(world.rainbells).toHaveLength(0);
    for (let tick = 0; tick < 360; tick++) { stepWorld(world); stepWorld(control); }
    expect(world.rainbells).toHaveLength(1); expect(world.rainbells[0]).toMatchObject({ x: root.x, y: root.y, body: .2 });
    expect(source.x).toBeLessThan(748); expect(world.ecologyLedger.rainbellIntake).toBeGreaterThan(0);
    expect(world.ecologyLedger.rainbellPumpingPigment).toBe(.04);
    expect(control.rainbells).toHaveLength(0); expect(control.ecologyLedger.rainbellIntake).toBe(0);
    expect(control.sediment.find(entry => entry.id === source.id)!.x).toBe(756);
  });

  it('returns actual root plus reserve once on age/starvation and lets already paid fields outlive the polyp', () => {
    const { world, bell } = born(); grain(world, 756, 500, 1); searchPhase(world, bell);
    updateRainbells(world, FIXED_STEP); expect(world.currents).toHaveLength(1);
    const field = structuredClone(world.currents[0]); const reserve = bell.reserve;
    bell.age = 599.99; updateRainbells(world, FIXED_STEP);
    expect(world.rainbells).toHaveLength(0); expect(world.currents[0]).toEqual(field);
    expect(world.sediment.at(-1)!.strength).toBeCloseTo(.2 + reserve, 12);
    const count = world.sediment.length; updateRainbells(world, FIXED_STEP); expect(world.sediment).toHaveLength(count);
    const hungry = born(); hungry.bell.reserve = 0; hungry.bell.starvedFor = 59.9;
    updateRainbells(hungry.world, .25);
    expect(hungry.world.rainbells).toHaveLength(0); expect(hungry.world.sediment[0].strength).toBe(.2);
    const full = born(); for (let i = 0; i < LIMITS.sediment; i++) grain(full.world, 720, 500, 1);
    full.world.sediment[0].strength = .8; full.bell.age = 600; full.bell.reserve = 1;
    updateRainbells(full.world, FIXED_STEP);
    expect(full.world.sediment[0].strength).toBe(1);
    expect(full.world.ecologyLedger.mineralizedPigment).toBeCloseTo(1, 12);
  });

  it('restores both cached targets between staggered searches and follows the exact autonomous continuation', () => {
    const { world, bell } = born(); grain(world, 740, 500, 1); grain(world, 756, 500, 1);
    world.organisms = [createWorld(0).organisms[0]]; // Valid persisted worlds retain their existing lucents.
    searchPhase(world, bell); updateRainbells(world, FIXED_STEP);
    expect(bell.feedTargetSedimentId).not.toBeNull(); expect(bell.pumpTargetSedimentId).not.toBeNull();
    world.tick++; world.elapsed += FIXED_STEP;
    const restored = restoreWorld(serializeWorld(world))!; expect(restored).toEqual(world);
    for (let tick = 0; tick < 1800; tick++) { stepWorld(world); stepWorld(restored); }
    expect(restored).toEqual(world);
  });

  it('keeps a finite twenty-minute pumping habitat bounded and accounts all intake, upkeep, pump and exit pigment', () => {
    const { world, bell } = born(); grain(world, 756, 500, 1);
    world.rainbellAdmissionAt = 2000;
    const initial = pigment(world); advanceRainbells(world, 1200);
    expect(world.rainbells).toHaveLength(0); expect(bell.age).toBeGreaterThanOrEqual(600);
    expect(world.currents).toHaveLength(0);
    expect(pigment(world) + world.ecologyLedger.rainbellMaintenancePigment
      + world.ecologyLedger.rainbellPumpingPigment + world.ecologyLedger.mineralizedPigment).toBeCloseTo(initial, 9);
    expect(world.ecologyLedger.rainbellIntake).toBeGreaterThan(0);
    expect(world.ecologyLedger.rainbellPumpingPigment).toBeGreaterThan(0);
  });

  it('profiles a paired twenty-minute current-max all-type trajectory with 16 new bodies and exact restored continuation', () => {
    const world = createWorld(20261022);
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
    for (let i = 0; i < 6; i++) {
      world.elapsed = 40 + i * 180; world.tick = Math.round(world.elapsed / FIXED_STEP);
      world.reedwellCandidateAfterId = 0;
      Object.assign(world.sediment[0], { x: 400 + i * 110, y: 450, strength: 1 });
      updateReedwells(world, FIXED_STEP); updateSkimmers(world, FIXED_STEP);
    }
    for (let i = 0; i < 4; i++) {
      world.elapsed = 1120 + i * 180; world.tick = Math.round(world.elapsed / FIXED_STEP);
      world.rainbellCandidateAfterId = 0;
      Object.assign(world.sediment[0], { x: 400 + i * 130, y: 650, strength: 1 });
      updateRainbells(world, FIXED_STEP);
    }
    expect(world.reedwells).toHaveLength(6); expect(world.skimmers).toHaveLength(6); expect(world.rainbells).toHaveLength(4);
    expect(activeNewTypePopulation(world)).toBe(16);
    for (let i = 0; i < 3; i++) expect(applyCurrent(world, { x: 640, y: 500 }, { x: 800, y: 500 }).status).toBe('applied');
    const restored = restoreWorld(serializeWorld(world))!; expect(restored).toEqual(world);
    const started = performance.now(); let samples = 0;
    for (let tick = 0; tick < 36000; tick++) {
      stepWorld(world); stepWorld(restored);
      if (world.organisms.length > 42 || world.grazers.length > 8 || world.nests.length > 16 || world.skimmers.length > 6
        || world.reedwells.length > 6 || world.rainbells.length > 4 || activeNewTypePopulation(world) > 24
        || world.sediment.length > 600 || world.lights.length > 32 || world.currents.length > 3) throw new Error('Exceeded all-type world budgets');
      if (tick % 1800 === 0) {
        expect(restored).toEqual(world);
        expect(world.rainbells.every(body => body.reserve >= 0 && body.reserve <= 1 && isInPool(body.x, body.y, 14))).toBe(true);
        expect(Object.values(world.ecologyLedger).every(value => Number.isFinite(value) && value >= 0)).toBe(true);
        samples++;
      }
    }
    expect(restored).toEqual(world); expect(samples).toBe(20);
    const wallMs = performance.now() - started;
    console.info(`Rainbell initial-max-budget profile: 42 lucents/6 skimmers/6 reedwells/4 rainbells/8 grazers/16 nests/3 currents/600 grains/32 lights; 2 x 36,000 fixed steps, 20 exact samples, ${wallMs.toFixed(1)} ms total; ${(wallMs / 72000).toFixed(4)} ms/world step.`);
  }, 30_000);
});
