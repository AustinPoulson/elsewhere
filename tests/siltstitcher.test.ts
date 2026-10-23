import { describe, expect, it } from 'vitest';
import { applyCurrent } from '../src/world/actions/current';
import { applyCurrentDrift } from '../src/world/currents';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { addLight, createWorld, stepWorld } from '../src/world/simulation';
import { activeNewTypePopulation, SPECIES_CATALOG } from '../src/world/species/catalog';
import { updateRainbells } from '../src/world/species/rainbell';
import { updateReedwells } from '../src/world/species/reedwell';
import { updateSiltstitchers } from '../src/world/species/siltstitcher';
import { updateSkimmers } from '../src/world/species/skimmer';
import { FIXED_STEP, LIMITS, isInPool, type Point, type Siltstitcher, type World } from '../src/world/types';

function habitat(stock = 3): World {
  const world = createWorld(0);
  world.organisms = []; world.grazers = []; world.lights = []; world.sediment = [];
  world.nests = [{ id: world.nextId++, x: 720, y: 500, hue: 180, pigment: stock, age: 0 }];
  return world;
}
function born(stock = 3): { world: World; body: Siltstitcher } {
  const world = habitat(stock); updateSiltstitchers(world, FIXED_STEP);
  expect(world.siltstitchers).toHaveLength(1);
  return { world, body: world.siltstitchers[0] };
}
function grain(world: World, x = 720, y = 500, strength = 1, hue = 180) {
  const entry = { id: world.nextId++, x, y, strength, hue, radius: 6, age: 0 };
  world.sediment.push(entry); return entry;
}
function phase(world: World, body: Siltstitcher) { world.tick += (6 - (world.tick + body.id) % 6) % 6; }
function advance(world: World, seconds: number, withDrift = false) {
  for (let i = 0; i < Math.round(seconds / FIXED_STEP); i++) {
    world.elapsed += FIXED_STEP; world.tick++;
    updateSiltstitchers(world, FIXED_STEP);
    if (withDrift) applyCurrentDrift(world, FIXED_STEP);
  }
}
function pigment(world: World) {
  return world.nests.reduce((sum, nest) => sum + nest.pigment, 0)
    + world.sediment.reduce((sum, entry) => sum + entry.strength, 0)
    + world.siltstitchers.reduce((sum, body) => sum + body.body + body.reserve + body.cargo, 0);
}
function paidPayload(world: World, body: Siltstitcher, amount = .3, destination: Point = { x: 800, y: 500 }) {
  world.nests[0].pigment -= amount; body.cargo = amount;
  body.x = destination.x; body.y = destination.y;
  body.mode = 'outbound'; body.destination = { ...destination };
}

describe('siltstitcher outward nest disperser', () => {
  it('keeps opening populations empty and counts the new type under the aggregate living cap', () => {
    const world = createWorld(0);
    expect(world.siltstitchers).toEqual([]); expect(world.siltstitcherCandidateAfterId).toBe(0);
    expect(SPECIES_CATALOG.siltstitcher.cap).toBe(6);
    expect(activeNewTypePopulation(world)).toBe(0);
    const { body } = born(); world.siltstitchers = [body]; expect(activeNewTypePopulation(world)).toBe(1);
  });

  it('pays .3 only from a nest holding at least1.5, separates .2 body/.1 health, and draws no random numbers', () => {
    const world = habitat(1.5); const before = structuredClone(world);
    updateSiltstitchers(world, FIXED_STEP);
    expect(world.nests[0].pigment).toBe(1.2);
    expect(world.siltstitchers[0]).toMatchObject({ x: 720, y: 500, body: .2, reserve: .1, cargo: 0,
      age: 0, mode: 'home', destination: null, blockedFor: 0, starvedFor: 0, homeNestId: world.nests[0].id });
    expect(pigment(world)).toBeCloseTo(pigment(before), 12);
    expect(world.nextId).toBe(before.nextId + 1); expect(world.randomState).toBe(before.randomState);
    expect(world.siltstitcherAdmissionAt).toBe(60);
    const poor = habitat(1.5 - Number.EPSILON); const snapshot = structuredClone(poor);
    updateSiltstitchers(poor, FIXED_STEP); expect(poor).toEqual(snapshot);
  });

  it('rotates nest-ID order independently of array ordering, respects one/home, and preserves funding on admission refusals', () => {
    const world = habitat();
    const first = world.nests[0];
    const second = { ...first, id: world.nextId++, x: 950 };
    world.nests.push(second); world.nests.reverse();
    world.siltstitcherCandidateAfterId = first.id;
    updateSiltstitchers(world, FIXED_STEP);
    expect(world.siltstitchers[0].homeNestId).toBe(second.id); expect(first.pigment).toBe(3);
    world.elapsed = 60; world.tick = 6;
    updateSiltstitchers(world, FIXED_STEP);
    expect(world.siltstitchers).toHaveLength(2); expect(world.siltstitchers[1].homeNestId).toBe(first.id);
    expect(world.siltstitcherCandidateAfterId).toBe(first.id);
    world.siltstitcherAdmissionAt = 0;
    updateSiltstitchers(world, FIXED_STEP); expect(world.siltstitchers).toHaveLength(2);
    const setups = [
      (entry: World) => { entry.tick = 1; },
      (entry: World) => { entry.siltstitcherAdmissionAt = 1; },
      (entry: World) => { entry.nextId = Number.MAX_SAFE_INTEGER; },
      (entry: World) => { entry.nests[0].x = 0; },
    ];
    for (const setup of setups) {
      const refused = habitat(); setup(refused); const snapshot = structuredClone(refused);
      updateSiltstitchers(refused, FIXED_STEP); expect(refused).toEqual(snapshot);
    }
  });

  it('keeps six-body and shared24 caps, one active home, and spacing48 without spending a rejected admission', () => {
    const { world, body } = born();
    world.siltstitcherAdmissionAt = 0;
    world.nests.push({ ...world.nests[0], id: world.nextId++, x: 767.999, pigment: 3 });
    updateSiltstitchers(world, FIXED_STEP); expect(world.siltstitchers).toHaveLength(1); expect(world.nests[1].pigment).toBe(3);
    world.nests[1].x = 768; updateSiltstitchers(world, FIXED_STEP); expect(world.siltstitchers).toHaveLength(2);
    const capped = habitat();
    capped.siltstitchers = Array.from({ length: 6 }, () => ({ ...body, id: capped.nextId++, homeNestId: capped.nests[0].id }));
    updateSiltstitchers(capped, FIXED_STEP); expect(capped.siltstitchers).toHaveLength(6);
    // Maintenance/refill is real living work, but no seventh admission is paid.
    expect(capped.nests[0].pigment + capped.ecologyLedger.siltstitcherNestReserve
      + capped.ecologyLedger.siltstitcherNestCargo).toBeCloseTo(3, 12);
    const aggregate = habitat();
    const rootWorld = habitat(); grain(rootWorld, 720, 500, 1); rootWorld.elapsed = 40;
    updateReedwells(rootWorld, FIXED_STEP);
    aggregate.reedwells = Array.from({ length: 24 }, () => ({ ...rootWorld.reedwells[0], id: aggregate.nextId++ }));
    updateSiltstitchers(aggregate, FIXED_STEP); expect(aggregate.siltstitchers).toHaveLength(0); expect(aggregate.nests[0].pigment).toBe(3);
  });

  it('separately pays reserve and cargo at their normal rates while leaving1.2 protected stock untouched', () => {
    const { world, body } = born(); body.reserve = .05;
    world.nests[0].pigment = 1.21;
    const initial = pigment(world);
    updateSiltstitchers(world, .25);
    expect(world.ecologyLedger.siltstitcherNestReserve).toBe(.0025);
    expect(world.ecologyLedger.siltstitcherNestCargo).toBeCloseTo(.0075, 12);
    expect(body.reserve).toBeCloseTo(.05225, 12); expect(body.cargo).toBeCloseTo(.0075, 12);
    expect(world.nests[0].pigment).toBe(1.2);
    updateSiltstitchers(world, .25);
    expect(body.cargo).toBeCloseTo(.0075, 12); expect(body.reserve).toBeCloseTo(.052, 12);
    expect(pigment(world) + world.ecologyLedger.siltstitcherMaintenancePigment).toBeCloseTo(initial, 12);
    body.x = 736.001; const nestBefore = world.nests[0].pigment;
    updateSiltstitchers(world, .25); expect(world.nests[0].pigment).toBe(nestBefore);
  });

  it('selects a legal poorer fringe at a saved phase, moves at10/s and delivers exactly the paid whole cargo', () => {
    const { world, body } = born(); const initial = pigment(world);
    advance(world, 8);
    expect(body.cargo).toBe(.3); expect(body.mode).toBe('outbound'); expect(body.destination).not.toBeNull();
    const destination = { ...body.destination! };
    const distance = Math.hypot(destination.x - world.nests[0].x, destination.y - world.nests[0].y);
    expect(distance).toBeGreaterThanOrEqual(60 - 1e-9); expect(distance).toBeLessThanOrEqual(100 + 1e-9);
    expect(isInPool(destination.x, destination.y, 11)).toBe(true);
    const position = { x: body.x, y: body.y };
    updateSiltstitchers(world, .25);
    expect(Math.hypot(body.x - position.x, body.y - position.y)).toBeCloseTo(2.5, 10);
    advance(world, 12);
    expect(world.ecologyLedger.siltstitcherOutwardPigment).toBe(.3);
    expect(world.sediment).toHaveLength(1); expect(world.sediment[0].strength).toBe(.3);
    expect(world.sediment[0].x).toBeCloseTo(destination.x, 10); expect(world.sediment[0].y).toBeCloseTo(destination.y, 10);
    expect(pigment(world) + world.ecologyLedger.siltstitcherMaintenancePigment).toBeCloseTo(initial, 10);
  });

  it('allows an actually funded partial trip after protected stock stops loading, without turning cargo into health', () => {
    const { world, body } = born(1.6);
    advance(world, 8);
    expect(world.nests[0].pigment).toBe(1.2);
    expect(body.cargo).toBeGreaterThanOrEqual(.06); expect(body.cargo).toBeLessThan(.3);
    expect(body.mode).toBe('outbound'); expect(body.destination).not.toBeNull();
    const separated = born(); separated.world.nests[0].pigment = 1.2;
    separated.body.cargo = .3; separated.body.reserve = 0; separated.body.starvedFor = 59.9;
    updateSiltstitchers(separated.world, .25);
    expect(separated.world.siltstitchers).toHaveLength(0);
    expect(separated.world.sediment[0].strength).toBe(.5);
  });

  it('retains cargo on a full floor, returns after10s blocked and retries without another cargo withdrawal', () => {
    const { world, body } = born(); paidPayload(world, body);
    for (let i = 0; i < LIMITS.sediment; i++) grain(world);
    const nestBefore = world.nests[0].pigment;
    updateSiltstitchers(world, FIXED_STEP);
    expect(body.mode).toBe('blocked'); expect(body.cargo).toBe(.3);
    expect(applyCurrent(world, { x: 740, y: 500 }, { x: 860, y: 500 }).status).toBe('applied');
    advance(world, 10, true); // Drift cannot restart or indefinitely postpone the blocked clock.
    expect(body.mode).toBe('returning'); expect(body.destination).toBeNull(); expect(body.blockedFor).toBe(0);
    advance(world, 9);
    expect(body.mode).toBe('outbound'); expect(body.cargo).toBe(.3);
    expect(world.ecologyLedger.siltstitcherNestCargo).toBe(0);
    expect(world.ecologyLedger.siltstitcherOutwardPigment).toBe(0);
    expect(world.nests[0].pigment).toBeLessThanOrEqual(nestBefore);
    expect(world.sediment).toHaveLength(600);
  });

  it('transfers one entire payload into the nearest whole-fit grain within12, chooses ID ties and never overspends capacity', () => {
    const { world, body } = born(); paidPayload(world, body);
    for (let i = 0; i < LIMITS.sediment; i++) grain(world);
    const tooFull = world.sediment[0]; Object.assign(tooFull, { x: 800, y: 500, strength: .7 + Number.EPSILON });
    const firstFit = world.sediment[1]; Object.assign(firstFit, { x: 812, y: 500, strength: .7 });
    const lastFit = world.sediment[2]; Object.assign(lastFit, { x: 788, y: 500, strength: .7 });
    world.sediment.reverse(); const next = world.nextId; const initial = pigment(world);
    phase(world, body); updateSiltstitchers(world, FIXED_STEP);
    expect(tooFull.strength).toBe(.7 + Number.EPSILON);
    expect(firstFit.strength).toBe(1); expect(lastFit.strength).toBe(.7);
    expect(body.cargo).toBe(0); expect(world.nextId).toBe(next); expect(world.sediment).toHaveLength(600);
    expect(world.ecologyLedger.siltstitcherOutwardPigment).toBe(.3);
    expect(pigment(world) + world.ecologyLedger.siltstitcherMaintenancePigment).toBeCloseTo(initial, 10);
  });

  it('does not consume cargo on unsafe-ID/no-nearby-capacity delivery, but an existing whole-fit grain needs no new ID', () => {
    const { world, body } = born(); paidPayload(world, body); world.nextId = Number.MAX_SAFE_INTEGER;
    phase(world, body); updateSiltstitchers(world, FIXED_STEP);
    expect(body.cargo).toBe(.3); expect(body.mode).toBe('blocked'); expect(world.sediment).toEqual([]);
    const existing = { id: 1, x: 800, y: 500, strength: .6, hue: 1, radius: 6, age: 0 };
    world.sediment.push(existing);
    phase(world, body); updateSiltstitchers(world, FIXED_STEP);
    expect(existing.strength).toBeCloseTo(.9, 12); expect(body.cargo).toBe(0); expect(world.nextId).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('accepts ordinary current drift and keeps the mobile body confined without adding trails or effect history', () => {
    const { world, body } = born();
    expect(applyCurrent(world, { x: 660, y: 500 }, { x: 780, y: 500 }).status).toBe('applied');
    const before = body.x; applyCurrentDrift(world, .25);
    expect(body.x).toBeGreaterThan(before); expect(isInPool(body.x, body.y, 11)).toBe(true);
    expect('trail' in body).toBe(false);
  });

  it('handles missing home with no new stores and returns actual body/reserve/cargo exactly once at finite death', () => {
    const { world, body } = born(); paidPayload(world, body);
    world.nests = []; const initial = pigment(world);
    advance(world, 200);
    expect(world.siltstitchers).toHaveLength(0);
    expect(world.ecologyLedger.siltstitcherNestCargo).toBe(0); expect(world.ecologyLedger.siltstitcherNestReserve).toBe(0);
    expect(pigment(world) + world.ecologyLedger.siltstitcherMaintenancePigment).toBeCloseTo(initial, 10);
    const count = world.sediment.length; advance(world, 1); expect(world.sediment).toHaveLength(count);
    const aged = born(); paidPayload(aged.world, aged.body); aged.body.age = 479.99;
    const remains = aged.body.body + aged.body.reserve + aged.body.cargo;
    updateSiltstitchers(aged.world, FIXED_STEP); expect(aged.world.siltstitchers).toHaveLength(0);
    expect(aged.world.sediment[0].strength).toBeCloseTo(remains, 12);
  });

  it('uses the shared bounded exit fallback and mineralizes every unplaced remainder', () => {
    const { world, body } = born(); paidPayload(world, body);
    for (let i = 0; i < LIMITS.sediment; i++) grain(world);
    const nearest = world.sediment[0]; Object.assign(nearest, { x: body.x, y: body.y, strength: .8 });
    const remaining = body.body + body.reserve + body.cargo - .2;
    body.age = 480; updateSiltstitchers(world, FIXED_STEP);
    expect(nearest.strength).toBe(1); expect(world.sediment).toHaveLength(600);
    expect(world.ecologyLedger.mineralizedPigment).toBeCloseTo(remaining, 12);
  });

  it('preserves arbitrary outbound destination, velocity, cargo and search phase through exact saved continuation', () => {
    const { world, body } = born(); advance(world, 9.1);
    world.organisms = [createWorld(0).organisms[0]];
    expect(body.mode).toBe('outbound'); expect(body.destination).not.toBeNull();
    const restored = restoreWorld(serializeWorld(world))!; expect(restored).toEqual(world);
    for (let tick = 0; tick < 1800; tick++) { stepWorld(world); stepWorld(restored); }
    expect(restored).toEqual(world);
  });

  it('shows natural paid emergence, outward delivery and ordinary grazer regathering against an equal-input no-silt control', () => {
    const world = habitat(3); const home = world.nests[0];
    const template = createWorld(0).grazers[0];
    world.grazers = [{ ...template, id: world.nextId++, x: 720, y: 500, vx: 0, vy: 0, cargo: 0, nestId: home.id, returning: false }];
    world.skimmerAdmissionAt = 60; world.reedwellAdmissionAt = 60; world.rainbellAdmissionAt = 60;
    const control = structuredClone(world); control.siltstitcherAdmissionAt = 60;
    let appeared = false; let carried = false; let regathered = false; let returned = false;
    let outwardDistance = 0;
    for (let tick = 0; tick < 30 * 45; tick++) {
      const beforeCargo = world.grazers[0].cargo; const beforeNest = home.pigment;
      stepWorld(world); stepWorld(control);
      appeared ||= world.siltstitchers.length > 0;
      carried ||= world.siltstitchers.some(body => body.cargo > .05 && body.mode === 'outbound');
      regathered ||= world.grazers[0].cargo > .05;
      returned ||= beforeCargo > 0 && world.grazers[0].cargo === 0 && home.pigment > beforeNest;
      for (const entry of world.sediment) outwardDistance = Math.max(outwardDistance, Math.hypot(entry.x - home.x, entry.y - home.y));
    }
    expect(appeared).toBe(true); expect(carried).toBe(true); expect(regathered).toBe(true); expect(returned).toBe(true);
    expect(outwardDistance).toBeGreaterThanOrEqual(60 - 1e-8);
    expect(world.ecologyLedger.siltstitcherOutwardPigment).toBeGreaterThanOrEqual(.3);
    expect(control.siltstitchers).toHaveLength(0); expect(control.sediment).toHaveLength(0); expect(control.grazers[0].cargo).toBe(0);
    console.info(`Siltstitcher normal 45s pair: ${world.ecologyLedger.siltstitcherNestCargo.toFixed(6)} withdrawn cargo, ${world.ecologyLedger.siltstitcherOutwardPigment.toFixed(6)} delivered outward, max distance ${outwardDistance.toFixed(3)}, ordinary grazer regather+home return ${returned}; control floor ${control.sediment.length}.`);
  });

  it('keeps a finite twenty-minute dispersal trajectory bounded and accounts input/output transfers separately from metabolism', () => {
    const { world } = born(); world.siltstitcherAdmissionAt = 2000;
    const initial = pigment(world); advance(world, 1200);
    expect(world.siltstitchers).toHaveLength(0); expect(world.sediment.length).toBeLessThanOrEqual(600);
    expect(world.ecologyLedger.siltstitcherOutwardPigment).toBeGreaterThan(0);
    expect(world.ecologyLedger.siltstitcherNestCargo).toBeGreaterThan(0);
    expect(pigment(world) + world.ecologyLedger.siltstitcherMaintenancePigment + world.ecologyLedger.mineralizedPigment).toBeCloseTo(initial, 9);
  });

  it('profiles paired twenty-minute current-max all-type budgets with22 introduced bodies and exact saved continuation', () => {
    const world = createWorld(20261023);
    while (world.organisms.length < LIMITS.organisms) {
      const template = world.organisms[world.organisms.length % 24];
      world.organisms.push({ ...template, id: world.nextId++, trail: template.trail.map(point => ({ ...point })) });
    }
    while (world.lights.length < LIMITS.lights) addLight(world, 720, 500);
    while (world.sediment.length < LIMITS.sediment) grain(world, 350 + world.sediment.length % 20 * 35,
      320 + Math.floor(world.sediment.length / 20) * 12, .8, world.sediment.length % 360);
    while (world.nests.length < LIMITS.nests) {
      const index = world.nests.length;
      world.nests.push({ id: world.nextId++, x: 400 + index % 4 * 180, y: 300 + Math.floor(index / 4) * 120,
        hue: index * 20, pigment: 1, age: 0 });
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
    for (const nest of world.nests) nest.pigment = 3;
    for (let i = 0; i < 6; i++) {
      world.elapsed += 60; world.tick += 1800;
      updateSiltstitchers(world, FIXED_STEP);
    }
    expect(world.siltstitchers).toHaveLength(6); expect(activeNewTypePopulation(world)).toBe(22);
    for (let i = 0; i < 3; i++) expect(applyCurrent(world, { x: 640, y: 500 }, { x: 800, y: 500 }).status).toBe('applied');
    const restored = restoreWorld(serializeWorld(world))!; expect(restored).toEqual(world);
    const started = performance.now(); let samples = 0;
    for (let tick = 0; tick < 36000; tick++) {
      stepWorld(world); stepWorld(restored);
      if (world.organisms.length > 42 || world.grazers.length > 8 || world.nests.length > 16 || world.skimmers.length > 6
        || world.reedwells.length > 6 || world.rainbells.length > 4 || world.siltstitchers.length > 6 || activeNewTypePopulation(world) > 24
        || world.sediment.length > 600 || world.lights.length > 32 || world.currents.length > 3) throw new Error('Exceeded all-type world budgets');
      if (tick % 1800 === 0) {
        expect(restored).toEqual(world);
        expect(world.siltstitchers.every(body => body.reserve >= 0 && body.reserve <= .1 && body.cargo >= 0 && body.cargo <= .3
          && isInPool(body.x, body.y, 11))).toBe(true);
        expect(Object.values(world.ecologyLedger).every(value => Number.isFinite(value) && value >= 0)).toBe(true);
        samples++;
      }
    }
    expect(restored).toEqual(world); expect(samples).toBe(20);
    const wallMs = performance.now() - started;
    console.info(`Siltstitcher initial-max-budget profile: 42 lucents/6 skimmers/6 reedwells/4 rainbells/6 siltstitchers/8 grazers/16 nests/3 currents/600 grains/32 lights; 2 x 36,000 fixed steps, 20 exact samples, ${wallMs.toFixed(1)} ms total; ${(wallMs / 72000).toFixed(4)} ms/world step.`);
  }, 30_000);
});
