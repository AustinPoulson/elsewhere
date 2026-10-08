import { describe, expect, it } from 'vitest';
import { addLight, createWorld, getStats, stepWorld } from '../src/world/simulation';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { FIXED_STEP, LIMITS, isInPool, type World } from '../src/world/types';

function run(world: World, steps: number): void {
  for (let i = 0; i < steps; i++) stepWorld(world);
}

describe('tidepool ecology', () => {
  it('is deterministic and resumes the same random sequence after a save', () => {
    const a = createWorld(42);
    const b = createWorld(42);
    expect(a).toEqual(b);
    expect(createWorld(43).organisms).not.toEqual(a.organisms);
    run(a, 400);
    run(b, 400);
    expect(a).toEqual(b);
    const restored = restoreWorld(serializeWorld(a));
    expect(restored).not.toBeNull();
    expect(restored).toEqual(a);
    addLight(a, 700, 510);
    addLight(restored!, 700, 510);
    run(a, 600);
    run(restored!, 600);
    expect(restored).toEqual(a);
  });

  it('steers toward light, consumes its energy, and leaves new pigment', () => {
    const world = createWorld(7);
    const creature = world.organisms[0];
    world.organisms = [creature];
    world.lights = [];
    world.sediment = [];
    world.grazers = [];
    world.nests = [];
    Object.assign(creature, { x: 570, y: 500, vx: -30, vy: 0, energy: 0.5, trail: [] });
    addLight(world, 740, 500);
    const initialDistance = Math.hypot(creature.x - 740, creature.y - 500);
    run(world, 150);
    expect(Math.hypot(creature.x - 740, creature.y - 500)).toBeLessThan(initialDistance * 0.65);
    run(world, 600);
    expect(world.consumed).toBeGreaterThan(5);
    expect(world.lights[0].energy).toBeLessThan(90 - 5);
    expect(creature.energy).toBeGreaterThan(0.5);
    expect(world.sediment.length).toBeGreaterThan(3);
    expect(getStats(world).pigment).toBeGreaterThan(0);
  });

  it('preserves the population through a long dark period while energy changes', () => {
    const world = createWorld(42);
    world.lights = [];
    const originalEnergy = world.organisms[0].energy;
    run(world, 30 * 180);
    expect(world.organisms).toHaveLength(24);
    expect(world.organisms[0].energy).toBeLessThan(originalEnergy);
    for (const creature of world.organisms) {
      expect(creature.energy).toBeGreaterThanOrEqual(0.12);
      expect(isInPool(creature.x, creature.y, creature.size + 3)).toBe(true);
      expect(creature.trail.length).toBeLessThanOrEqual(LIMITS.trail);
    }
  });

  it('stays bounded under sustained feeding and at the irregular coast', () => {
    const world = createWorld(123);
    Object.assign(world.organisms[0], { x: 720, y: 501, vx: 200, vy: -200 });
    for (let i = 0; i < 30 * 300; i++) {
      if (i % 10 === 0) addLight(world, 350 + (i % 700), 420 + Math.sin(i) * 100);
      stepWorld(world);
      expect(world.lights.length).toBeLessThanOrEqual(LIMITS.lights);
      expect(world.sediment.length).toBeLessThanOrEqual(LIMITS.sediment);
      for (const creature of world.organisms) {
        expect(isInPool(creature.x, creature.y, creature.size + 3)).toBe(true);
        expect(creature.trail.length).toBeLessThanOrEqual(LIMITS.trail);
        expect(Number.isFinite(creature.vx + creature.vy + creature.energy)).toBe(true);
      }
    }
    expect(world.consumed).toBeGreaterThan(100);
    expect(restoreWorld(serializeWorld(world))).not.toBeNull();
  }, 20_000);

  it('rejects outside coordinates and caps accepted lights', () => {
    const world = createWorld();
    expect(addLight(world, 0, 0)).toBe(false);
    expect(addLight(world, NaN, 500)).toBe(false);
    expect(addLight(world, 720, Infinity)).toBe(false);
    while (world.lights.length < LIMITS.lights) expect(addLight(world, 720, 500)).toBe(true);
    expect(addLight(world, 720, 500)).toBe(false);
    expect(world.lights).toHaveLength(LIMITS.lights);
    for (const dt of [0, -FIXED_STEP, NaN, Infinity, 1]) {
      expect(() => stepWorld(world, dt)).toThrow(RangeError);
    }
    expect(() => createWorld(NaN)).toThrow(RangeError);
  });
});

describe('versioned local snapshots', () => {
  it('rejects malformed, incompatible, incomplete, and excessive payloads', () => {
    for (const payload of ['', '{', 'null', '[]', '{}', '"text"', '1'.repeat(1_000_001)]) {
      expect(restoreWorld(payload)).toBeNull();
    }
    const mutations: ((world: World) => void)[] = [
      (world) => { (world as { version: number }).version = 3; },
      (world) => { world.elapsed = -1; },
      (world) => { world.randomState = -1; },
      (world) => { world.consumed = Infinity; },
      (world) => { world.organisms[0].x = 0; },
      (world) => { world.organisms[0].hue = 360; },
      (world) => { world.organisms[0].energy = 10; },
      (world) => { world.organisms[0].trail = Array.from({ length: LIMITS.trail + 1 }, () => ({ x: 720, y: 500 })); },
      (world) => { world.organisms = []; },
      (world) => { world.organisms.push(...Array.from({ length: LIMITS.organisms }, () => world.organisms[0])); },
      (world) => { world.lights[0].energy = world.lights[0].initialEnergy + 1; },
      (world) => { world.sediment[0].radius = -1; },
      (world) => { world.sediment[0].id = world.organisms[0].id; },
      (world) => { world.nextId = 1; },
    ];
    for (const mutate of mutations) {
      const world = createWorld();
      mutate(world);
      expect(restoreWorld(serializeWorld(world))).toBeNull();
    }
  });
});
