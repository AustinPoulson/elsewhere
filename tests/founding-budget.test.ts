import { describe, expect, it } from 'vitest';
import { createWorld } from '../src/world/simulation';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { NORMAL_FOUNDER_COUNT, runNormalFounding, tryEventFounding } from '../src/world/species/founding';
import type { Sediment, World } from '../src/world/types';

function empty(): World {
  const world = createWorld(26);
  world.organisms = [];
  world.grazers = [];
  world.nests = [];
  world.lights = [];
  world.sediment = [];
  return world;
}

describe('shared founding budget', () => {
  it('rotates one registered type per six-tick phase, including refusals, without resources or random draws', () => {
    const world = empty();
    const beforeId = world.nextId;
    const beforeRandom = world.randomState;
    expect(NORMAL_FOUNDER_COUNT).toBe(6);
    for (let phase = 1; phase <= 10; phase++) {
      world.tick = phase * 6;
      expect(runNormalFounding(world)).toBe(false);
      expect(world.foundingTypeCursor).toBe(phase % NORMAL_FOUNDER_COUNT);
      expect(world.nextFoundingTick).toBe(0);
    }
    expect(world.nextId).toBe(beforeId);
    expect(world.randomState).toBe(beforeRandom);
    world.tick++;
    expect(runNormalFounding(world)).toBe(false);
    expect(world.foundingTypeCursor).toBe(10 % NORMAL_FOUNDER_COUNT);
  });

  it('admits at most one paid body per six ticks and shares the slot with an off-phase event', () => {
    const world = empty();
    world.nests = [{ id: world.nextId++, x: 720, y: 500, hue: 180, pigment: 0.6, age: 0 }];
    world.tick = 6;
    expect(runNormalFounding(world)).toBe(true);
    expect(world.skimmers).toHaveLength(1);
    expect(world.nests[0].pigment).toBe(0);
    expect(world.nextFoundingTick).toBe(12);
    let offers = 0;
    world.tick = 7;
    expect(
      tryEventFounding(world, () => {
        offers++;
        return true;
      }),
    ).toBe(false);
    expect(offers).toBe(0);
    world.tick = 12;
    expect(
      tryEventFounding(world, () => {
        offers++;
        return false;
      }),
    ).toBe(false);
    expect(offers).toBe(1);
    expect(world.nextFoundingTick).toBe(12);
    world.tick = 13;
    expect(
      tryEventFounding(world, () => {
        offers++;
        return true;
      }),
    ).toBe(true);
    expect(world.nextFoundingTick).toBe(19);
    world.tick = 18;
    const cursor = world.foundingTypeCursor;
    expect(runNormalFounding(world)).toBe(false);
    expect(world.foundingTypeCursor).toBe((cursor + 1) % NORMAL_FOUNDER_COUNT);
  });

  it('scans no more than one full 600-grain source array per normal phase, including blocked admissions', () => {
    const world = empty();
    world.elapsed = 40;
    let passes = 0;
    const grains = Array.from({ length: 600 }, (_, index): Sediment => ({
      id: world.nextId++,
      x: 720 + (index % 20),
      y: 500 + Math.floor(index / 20),
      strength: 0,
      radius: 6,
      hue: 180,
      age: 0,
    }));
    world.sediment = grains;
    const iterator = grains[Symbol.iterator].bind(grains);
    const filter = grains.filter.bind(grains);
    Object.defineProperty(grains, Symbol.iterator, {
      value: () => {
        passes++;
        return iterator();
      },
    });
    Object.defineProperty(grains, 'filter', {
      value: (predicate: Parameters<typeof grains.filter>[0]) => {
        passes++;
        return filter(predicate);
      },
    });
    for (let phase = 1; phase <= 15; phase++) {
      world.tick = phase * 6;
      const prior = passes;
      runNormalFounding(world);
      expect(passes - prior).toBeLessThanOrEqual(1);
    }
    expect(passes).toBeGreaterThan(0);
  });

  it('replays the saved global cursor and birth slot across a mid-rotation restore', () => {
    // A persisted world retains its opening lucents; empty() deliberately
    // removes them for scheduler-only cases and is not a valid save fixture.
    const world = createWorld(26);
    world.grazers = [];
    world.nests = [];
    world.sediment = [];
    world.nests = [{ id: world.nextId++, x: 720, y: 500, hue: 180, pigment: 0.6, age: 0 }];
    world.tick = 6;
    expect(runNormalFounding(world)).toBe(true);
    const restored = restoreWorld(serializeWorld(world));
    expect(restored).not.toBeNull();
    for (let phase = 2; phase <= 12; phase++) {
      world.tick = phase * 6;
      restored!.tick = phase * 6;
      runNormalFounding(world);
      runNormalFounding(restored!);
      expect(restored).toEqual(world);
    }
  });
});
