import { describe, expect, it } from 'vitest';
import { addLight, createWorld, getStats, initializeGrazers, stepWorld } from '../src/world/simulation';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import {
  GRAZER_CAPACITY, LIMITS, NEST_CAPACITY, WORLD_HEIGHT, WORLD_WIDTH, isInPool, poolRadius,
  type World,
} from '../src/world/types';

function run(world: World, steps: number): void {
  for (let i = 0; i < steps; i++) stepWorld(world);
}

function isolatedGrazer(): World {
  const world = createWorld(71);
  world.organisms = [world.organisms[0]];
  world.lights = [];
  world.sediment = [];
  world.grazers = [world.grazers[0]];
  world.nests = [world.nests[0]];
  Object.assign(world.grazers[0], { x: 570, y: 500, vx: -10, vy: 0, cargo: 0, returning: false });
  Object.assign(world.nests[0], { x: 770, y: 500, pigment: 0 });
  return world;
}

function addPigment(world: World, x: number, y: number, strength = 0.9, hue = 214): void {
  world.sediment.push({ id: world.nextId++, x, y, radius: 5, strength, hue, age: 0 });
}

function pigmentMass(world: World): number {
  return world.sediment.reduce((total, deposit) => total + deposit.strength, 0)
    + world.grazers.reduce((total, grazer) => total + grazer.cargo, 0)
    + world.nests.reduce((total, nest) => total + nest.pigment, 0);
}

function legacyPayload(world: World): string {
  const { grazers: _grazers, nests: _nests, ...legacy } = world;
  return JSON.stringify({ ...legacy, version: 1 });
}

describe('pigment grazers', () => {
  it('initializes four coast-safe grazers without changing the old ecology or its PRNG', () => {
    for (const seed of [0, 1, 71, 0xffffffff]) {
      const world = createWorld(seed);
      const original = {
        randomState: world.randomState, elapsed: world.elapsed, tick: world.tick,
        organisms: world.organisms, lights: world.lights, sediment: world.sediment,
      };
      world.grazers = [];
      world.nests = [];
      const firstId = world.nextId;
      initializeGrazers(world);
      expect(world.randomState).toBe(original.randomState);
      expect(world.elapsed).toBe(original.elapsed);
      expect(world.tick).toBe(original.tick);
      expect(world.organisms).toBe(original.organisms);
      expect(world.lights).toBe(original.lights);
      expect(world.sediment).toBe(original.sediment);
      expect(world.grazers).toHaveLength(4);
      expect(world.nests).toHaveLength(4);
      expect(world.nextId).toBe(firstId + 8);
      for (const grazer of world.grazers) {
        const nest = world.nests.find((entry) => entry.id === grazer.nestId)!;
        expect(isInPool(grazer.x, grazer.y, grazer.size + 3)).toBe(true);
        expect(isInPool(nest.x, nest.y, 18)).toBe(true);
        expect(Math.hypot(nest.x - grazer.x, nest.y - grazer.y)).toBeGreaterThan(70);
        expect(Math.hypot(nest.x - grazer.x, nest.y - grazer.y)).toBeLessThan(110);
        expect(grazer.cargo).toBe(0);
        expect(nest.pigment).toBe(0);
      }
      const initialized = serializeWorld(world);
      initializeGrazers(world);
      expect(serializeWorld(world)).toBe(initialized);
      expect(restoreWorld(initialized)).toEqual(world);
    }
  });

  it('seeks sediment and carries its color and strength away', () => {
    const world = isolatedGrazer();
    const grazer = world.grazers[0];
    addPigment(world, 630, 500);
    const distance = Math.hypot(grazer.x - 630, grazer.y - 500);
    run(world, 100);
    expect(Math.hypot(grazer.x - 630, grazer.y - 500)).toBeLessThan(distance * 0.75);
    run(world, 150);
    expect(grazer.cargo).toBeGreaterThan(0.5);
    expect(grazer.hue).toBeCloseTo(214, 10);
    expect(world.sediment.reduce((total, deposit) => total + deposit.strength, 0)).toBeLessThan(0.3);
    expect(grazer.returning).toBe(true);
    expect(world.nests[0].pigment).toBe(0);
  });

  it('returns loaded cargo to its own nest and blends hue across the color-wheel seam', () => {
    const world = isolatedGrazer();
    const grazer = world.grazers[0];
    const nest = world.nests[0];
    Object.assign(grazer, { x: 660, y: 500, vx: 0, vy: 0, cargo: GRAZER_CAPACITY, hue: 10, returning: true });
    run(world, 30);
    expect(grazer.x).toBeGreaterThan(660);
    expect(grazer.cargo).toBe(GRAZER_CAPACITY);
    expect(nest.pigment).toBe(0);
    run(world, 30 * 10);
    expect(grazer.cargo).toBe(0);
    expect(grazer.returning).toBe(false);
    expect(nest.pigment).toBeGreaterThan(1.1);
    expect(nest.hue).toBe(10);

    Object.assign(grazer, { x: nest.x, y: nest.y, vx: 0, vy: 0, cargo: 0.3, hue: 10, returning: true });
    Object.assign(nest, { pigment: 0.3, hue: 350 });
    stepWorld(world);
    expect(Math.min(nest.hue, 360 - nest.hue)).toBeLessThan(1e-8);
  });

  it('retains excess cargo at a full nest instead of creating or losing pigment', () => {
    const world = isolatedGrazer();
    const grazer = world.grazers[0];
    const nest = world.nests[0];
    Object.assign(grazer, { x: nest.x, y: nest.y, vx: 0, vy: 0, cargo: 0.6, returning: true });
    nest.pigment = NEST_CAPACITY - 0.2;
    const before = pigmentMass(world);
    stepWorld(world);
    expect(grazer.cargo).toBeCloseTo(0.4, 10);
    expect(grazer.returning).toBe(true);
    expect(nest.pigment).toBeLessThanOrEqual(NEST_CAPACITY);
    expect(pigmentMass(world)).toBeLessThan(before);
    expect(pigmentMass(world)).toBeGreaterThan(before - 0.001);
    expect(restoreWorld(serializeWorld(world))).not.toBeNull();
  });

  it('transfers existing pigment through cargo into nests without increasing total mass', () => {
    const world = isolatedGrazer();
    Object.assign(world.grazers[0], { x: 650, y: 500, vx: 0, vy: 0 });
    addPigment(world, 650, 500, 0.9, 180);
    addPigment(world, 654, 503, 0.9, 280);
    let previous = pigmentMass(world);
    let sawLoaded = false;
    let sawNest = false;
    for (let i = 0; i < 30 * 40; i++) {
      stepWorld(world);
      const mass = pigmentMass(world);
      expect(mass).toBeLessThanOrEqual(previous + 1e-10);
      expect(mass).toBeGreaterThanOrEqual(0);
      previous = mass;
      sawLoaded ||= world.grazers[0].cargo > 0.7;
      sawNest ||= world.nests[0].pigment > 1;
    }
    expect(sawLoaded).toBe(true);
    expect(sawNest).toBe(true);
    expect(world.nests[0].pigment).toBeGreaterThan(1.4);
    expect(world.sediment).toHaveLength(0);
  });

  it('stays bounded and finite through ten minutes of feeding and a coastal bounce', () => {
    const world = createWorld(123);
    const grazer = world.grazers[0];
    const angle = -0.5;
    const radius = poolRadius(angle) * 0.998;
    const margin = grazer.size + 3;
    Object.assign(grazer, {
      x: WORLD_WIDTH / 2 + Math.cos(angle) * radius * (610 - margin),
      y: WORLD_HEIGHT / 2 + Math.sin(angle) * radius * (400 - margin),
      vx: Math.cos(angle) * 80, vy: Math.sin(angle) * 80,
    });
    for (let i = 0; i < 30 * 600; i++) {
      if (i % 120 === 0) {
        addLight(world, 470, 390);
        addLight(world, 825, 285);
        addLight(world, 1040, 610);
        addLight(world, 660, 730);
      }
      stepWorld(world);
      // Check every tick, keeping assertion overhead out of this long-run budget.
      for (const current of world.grazers) {
        if (!isInPool(current.x, current.y, current.size + 3)
          || !Number.isFinite(current.vx + current.vy + current.cargo + current.age)
          || current.cargo < 0 || current.cargo > GRAZER_CAPACITY) throw new Error(`Invalid grazer at tick ${i}`);
      }
      if (world.nests.some((nest) => !isInPool(nest.x, nest.y, 18)
        || !Number.isFinite(nest.pigment) || nest.pigment < 0 || nest.pigment > NEST_CAPACITY)
        || world.sediment.length > LIMITS.sediment || world.lights.length > LIMITS.lights
        || world.grazers.length > LIMITS.grazers || world.nests.length > LIMITS.nests) {
        throw new Error(`Invalid ecology at tick ${i}`);
      }
    }
    expect(world.grazers).toHaveLength(4);
    expect(getStats(world).nestPigment).toBeGreaterThan(5);
    expect(restoreWorld(serializeWorld(world))).toEqual(world);
  }, 20_000);
});

describe('v2 grazer snapshots', () => {
  it('migrates opening and evolved v1 saves, preserves old state, and resumes deterministically', () => {
    for (const steps of [0, 30 * 180]) {
      const legacy = createWorld(91);
      legacy.nextId = Math.min(...legacy.grazers.map((entry) => entry.id), ...legacy.nests.map((entry) => entry.id));
      legacy.grazers = [];
      legacy.nests = [];
      for (let i = 0; i < steps; i++) {
        if (i % 300 === 0) addLight(legacy, 700, 510);
        stepWorld(legacy);
      }
      const migrated = restoreWorld(legacyPayload(legacy));
      expect(migrated).not.toBeNull();
      expect(migrated!.version).toBe(2);
      expect(migrated!.elapsed).toBe(legacy.elapsed);
      expect(migrated!.tick).toBe(legacy.tick);
      expect(migrated!.randomState).toBe(legacy.randomState);
      expect(migrated!.organisms).toEqual(legacy.organisms);
      expect(migrated!.lights).toEqual(legacy.lights);
      expect(migrated!.sediment).toEqual(legacy.sediment);
      expect(migrated!.consumed).toBe(legacy.consumed);
      expect(migrated!.nextId).toBe(legacy.nextId + 8);
      expect(migrated!.grazers.every((entry) => entry.id >= legacy.nextId)).toBe(true);
      expect(migrated!.nests.every((entry) => entry.id >= legacy.nextId)).toBe(true);
      if (steps > 0) expect(legacy.nextId).toBeGreaterThan(100);
      const resumed = restoreWorld(serializeWorld(migrated!));
      expect(resumed).toEqual(migrated);
      addLight(migrated!, 700, 510);
      addLight(resumed!, 700, 510);
      run(migrated!, 900);
      run(resumed!, 900);
      expect(resumed).toEqual(migrated);
      expect(restoreWorld(serializeWorld(migrated!))).toEqual(migrated);
    }
  });

  it('rejects corrupted entities, broken nest references, caps, and unsafe v1 migration IDs', () => {
    const mutations: ((world: World) => void)[] = [
      (world) => { delete (world as unknown as { grazers?: unknown }).grazers; },
      (world) => { delete (world as unknown as { nests?: unknown }).nests; },
      (world) => { world.grazers[0].cargo = -0.1; },
      (world) => { world.grazers[0].cargo = GRAZER_CAPACITY + 0.1; },
      (world) => { world.grazers[0].cargo = NaN; },
      (world) => { world.grazers[0].cargo = GRAZER_CAPACITY; },
      (world) => { world.grazers[0].returning = true; },
      (world) => { world.grazers[0].nestId = world.organisms[0].id; },
      (world) => { world.grazers[0].id = world.nests[0].id; },
      (world) => { world.grazers[0].x = 0; },
      (world) => { world.grazers[0].phase = Infinity; },
      (world) => { world.grazers[0].size = 100; },
      (world) => { (world.grazers[0] as unknown as { returning: unknown }).returning = 'yes'; },
      (world) => { (world.grazers[0] as unknown as { species: string }).species = 'lucent'; },
      (world) => { world.nests[0].pigment = NEST_CAPACITY + 0.1; },
      (world) => { world.nests[0].pigment = -0.1; },
      (world) => { world.nests[0].hue = 360; },
      (world) => { world.nests[0].x = 0; },
      (world) => { world.grazers.push(...Array.from({ length: LIMITS.grazers }, () => world.grazers[0])); },
      (world) => { world.nests.push(...Array.from({ length: LIMITS.nests }, () => world.nests[0])); },
    ];
    for (const mutate of mutations) {
      const world = createWorld();
      mutate(world);
      expect(restoreWorld(serializeWorld(world))).toBeNull();
    }
    const legacy = createWorld();
    legacy.nextId = Number.MAX_SAFE_INTEGER - 7;
    expect(restoreWorld(legacyPayload(legacy))).toBeNull();
    const brokenLegacy = JSON.parse(legacyPayload(createWorld())) as { organisms: { x: number }[] };
    brokenLegacy.organisms[0].x = 0;
    expect(restoreWorld(JSON.stringify(brokenLegacy))).toBeNull();
  });
});
