import { describe, expect, it } from 'vitest';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { createWorld, stepWorld } from '../src/world/simulation';
import { activeNewTypePopulation, NEW_TYPE_POPULATION_CAP } from '../src/world/species/catalog';
import { FIXED_STEP, LIMITS, type World } from '../src/world/types';

// Synthetic capacity fixture: it tests workload and deterministic restore, not
// a claim that normal ecology can fund all types at once. No personal save is
// read or changed.
function mixedMaximum(): World {
  const world = createWorld(281);
  world.sediment = [];
  const freshId = () => world.nextId++;
  for (let i = world.organisms.length; i < LIMITS.organisms; i++) {
    world.organisms.push({ ...structuredClone(world.organisms[i % 24]), id: freshId() });
  }
  for (let i = world.nests.length; i < LIMITS.nests; i++) {
    world.nests.push({
      id: freshId(),
      x: 400 + (i % 4) * 95,
      y: 380 + Math.floor(i / 4) * 65,
      hue: 180,
      pigment: 1.5,
      age: 0,
    });
  }
  for (let i = world.grazers.length; i < LIMITS.grazers; i++) {
    const nest = world.nests[i];
    world.grazers.push({
      ...world.grazers[0],
      id: freshId(),
      x: nest.x + 10,
      y: nest.y,
      nestId: nest.id,
      cargo: 0,
      returning: false,
    });
  }
  for (let i = world.lights.length; i < LIMITS.lights; i++) {
    world.lights.push({
      id: freshId(),
      x: 420 + (i % 7) * 90,
      y: 330 + Math.floor(i / 7) * 90,
      energy: 90,
      initialEnergy: 90,
      age: 0,
    });
  }
  for (let i = 0; i < LIMITS.sediment; i++) {
    const angle = i * 2.39996322973;
    const radius = Math.sqrt(((i * 37) % LIMITS.sediment) / LIMITS.sediment);
    world.sediment.push({
      id: freshId(),
      x: 720 + Math.cos(angle) * radius * 450,
      y: 500 + Math.sin(angle) * radius * 300,
      radius: 6,
      hue: 180,
      strength: 1,
      age: 0,
    });
  }
  for (let i = 0; i < 6; i++) {
    const nest = world.nests[i];
    world.skimmers.push({
      id: freshId(),
      species: 'skimmer',
      x: nest.x,
      y: nest.y,
      size: 8,
      body: 0.2,
      vx: 0,
      vy: 0,
      hue: 180,
      reserve: 0.4,
      age: 0,
      phase: 0,
      homeNestId: nest.id,
      targetSedimentId: null,
      starvedFor: 0,
      emissionNextAllowedAt: 0,
      lastEmissionAt: null,
    });
    world.reedwells.push({
      id: freshId(),
      species: 'reedwell',
      x: 450 + i * 90,
      y: 680,
      body: 0.6,
      age: 0,
      hue: 180,
      lightStore: 0,
      emissionNextAllowedAt: 0,
      lastEmissionAt: null,
    });
    if (i < 4)
      world.siltstitchers.push({
        id: freshId(),
        species: 'siltstitcher',
        x: nest.x,
        y: nest.y,
        vx: 0,
        vy: 0,
        body: 0.2,
        reserve: 0.1,
        cargo: 0,
        age: 0,
        hue: 180,
        homeNestId: nest.id,
        starvedFor: 0,
        mode: 'home',
        destination: null,
        blockedFor: 0,
      });
  }
  for (let i = 0; i < 4; i++) {
    world.rainbells.push({
      id: freshId(),
      species: 'rainbell',
      x: 520 + i * 125,
      y: 500,
      body: 0.2,
      age: 0,
      hue: 180,
      reserve: 0.4,
      starvedFor: 0,
      feedTargetSedimentId: null,
      pumpTargetSedimentId: null,
      pulseNextAllowedAt: 0,
      lastPulseAt: null,
    });
  }
  for (const x of [290, 1150]) {
    world.glassLimpets.push({
      id: freshId(),
      species: 'glassLimpet',
      x,
      y: 500,
      body: 0.2,
      reserve: 0.1,
      cargo: 0,
      age: 0,
      hue: 180,
      starvedFor: 0,
      targetSedimentId: null,
    });
  }
  for (let i = 0; i < 2; i++) {
    const host = world.grazers[i];
    world.cargoMites.push({
      id: freshId(),
      species: 'cargoMite',
      x: host.x,
      y: host.y,
      vx: host.vx,
      vy: host.vy,
      body: 0.1,
      reserve: 0.4,
      age: 0,
      hue: host.hue,
      starvedFor: 0,
      mode: 'attached',
      hostId: host.id,
      targetHostId: null,
      parentId: null,
      nextBirthAt: 30,
    });
  }
  for (const x of [320, 720, 1120]) {
    world.currents.push({ id: freshId(), x, y: 500, dx: 1, dy: 0, startedAt: 0, radius: 110, duration: 8 });
  }
  return world;
}

function checkCaps(world: World): void {
  expect(world.organisms.length).toBeLessThanOrEqual(LIMITS.organisms);
  expect(world.grazers.length).toBeLessThanOrEqual(LIMITS.grazers);
  expect(world.nests.length).toBeLessThanOrEqual(LIMITS.nests);
  expect(world.lights.length).toBeLessThanOrEqual(LIMITS.lights);
  expect(world.sediment.length).toBeLessThanOrEqual(LIMITS.sediment);
  expect(world.currents.length).toBeLessThanOrEqual(3);
  expect(activeNewTypePopulation(world)).toBeLessThanOrEqual(NEW_TYPE_POPULATION_CAP);
  expect(world.glassLimpets.length).toBeLessThanOrEqual(4);
  expect(world.cargoMites.length).toBeLessThanOrEqual(4);
}

function stepStress(world: World, index: number): void {
  // Keep all three short-lived currents active for a sustained maximum-current
  // workload. All renewals below are explicit synthetic capacity fixtures,
  // never claims about ecological funding or normal lifecycle behavior.
  // Current duration is eight seconds; refresh at seven seconds so the three
  // active flows stay within their ordinary phase without premature expiry.
  if (index % 210 === 0) for (const current of world.currents) current.startedAt = world.elapsed;
  for (const body of world.skimmers) {
    body.age %= 479;
    body.starvedFor = 0;
  }
  for (const body of world.reedwells) body.age %= 899;
  for (const body of world.rainbells) {
    body.age %= 599;
    body.starvedFor = 0;
  }
  for (const body of world.siltstitchers) {
    body.age %= 479;
    body.starvedFor = 0;
  }
  for (const body of world.glassLimpets) {
    body.age %= 479;
    body.starvedFor = 0;
  }
  for (const body of world.cargoMites) {
    body.age %= 239;
    body.starvedFor = 0;
    body.nextBirthAt = world.elapsed - body.age + 30;
  }
  stepWorld(world, FIXED_STEP);
  while (world.sediment.length < LIMITS.sediment) {
    const angle = world.nextId * 2.39996322973;
    world.sediment.push({
      id: world.nextId++,
      x: 720 + Math.cos(angle) * 320,
      y: 500 + Math.sin(angle) * 240,
      radius: 6,
      hue: 180,
      strength: 0.5,
      age: 0,
    });
  }
  while (world.lights.length < LIMITS.lights) {
    world.lights.push({ id: world.nextId++, x: 720, y: 500, energy: 90, initialEnergy: 90, age: 0 });
  }
}

describe('mixed catalog capacity', () => {
  it('holds aggregate limits for 20 simulated minutes and replays the second half exactly from a save', () => {
    const world = mixedMaximum();
    expect(world.organisms).toHaveLength(42);
    expect(world.grazers).toHaveLength(8);
    expect(world.nests).toHaveLength(16);
    expect(world.lights).toHaveLength(32);
    expect(world.sediment).toHaveLength(600);
    expect(world.currents).toHaveLength(3);
    expect(activeNewTypePopulation(world)).toBe(24);
    expect(restoreWorld(serializeWorld(world))).not.toBeNull();
    for (let index = 0; index < 18_000; index++) {
      stepStress(world, index);
      if (index % 900 === 0) checkCaps(world);
    }
    expect(activeNewTypePopulation(world)).toBe(24);
    expect(world.sediment).toHaveLength(600);
    expect(world.lights).toHaveLength(32);
    expect(world.currents).toHaveLength(3);
    const continued = restoreWorld(serializeWorld(world));
    expect(continued).not.toBeNull();
    for (let index = 18_000; index < 36_000; index++) {
      stepStress(world, index);
      stepStress(continued!, index);
      if (index % 900 === 0) {
        checkCaps(world);
        checkCaps(continued!);
      }
    }
    expect(world.elapsed).toBeCloseTo(1200, 7);
    expect(continued).toEqual(world);
    expect(activeNewTypePopulation(world)).toBe(24);
    expect(world.sediment).toHaveLength(600);
    expect(world.lights).toHaveLength(32);
    expect(world.currents).toHaveLength(3);
    checkCaps(world);
  }, 120_000);
});
