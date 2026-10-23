import { describe, expect, it } from 'vitest';
import { addLight, createWorld, stepWorld } from '../src/world/simulation';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { updateSkimmers } from '../src/world/species/skimmer';
import { FIXED_STEP, LIMITS, isInPool, type Skimmer, type World } from '../src/world/types';
import { confinePosition } from '../src/world/geometry';
import { applyCurrent } from '../src/world/actions/current';

function habitat(): World {
  const world = createWorld(47);
  world.skimmers = []; world.skimmerAdmissionAt = 0;
  world.lights = []; world.sediment = []; world.grazers = [];
  world.nests = [{ ...world.nests[0], x: 720, y: 500, pigment: .6 }];
  return world;
}
function born(world = habitat()): { world: World; skimmer: Skimmer } {
  updateSkimmers(world, FIXED_STEP);
  expect(world.skimmers).toHaveLength(1);
  return { world, skimmer: world.skimmers[0] };
}
function grain(world: World, x: number, y: number, strength = 1, hue = 359) {
  const result = { id: world.nextId++, x, y, strength, hue, radius: 6, age: 0 };
  world.sediment.push(result); return result;
}
function advance(world: World, seconds: number) {
  for (let i = 0; i < Math.round(seconds / FIXED_STEP); i++) { world.elapsed += FIXED_STEP; world.tick++; updateSkimmers(world, FIXED_STEP); }
}
function pigment(world: World) {
  return world.nests.reduce((sum, nest) => sum + nest.pigment, 0)
    + world.sediment.reduce((sum, deposit) => sum + deposit.strength, 0)
    + world.skimmers.reduce((sum, body) => sum + body.body + body.reserve, 0);
}

describe('autonomous prism skimmer', () => {
  it('appears only from funded habitat and transfers exactly .6 into .2 body and .4 reserve without random draws', () => {
    const world = habitat();
    const before = structuredClone(world);
    const { skimmer } = born(world);
    expect(world.nests[0].pigment).toBe(0);
    expect(skimmer).toMatchObject({ body: .2, reserve: .4, age: 0, homeNestId: world.nests[0].id, targetSedimentId: null });
    expect(pigment(world)).toBeCloseTo(.6, 12);
    expect(world.nextId).toBe(before.nextId + 1);
    expect(world.randomState).toBe(before.randomState);
    expect(world.skimmerAdmissionAt).toBe(60);
    expect(Math.hypot(skimmer.x - 720, skimmer.y - 500)).toBeLessThanOrEqual(24);
    expect(isInPool(skimmer.x, skimmer.y, 11)).toBe(true);
    const empty = habitat(); empty.nests[0].pigment = .599;
    const snapshot = serializeWorld(empty); updateSkimmers(empty, FIXED_STEP);
    expect(serializeWorld(empty)).toBe(snapshot);
  });

  it('chooses nest ID order, one per poll, and refuses unsafe IDs or crowded positions without charging habitat', () => {
    const world = habitat();
    world.nests.push({ ...world.nests[0], id: world.nextId++, x: 950, pigment: .6 });
    world.nests.reverse();
    born(world);
    expect(world.skimmers[0].homeNestId).toBe(Math.min(...world.nests.map(nest => nest.id)));
    expect(world.nests[0].pigment).toBe(.6);
    world.elapsed = 60; world.tick = 5;
    updateSkimmers(world, FIXED_STEP); expect(world.skimmers).toHaveLength(1);
    world.tick = 6; updateSkimmers(world, FIXED_STEP); expect(world.skimmers).toHaveLength(2);
    const unsafe = habitat(); unsafe.nextId = Number.MAX_SAFE_INTEGER;
    const before = serializeWorld(unsafe); updateSkimmers(unsafe, FIXED_STEP);
    expect(serializeWorld(unsafe)).toBe(before);
    const crowded = habitat();
    const existing = born(crowded).skimmer;
    crowded.skimmerAdmissionAt = 0;
    crowded.nests.push({ ...crowded.nests[0], id: crowded.nextId++, x: existing.x, y: existing.y, pigment: .6 });
    updateSkimmers(crowded, FIXED_STEP);
    expect(crowded.skimmers).toHaveLength(1); expect(crowded.nests[1].pigment).toBe(.6);
  });

  it('searches at its saved phase, chooses distance then ID, and transfers exact intake with circular hue', () => {
    const { world, skimmer } = born();
    Object.assign(skimmer, { x: 720, y: 500, hue: 1 });
    const food = grain(world, 720, 500, .9, 359);
    grain(world, 720, 500, .9, 120);
    world.sediment.reverse();
    world.tick = (6 - skimmer.id % 6) % 6;
    const initial = skimmer.reserve;
    updateSkimmers(world, .25);
    expect(skimmer.targetSedimentId).toBe(food.id);
    expect(food.strength).toBeCloseTo(.9 - .03 * .25, 12);
    expect(skimmer.reserve).toBeCloseTo(initial + .03 * .25 - .002 * .25, 12);
    expect(world.ecologyLedger.maintenancePigment).toBeCloseTo(.0005, 12);
    expect(skimmer.hue < 2 || skimmer.hue > 358).toBe(true);
    const better = grain(world, skimmer.x, skimmer.y, .9);
    world.tick++;
    updateSkimmers(world, .25);
    expect(skimmer.targetSedimentId).toBe(food.id);
    world.sediment = world.sediment.filter(entry => entry.id !== food.id);
    updateSkimmers(world, .25);
    expect(skimmer.targetSedimentId).toBeNull();
    expect(better.strength).toBe(.9);
  });

  it('converts .9 pigment into one paid 1.35 light with cooldown and no full-light or unsafe-ID debit', () => {
    const { world, skimmer } = born();
    skimmer.reserve = 1;
    updateSkimmers(world, .25);
    expect(world.lights).toHaveLength(1);
    expect(world.lights[0]).toMatchObject({ energy: 1.35, initialEnergy: 1.35, age: 0 });
    expect(skimmer.reserve).toBeCloseTo(1 - .0005 - .9, 12);
    expect(world.ecologyLedger.pigmentConverted).toBe(.9);
    expect(world.ecologyLedger.emittedLight).toBe(1.35);
    skimmer.reserve = 1;
    updateSkimmers(world, .25); expect(world.lights).toHaveLength(1);
    world.elapsed = 15;
    world.lights = Array.from({ length: LIMITS.lights }, (_, index) => ({ ...world.lights[0], id: world.nextId + index }));
    world.nextId += LIMITS.lights;
    skimmer.reserve = 1; updateSkimmers(world, .25);
    expect(skimmer.reserve).toBeCloseTo(.9995, 12);
    expect(world.ecologyLedger.pigmentConverted).toBe(.9);
    world.lights = []; world.nextId = Number.MAX_SAFE_INTEGER;
    skimmer.reserve = 1; updateSkimmers(world, .25);
    expect(world.lights).toHaveLength(0); expect(skimmer.reserve).toBeCloseTo(.9995, 12);
  });

  it('dies by starvation or age, returns actual pigment once, and can reenter only from newly funded habitat', () => {
    const { world, skimmer } = born();
    skimmer.reserve = 0; skimmer.starvedFor = 59.9;
    updateSkimmers(world, .25);
    expect(world.skimmers).toHaveLength(0);
    expect(world.sediment).toHaveLength(1); expect(world.sediment[0].strength).toBe(.2);
    updateSkimmers(world, .25); expect(world.sediment).toHaveLength(1);
    world.elapsed = 60; world.nests[0].pigment = .6;
    updateSkimmers(world, .25); expect(world.skimmers).toHaveLength(1);
    world.skimmers[0].age = 479.9;
    world.skimmers[0].reserve = 1;
    updateSkimmers(world, .25);
    expect(world.skimmers).toHaveLength(0);
    expect(world.sediment.at(-1)!.strength).toBe(1);
    expect(world.ecologyLedger.mineralizedPigment).toBeCloseTo(.2, 12);
  });

  it('tops up the nearest underfilled grain on a full floor and mineralizes every unplaced remainder', () => {
    const { world, skimmer } = born();
    for (let i = 0; i < LIMITS.sediment; i++) grain(world, 720, 500, 1);
    const destination = world.sediment[14];
    destination.x = skimmer.x; destination.y = skimmer.y; destination.strength = .8;
    skimmer.age = 480; skimmer.reserve = 1;
    const beforeIds = world.sediment.map(entry => entry.id);
    updateSkimmers(world, .25);
    expect(world.sediment).toHaveLength(600); expect(world.sediment.map(entry => entry.id)).toEqual(beforeIds);
    expect(destination.strength).toBe(1);
    expect(world.ecologyLedger.mineralizedPigment).toBeCloseTo(1, 12);
    expect(world.skimmers).toHaveLength(0);
  });

  it('retains funded habitat at the six-body cap and resets continuous starvation after actual food', () => {
    const { world, skimmer } = born();
    world.skimmers = Array.from({ length: 6 }, (_, index) => ({ ...skimmer, id: world.nextId++, homeNestId: world.nests[0].id,
      x: 400 + index * 100, y: 500, reserve: .4 }));
    world.nests.push({ ...world.nests[0], id: world.nextId++, x: 720, y: 700, pigment: .6 });
    world.skimmerAdmissionAt = 0;
    updateSkimmers(world, FIXED_STEP);
    expect(world.skimmers).toHaveLength(6);
    expect(world.nests[1].pigment).toBe(.6);
    world.skimmers = [world.skimmers[0]];
    const hungry = world.skimmers[0];
    hungry.reserve = 0; hungry.starvedFor = 59.9;
    grain(world, hungry.x, hungry.y);
    world.tick = (6 - hungry.id % 6) % 6;
    updateSkimmers(world, .25);
    expect(hungry.reserve).toBeGreaterThan(0);
    expect(hungry.starvedFor).toBe(0);
    expect(world.skimmers).toHaveLength(1);
  });

  it('resumes a saved target between search phases and follows the exact deterministic continuation', () => {
    const { world, skimmer } = born();
    grain(world, skimmer.x + 60, skimmer.y, 1);
    world.tick = (6 - skimmer.id % 6) % 6;
    updateSkimmers(world, FIXED_STEP);
    world.tick++; world.elapsed += FIXED_STEP;
    const restored = restoreWorld(serializeWorld(world))!;
    expect(restored).toEqual(world);
    for (let i = 0; i < 600; i++) { stepWorld(world); stepWorld(restored); }
    expect(restored).toEqual(world);
  });

  it('keeps a twenty-minute finite habitat trajectory bounded and accounts conversion, maintenance and body return', () => {
    const { world, skimmer } = born();
    grain(world, skimmer.x, skimmer.y, 1);
    const initial = pigment(world);
    const control = habitat(); control.nests[0].pigment = 0;
    advance(world, 1200); advance(control, 1200);
    expect(world.skimmers).toHaveLength(0); expect(control.skimmers).toHaveLength(0);
    expect(world.skimmers.length).toBeLessThanOrEqual(6);
    expect(world.sediment.length).toBeLessThanOrEqual(600);
    expect(world.lights.length).toBeLessThanOrEqual(32);
    expect(pigment(world) + world.ecologyLedger.maintenancePigment + world.ecologyLedger.pigmentConverted
      + world.ecologyLedger.mineralizedPigment).toBeCloseTo(initial, 9);
    expect(world.ecologyLedger.emittedLight).toBeCloseTo(world.ecologyLedger.pigmentConverted * 1.5, 12);
    expect(world.ecologyLedger.emittedLight).toBeLessThanOrEqual(initial * 1.5);
    expect(control.ecologyLedger.emittedLight).toBe(0);
  });

  it('runs a twenty-minute ordinary ecosystem against a no-skimmer control without runaway recycling', () => {
    const world = habitat();
    // Isolate this historical skimmer comparison from independently funded
    // reedwell light in both trajectories; their interaction has its own tests.
    world.reedwellAdmissionAt = 2000;
    world.nests[0].pigment = .61; // Leave room for ordinary nest fade before the first admission poll.
    world.organisms = [world.organisms[0]];
    Object.assign(world.organisms[0], { x: 755, y: 500, vx: 0, vy: 0, energy: .5, trail: [] });
    // Place habitat along this seed's ordinary dark foraging route, so its
    // naturally charged light has a nearby lucent rather than a forced teleport.
    const route = structuredClone(world);
    route.nests = [];
    for (let i = 0; i < 30 * 18; i++) stepWorld(route);
    world.nests[0].x = route.organisms[0].x; world.nests[0].y = route.organisms[0].y;
    confinePosition(world.nests[0], 18);
    grain(world, world.nests[0].x, world.nests[0].y);
    const control = structuredClone(world);
    control.skimmerAdmissionAt = 2000;
    control.reedwellAdmissionAt = 2000;
    const snapshots: { elapsed: number; emitted: number; converted: number; credit: number }[] = [];
    for (let tick = 0; tick < 30 * 1200; tick++) {
      stepWorld(world); stepWorld(control);
      if (world.skimmers.length > 6 || world.lights.length > 32 || world.sediment.length > 600
        || world.skimmers.some(body => !isInPool(body.x, body.y, 11) || body.reserve < 0 || body.reserve > 1)) throw new Error('Unbounded skimmer habitat');
      if (tick % 1800 === 0) snapshots.push({ elapsed: world.elapsed, emitted: world.ecologyLedger.emittedLight,
        converted: world.ecologyLedger.pigmentConverted, credit: world.organisms.reduce((sum, body) => sum + body.pigmentCredit, 0) });
    }
    expect(world.ecologyLedger.emittedLight).toBeGreaterThan(0);
    expect(world.consumed).toBeGreaterThan(0);
    expect(control.consumed).toBe(0);
    expect(control.ecologyLedger.emittedLight).toBe(0);
    expect(world.skimmers).toHaveLength(0);
    expect(world.ecologyLedger.emittedLight).toBeLessThanOrEqual(1.61 * 1.5 / .97);
    expect(world.consumed * .02).toBeLessThanOrEqual(world.ecologyLedger.pigmentConverted * .03 + 1e-10);
    expect(snapshots).toHaveLength(20);
    expect(snapshots.every(point => Number.isFinite(point.emitted + point.converted + point.credit))).toBe(true);
  }, 20_000);

  it('profiles twenty minutes from worst budgets with exact saved continuation and bounded aggregate ecology', () => {
    const world = createWorld(20261020);
    while (world.organisms.length < LIMITS.organisms) {
      const template = world.organisms[world.organisms.length % 24];
      world.organisms.push({ ...template, id: world.nextId++, trail: template.trail.map(point => ({ ...point })), pigmentCredit: 0 });
    }
    while (world.lights.length < LIMITS.lights) addLight(world, 720, 500);
    while (world.sediment.length < LIMITS.sediment) grain(world, 420 + (world.sediment.length % 20) * 28,
      300 + Math.floor(world.sediment.length / 20) * 12, .4, world.sediment.length % 360);
    world.nests.push({ id: world.nextId++, x: 500, y: 500, hue: 180, pigment: 1, age: 0 },
      { id: world.nextId++, x: 900, y: 500, hue: 240, pigment: 1, age: 0 });
    while (world.nests.length < LIMITS.nests) {
      const index = world.nests.length;
      world.nests.push({ id: world.nextId++, x: 300 + index % 5 * 180, y: 300 + Math.floor(index / 5) * 100,
        hue: index * 20, pigment: 1, age: 0 });
    }
    while (world.grazers.length < LIMITS.grazers) {
      const template = world.grazers[world.grazers.length % 4];
      world.grazers.push({ ...template, id: world.nextId++, nestId: world.nests[world.grazers.length].id });
    }
    for (const nest of world.nests) nest.pigment = 1;
    for (let i = 0; i < 6; i++) {
      world.elapsed = i * 60; world.tick = Math.round(world.elapsed / FIXED_STEP);
      updateSkimmers(world, FIXED_STEP);
    }
    expect(applyCurrent(world, { x: 640, y: 500 }, { x: 800, y: 500 }).status).toBe('applied');
    expect(applyCurrent(world, { x: 720, y: 420 }, { x: 720, y: 580 }).status).toBe('applied');
    expect(applyCurrent(world, { x: 650, y: 450 }, { x: 790, y: 550 }).status).toBe('applied');
    expect(world.skimmers).toHaveLength(6);
    expect(world.organisms).toHaveLength(42);
    expect(world.grazers).toHaveLength(8);
    expect(world.nests).toHaveLength(16);
    expect(world.currents).toHaveLength(3);
    expect(world.sediment).toHaveLength(600);
    expect(world.lights).toHaveLength(32);
    const restored = restoreWorld(serializeWorld(world))!;
    expect(restored).toEqual(world);
    const beforeConverted = world.ecologyLedger.pigmentConverted;
    const beforeEmitted = world.ecologyLedger.emittedLight;
    const started = performance.now();
    let sampled = 0;
    for (let tick = 0; tick < 30 * 1200; tick++) {
      stepWorld(world); stepWorld(restored);
      if (world.organisms.length > 42 || world.skimmers.length > 6 || world.grazers.length > 8 || world.nests.length > 16
        || world.currents.length > 3 || world.lights.length > 32 || world.sediment.length > 600) throw new Error('Exceeded aggregate ecosystem budgets');
      if (world.skimmers.some(body => body.reserve < 0 || body.reserve > 1 || !isInPool(body.x, body.y, 11))) throw new Error('Invalid bounded skimmer');
      if (tick % 1800 === 0) {
        expect(restored).toEqual(world);
        expect(world.sediment.every(deposit => deposit.strength > 0 && deposit.strength <= 1)).toBe(true);
        expect(world.organisms.every(body => body.pigmentCredit >= 0 && body.pigmentCredit <= 1)).toBe(true);
        expect(Object.values(world.ecologyLedger).every(value => Number.isFinite(value) && value >= 0)).toBe(true);
        sampled++;
      }
    }
    expect(restored).toEqual(world);
    expect(sampled).toBe(20);
    expect(world.ecologyLedger.emittedLight - beforeEmitted).toBeCloseTo((world.ecologyLedger.pigmentConverted - beforeConverted) * 1.5, 9);
    expect(world.ecologyLedger.maintenancePigment).toBeGreaterThan(0);
    expect(world.consumed).toBeGreaterThan(0);
    const wallMs = performance.now() - started;
    console.info(`Skimmer initial-max-budget profile (42 lucents/6 skimmers/8 grazers/16 nests/3 currents/600 grains/32 lights): 2 x 36,000 fixed steps, 20 exact trajectory samples, ${wallMs.toFixed(1)} ms total; ${(wallMs / 72000).toFixed(4)} ms/whole-world step.`);
  }, 30_000);
});
