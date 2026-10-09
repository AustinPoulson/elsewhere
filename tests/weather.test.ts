import { describe, expect, it } from 'vitest';
import { addLight, createWorld, getStats, stepWorld } from '../src/world/simulation';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { CALM_LIGHT_REACH, getLightReach, getWeather } from '../src/world/weather';
import { FIXED_STEP, GRAZER_CAPACITY, LIMITS, NEST_CAPACITY, isInPool, type World } from '../src/world/types';

function run(world: World, steps: number): void {
  for (let i = 0; i < steps; i++) stepWorld(world);
}

function feedingWorld(elapsed: number): World {
  const world = createWorld(42);
  world.organisms = [world.organisms[0]];
  world.lights = [];
  world.sediment = [];
  world.grazers = [];
  world.nests = [];
  world.elapsed = elapsed;
  world.tick = 30; // The next feeding tick also exercises normal pigment deposition.
  Object.assign(world.organisms[0], { x: 630, y: 500, vx: 0, vy: 0, energy: 0.5, trail: [] });
  addLight(world, 720, 500);
  return world;
}

describe('derived rain', () => {
  it('starts after thirty seconds, fades for six seconds, and repeats every three minutes', () => {
    expect(getWeather(0)).toEqual({ intensity: 0, raining: false, secondsUntilChange: 30 });
    expect(getWeather(29.5)).toEqual({ intensity: 0, raining: false, secondsUntilChange: 0.5 });
    expect(getWeather(30)).toEqual({ intensity: 0, raining: true, secondsUntilChange: 38 });
    expect(getWeather(31.5).intensity).toBeCloseTo(0.15625, 12);
    expect(getWeather(33).intensity).toBe(0.5);
    expect(getWeather(34.5).intensity).toBeCloseTo(0.84375, 12);
    expect(getWeather(36)).toEqual({ intensity: 1, raining: true, secondsUntilChange: 32 });
    expect(getWeather(62).intensity).toBe(1);
    expect(getWeather(63.5).intensity).toBeCloseTo(0.84375, 12);
    expect(getWeather(65).intensity).toBe(0.5);
    expect(getWeather(66.5).intensity).toBeCloseTo(0.15625, 12);
    expect(getWeather(68)).toEqual({ intensity: 0, raining: false, secondsUntilChange: 142 });
    expect(getWeather(179.5)).toEqual({ intensity: 0, raining: false, secondsUntilChange: 30.5 });
    for (const elapsed of [0, 14.5, 30, 33, 45, 65, 68, 179.5]) {
      expect(getWeather(elapsed + 180)).toEqual(getWeather(elapsed));
      expect(getWeather(elapsed + 360)).toEqual(getWeather(elapsed));
    }
    expect(getLightReach(0)).toBe(CALM_LIGHT_REACH);
    expect(getLightReach(33)).toBe(88);
    expect(getLightReach(45)).toBe(112);
    expect(getLightReach(68)).toBe(CALM_LIGHT_REACH);
  });

  it('stays continuous and bounded at the weather boundaries and rejects invalid time', () => {
    for (const boundary of [30, 36, 62, 68, 180, 210]) {
      expect(Math.abs(getWeather(boundary - 1e-6).intensity - getWeather(boundary + 1e-6).intensity)).toBeLessThan(1e-10);
    }
    for (let elapsed = 0; elapsed < 720; elapsed += 0.5) {
      const weather = getWeather(elapsed);
      expect(weather.intensity).toBeGreaterThanOrEqual(0);
      expect(weather.intensity).toBeLessThanOrEqual(1);
      expect(weather.secondsUntilChange).toBeGreaterThan(0);
      expect(getLightReach(elapsed)).toBeGreaterThanOrEqual(64);
      expect(getLightReach(elapsed)).toBeLessThanOrEqual(112);
    }
    for (const elapsed of [-1, NaN, Infinity, -Infinity]) {
      expect(() => getWeather(elapsed)).toThrow(RangeError);
      expect(() => getLightReach(elapsed)).toThrow(RangeError);
    }
  });
});

describe('rain diffuses existing light', () => {
  it('feeds and orbits at ninety pixels in rain while drawing normal resource energy and pigment', () => {
    const calm = feedingWorld(10);
    const rain = feedingWorld(45);
    const initialLight = rain.lights[0].energy;
    stepWorld(calm);
    stepWorld(rain);
    expect(calm.consumed).toBe(0);
    expect(calm.organisms[0].energy).toBeLessThan(0.5);
    expect(calm.sediment).toHaveLength(0);
    expect(rain.consumed).toBeGreaterThan(0);
    expect(rain.organisms[0].energy).toBeGreaterThan(0.5);
    expect(initialLight - rain.lights[0].energy).toBeCloseTo(rain.consumed + FIXED_STEP * 0.045, 10);
    expect(rain.organisms[0].energy - 0.5).toBeCloseTo(rain.consumed * 0.065 - FIXED_STEP * 0.008, 10);
    expect(rain.sediment).toHaveLength(1);
    expect(rain.sediment[0].strength).toBeGreaterThan(0.27);
    expect(rain.sediment[0].strength).toBeLessThan(0.57);
    expect(rain.organisms[0].vy).toBeGreaterThan(calm.organisms[0].vy * 4);
    expect(rain.organisms[0].vx).toBeLessThan(calm.organisms[0].vx);
    expect(rain.lights[0].initialEnergy).toBe(initialLight);
  });

  it('creates no light, energy, pigment, or random draws without a light source', () => {
    const world = createWorld(17);
    world.lights = [];
    world.sediment = [];
    world.grazers = [];
    world.nests = [];
    const initialEnergy = world.organisms.map((entry) => entry.energy);
    const randomState = world.randomState;
    const nextId = world.nextId;
    run(world, 30 * 400);
    expect(world.lights).toHaveLength(0);
    expect(world.sediment).toHaveLength(0);
    expect(world.consumed).toBe(0);
    expect(getStats(world).light).toBe(0);
    expect(world.randomState).toBe(randomState);
    expect(world.nextId).toBe(nextId);
    for (let i = 0; i < world.organisms.length; i++) expect(world.organisms[i].energy).toBeLessThan(initialEnergy[i]);
  });

  it('keeps both species and resource collections bounded across four complete rain cycles', () => {
    const world = createWorld(108);
    let sawRain = false;
    let sawCalm = false;
    for (let i = 0; i < 30 * 720; i++) {
      if (i % 180 === 0) {
        addLight(world, 470, 390);
        addLight(world, 825, 285);
        addLight(world, 1040, 610);
        addLight(world, 660, 730);
      }
      stepWorld(world);
      const weather = getWeather(world.elapsed);
      sawRain ||= weather.intensity > 0.9;
      sawCalm ||= !weather.raining;
      for (const organism of world.organisms) {
        if (!isInPool(organism.x, organism.y, organism.size + 3)
          || !Number.isFinite(organism.vx + organism.vy + organism.energy)
          || organism.energy < 0.12 || organism.energy > 2 || organism.trail.length > LIMITS.trail) {
          throw new Error(`Invalid lucent at rain tick ${i}`);
        }
      }
      for (const grazer of world.grazers) {
        if (!isInPool(grazer.x, grazer.y, grazer.size + 3)
          || !Number.isFinite(grazer.vx + grazer.vy + grazer.cargo)
          || grazer.cargo < 0 || grazer.cargo > GRAZER_CAPACITY) throw new Error(`Invalid grazer at rain tick ${i}`);
      }
      if (world.lights.length > LIMITS.lights || world.sediment.length > LIMITS.sediment
        || world.organisms.length > LIMITS.organisms || world.grazers.length > LIMITS.grazers
        || world.nests.length > LIMITS.nests
        || world.lights.some((light) => !Number.isFinite(light.energy) || light.energy < 0 || light.energy > light.initialEnergy)
        || world.sediment.some((deposit) => !Number.isFinite(deposit.strength) || deposit.strength < 0 || deposit.strength > 1)
        || world.nests.some((nest) => !Number.isFinite(nest.pigment) || nest.pigment < 0 || nest.pigment > NEST_CAPACITY)) {
        throw new Error(`Invalid resource collection at rain tick ${i}`);
      }
    }
    expect(sawRain && sawCalm).toBe(true);
    expect(world.organisms).toHaveLength(24);
    expect(world.grazers).toHaveLength(4);
    expect(world.consumed).toBeGreaterThan(100);
    expect(restoreWorld(serializeWorld(world))).toEqual(world);
  }, 20_000);
});

describe('weather and existing snapshots', () => {
  it('restores mid-rain v2 saves without new schema fields and continues deterministically', () => {
    const world = createWorld(333);
    run(world, 30 * 45);
    addLight(world, 750, 500);
    expect(getWeather(world.elapsed).intensity).toBe(1);
    const snapshot = serializeWorld(world);
    expect(JSON.parse(snapshot)).not.toHaveProperty('weather');
    const restored = restoreWorld(snapshot);
    expect(restored).toEqual(world);
    expect(getWeather(restored!.elapsed)).toEqual(getWeather(world.elapsed));
    run(world, 30 * 200);
    run(restored!, 30 * 200);
    expect(restored).toEqual(world);
    expect(restored!.version).toBe(2);
  });

  it('preserves mid-rain v1 state and PRNG during the existing grazer migration', () => {
    const legacy = createWorld(334);
    legacy.nextId = Math.min(...legacy.grazers.map((entry) => entry.id), ...legacy.nests.map((entry) => entry.id));
    legacy.grazers = [];
    legacy.nests = [];
    run(legacy, 30 * 45);
    const { grazers: _grazers, nests: _nests, ...fields } = legacy;
    const snapshot = JSON.stringify({ ...fields, version: 1 });
    const restored = restoreWorld(snapshot);
    expect(restored).not.toBeNull();
    expect(restored!.version).toBe(2);
    expect(restored!.elapsed).toBe(legacy.elapsed);
    expect(restored!.tick).toBe(legacy.tick);
    expect(restored!.randomState).toBe(legacy.randomState);
    expect(restored!.organisms).toEqual(legacy.organisms);
    expect(restored!.lights).toEqual(legacy.lights);
    expect(restored!.sediment).toEqual(legacy.sediment);
    expect(restored!.consumed).toBe(legacy.consumed);
    expect(getWeather(restored!.elapsed)).toEqual(getWeather(legacy.elapsed));
    const resumed = restoreWorld(serializeWorld(restored!));
    run(restored!, 900);
    run(resumed!, 900);
    expect(resumed).toEqual(restored);
  });
});
