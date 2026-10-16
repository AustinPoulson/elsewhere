import { describe, expect, it } from 'vitest';
import { addLight, createWorld, releaseNestPigment, stepWorld } from '../src/world/simulation';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { LIMITS, WORLD_HEIGHT, WORLD_WIDTH, isInPool, poolRadius, type World } from '../src/world/types';

function run(world: World, steps: number): void {
  for (let i = 0; i < steps; i++) stepWorld(world);
}

function pigmentMass(world: World): number {
  return world.sediment.reduce((total, grain) => total + grain.strength, 0)
    + world.grazers.reduce((total, grazer) => total + grazer.cargo, 0)
    + world.nests.reduce((total, nest) => total + nest.pigment, 0);
}

function withSedimentCount(count: number): World {
  const world = createWorld(71);
  world.sediment = Array.from({ length: count }, () => ({
    id: world.nextId++, x: 720, y: 500, radius: 4, hue: 214, strength: 0.3, age: 0,
  }));
  world.nests[0].pigment = 3;
  return world;
}

describe('nest pigment release', () => {
  it('transfers at most three pigment into six existing-shape grains without changing the other ecology', () => {
    const world = createWorld(71);
    const nest = world.nests[0];
    Object.assign(nest, { x: 720, y: 500, pigment: 7.5, hue: 312.5 });
    world.tick = 37;
    const before = JSON.parse(serializeWorld(world)) as World;
    const mass = pigmentMass(world);
    const originalSediment = world.sediment.slice();
    const result = releaseNestPigment(world, nest.id);
    expect(result).toEqual({ status: 'released', amount: 3 });
    expect(nest.pigment).toBe(4.5);
    expect(pigmentMass(world)).toBeCloseTo(mass, 12);
    expect(world.nextId).toBe(before.nextId + 6);
    expect(world.sediment.slice(0, originalSediment.length)).toEqual(before.sediment);
    originalSediment.forEach((grain, index) => expect(world.sediment[index]).toBe(grain));
    const released = world.sediment.slice(originalSediment.length);
    expect(released).toHaveLength(6);
    released.forEach((grain, index) => {
      expect(grain.id).toBe(before.nextId + index);
      expect(grain).toMatchObject({ radius: 9, hue: 312.5, strength: 0.5, age: 0 });
      const distance = Math.hypot(grain.x - nest.x, grain.y - nest.y);
      expect(distance).toBeGreaterThanOrEqual(44 - 1e-10);
      expect(distance).toBeLessThanOrEqual(58 + 1e-10);
      expect(isInPool(grain.x, grain.y, 12)).toBe(true);
    });
    expect(world).toEqual({
      ...before,
      nextId: before.nextId + 6,
      sediment: [...before.sediment, ...released],
      nests: before.nests.map((entry) => entry.id === nest.id ? { ...entry, pigment: 4.5 } : entry),
    });
    expect(restoreWorld(serializeWorld(world))).toEqual(world);
  });

  it('accepts the minimum useful pigment and keeps every coastal grain inside its margin with unique IDs', () => {
    const world = createWorld(72);
    world.sediment = [];
    const nest = world.nests[0];
    nest.pigment = 0.18;
    expect(releaseNestPigment(world, nest.id)).toEqual({ status: 'released', amount: 0.18 });
    expect(nest.pigment).toBe(0);
    expect(world.sediment).toHaveLength(6);
    world.sediment.forEach((grain) => expect(grain.strength).toBeCloseTo(0.03, 14));

    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;
      const radius = poolRadius(angle) * 0.999999;
      Object.assign(nest, {
        x: WORLD_WIDTH / 2 + Math.cos(angle) * radius * (610 - 18),
        y: WORLD_HEIGHT / 2 + Math.sin(angle) * radius * (400 - 18),
        pigment: 3,
      });
      world.tick = i * 123;
      const firstId = world.nextId;
      expect(releaseNestPigment(world, nest.id).status).toBe('released');
      world.sediment.slice(-6).forEach((grain, index) => {
        expect(isInPool(grain.x, grain.y, 12)).toBe(true);
        expect(grain.id).toBe(firstId + index);
      });
    }
    const ids = [
      ...world.organisms, ...world.lights, ...world.sediment, ...world.grazers, ...world.nests,
    ].map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(restoreWorld(serializeWorld(world))).toEqual(world);
  });

  it('refuses missing, empty, crowded, and exhausted-ID requests atomically', () => {
    const world = createWorld();
    const beforeMissing = serializeWorld(world);
    expect(releaseNestPigment(world, -1)).toEqual({ status: 'missing', amount: 0 });
    expect(releaseNestPigment(world, NaN)).toEqual({ status: 'missing', amount: 0 });
    expect(serializeWorld(world)).toBe(beforeMissing);
    for (const pigment of [0, 0.17, 0.18 - Number.EPSILON]) {
      world.nests[0].pigment = pigment;
      const beforeEmpty = serializeWorld(world);
      expect(releaseNestPigment(world, world.nests[0].id)).toEqual({ status: 'empty', amount: 0 });
      expect(serializeWorld(world)).toBe(beforeEmpty);
    }
    for (let count = LIMITS.sediment - 5; count <= LIMITS.sediment; count++) {
      const crowded = withSedimentCount(count);
      const beforeFull = serializeWorld(crowded);
      expect(releaseNestPigment(crowded, crowded.nests[0].id)).toEqual({ status: 'full', amount: 0 });
      expect(serializeWorld(crowded)).toBe(beforeFull);
    }
    world.nests[0].pigment = 3;
    world.nextId = Number.MAX_SAFE_INTEGER - 5;
    const beforeIDs = serializeWorld(world);
    expect(releaseNestPigment(world, world.nests[0].id)).toEqual({ status: 'full', amount: 0 });
    expect(serializeWorld(world)).toBe(beforeIDs);
    world.nextId = Number.MAX_SAFE_INTEGER - 6;
    expect(releaseNestPigment(world, world.nests[0].id).status).toBe('released');
    expect(world.nextId).toBe(Number.MAX_SAFE_INTEGER);
    expect(restoreWorld(serializeWorld(world))).toEqual(world);
  });

  it('uses exactly six free slots without evicting existing pigment and remains bounded on repeated requests', () => {
    const crowded = withSedimentCount(LIMITS.sediment - 6);
    const original = crowded.sediment.slice();
    expect(releaseNestPigment(crowded, crowded.nests[0].id).status).toBe('released');
    expect(crowded.sediment).toHaveLength(LIMITS.sediment);
    original.forEach((grain, index) => expect(crowded.sediment[index]).toBe(grain));

    const world = createWorld(73);
    world.sediment = [];
    const nest = world.nests[0];
    nest.pigment = 12;
    const mass = pigmentMass(world);
    const firstId = world.nextId;
    let released = 0;
    for (let i = 0; i < 200; i++) {
      const result = releaseNestPigment(world, nest.id);
      if (result.status === 'released') released++;
      expect(pigmentMass(world)).toBeCloseTo(mass, 12);
      expect(world.sediment.length).toBeLessThanOrEqual(LIMITS.sediment);
      expect(nest.pigment).toBeGreaterThanOrEqual(0);
    }
    expect(released).toBe(4);
    expect(world.sediment).toHaveLength(24);
    expect(world.nextId).toBe(firstId + 24);
    expect(nest.pigment).toBe(0);
  });

  it('lets the existing grazer gather released grains and carry their color back to the nest', () => {
    const world = createWorld(74);
    world.organisms = [world.organisms[0]];
    world.lights = [];
    world.sediment = [];
    world.grazers = [world.grazers[0]];
    world.nests = [world.nests[0]];
    const nest = world.nests[0];
    Object.assign(nest, { x: 720, y: 500, pigment: 3, hue: 276 });
    Object.assign(world.grazers[0], { x: nest.x, y: nest.y, vx: 0, vy: 0, cargo: 0, returning: false });
    const randomState = world.randomState;
    expect(releaseNestPigment(world, nest.id)).toEqual({ status: 'released', amount: 3 });
    expect(nest.pigment).toBe(0);
    let previousMass = pigmentMass(world);
    let sawLoaded = false;
    let sawDelivered = false;
    for (let i = 0; i < 30 * 90; i++) {
      stepWorld(world);
      const mass = pigmentMass(world);
      expect(mass).toBeLessThanOrEqual(previousMass + 1e-10);
      previousMass = mass;
      sawLoaded ||= world.grazers[0].cargo > 0.3;
      sawDelivered ||= nest.pigment > 0.75;
      expect(isInPool(world.grazers[0].x, world.grazers[0].y, world.grazers[0].size + 3)).toBe(true);
    }
    expect(sawLoaded).toBe(true);
    expect(sawDelivered).toBe(true);
    expect(nest.pigment).toBeGreaterThan(2);
    expect(world.grazers[0].hue).toBeCloseTo(276, 10);
    expect(world.randomState).toBe(randomState);
    expect(world.consumed).toBe(0);
    expect(world.lights).toHaveLength(0);
    expect(restoreWorld(serializeWorld(world))).toEqual(world);
  });

  it('keeps release positions and v2 continuation deterministic across snapshots', () => {
    const world = createWorld(75);
    run(world, 1200);
    const nest = world.nests[0];
    nest.pigment = 4;
    expect(releaseNestPigment(world, nest.id).status).toBe('released');
    const restored = restoreWorld(serializeWorld(world));
    expect(restored).toEqual(world);
    expect(releaseNestPigment(world, nest.id)).toEqual(releaseNestPigment(restored!, nest.id));
    expect(restored).toEqual(world);
    addLight(world, 740, 500);
    addLight(restored!, 740, 500);
    run(world, 1800);
    run(restored!, 1800);
    expect(restored).toEqual(world);
    expect(restoreWorld(serializeWorld(world))).toEqual(world);
    expect(world.version).toBe(3);
  });

  it('preserves v1 migration state and supports release using the existing v2 schema', () => {
    const legacy = createWorld(76);
    legacy.nextId = Math.min(...legacy.grazers.map((entry) => entry.id), ...legacy.nests.map((entry) => entry.id));
    legacy.grazers = [];
    legacy.nests = [];
    run(legacy, 1020);
    const { grazers: _grazers, nests: _nests, schemaRevision: _revision, weatherCall: _call, ...fields } = legacy;
    const restored = restoreWorld(JSON.stringify({ ...fields, version: 1 }));
    expect(restored).not.toBeNull();
    expect(restored!.elapsed).toBe(legacy.elapsed);
    expect(restored!.tick).toBe(legacy.tick);
    expect(restored!.randomState).toBe(legacy.randomState);
    expect(restored!.organisms).toEqual(legacy.organisms);
    expect(restored!.lights).toEqual(legacy.lights);
    expect(restored!.sediment).toEqual(legacy.sediment);
    expect(restored!.consumed).toBe(legacy.consumed);
    const nest = restored!.nests[0];
    const beforeEmpty = serializeWorld(restored!);
    expect(releaseNestPigment(restored!, nest.id)).toEqual({ status: 'empty', amount: 0 });
    expect(serializeWorld(restored!)).toBe(beforeEmpty);
    nest.pigment = 0.75;
    const beforeMass = pigmentMass(restored!);
    expect(releaseNestPigment(restored!, nest.id)).toEqual({ status: 'released', amount: 0.75 });
    expect(pigmentMass(restored!)).toBeCloseTo(beforeMass, 12);
    expect(restored!.elapsed).toBe(legacy.elapsed);
    expect(restored!.tick).toBe(legacy.tick);
    expect(restored!.randomState).toBe(legacy.randomState);
    const resumed = restoreWorld(serializeWorld(restored!));
    expect(resumed).toEqual(restored);
    run(restored!, 900);
    run(resumed!, 900);
    expect(resumed).toEqual(restored);
  });
});
