import { describe, expect, it } from 'vitest';
import { createWorld, stepWorld, getStats } from '../src/world/simulation';
import { serializeWorld } from '../src/world/persistence';
import { FIXED_STEP } from '../src/world/types';

const DAY_SECONDS = 360;

function runSimulation(seed: number, days: number): { finalState: string; elapsed: number } {
  const world = createWorld(seed);
  const targetSteps = Math.ceil((days * DAY_SECONDS) / FIXED_STEP);

  for (let i = 0; i < targetSteps; i++) {
    stepWorld(world);
  }

  return {
    finalState: serializeWorld(world),
    elapsed: world.elapsed,
  };
}

describe('headless harness', () => {
  it('produces deterministic output from the same seed', () => {
    const seed = 12345;
    const days = 1;

    const run1 = runSimulation(seed, days);
    const run2 = runSimulation(seed, days);

    expect(run1.finalState).toBe(run2.finalState);
    expect(run1.elapsed).toBe(run2.elapsed);
  });

  it('produces different output from different seeds', () => {
    const days = 1;

    const run1 = runSimulation(111, days);
    const run2 = runSimulation(222, days);

    expect(run1.finalState).not.toBe(run2.finalState);
  });

  it('completes a short run within time budget', () => {
    const seed = 42;
    const days = 5;
    const targetSteps = Math.ceil((days * DAY_SECONDS) / FIXED_STEP);
    const maxTimeMs = 10_000;

    const start = performance.now();
    const world = createWorld(seed);

    for (let i = 0; i < targetSteps; i++) {
      stepWorld(world);
    }

    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(maxTimeMs);
    expect(world.elapsed).toBeGreaterThan(days * DAY_SECONDS - 1);
    expect(world.organisms.length).toBeGreaterThan(0);

    const stats = getStats(world);
    expect(stats.population).toBeGreaterThan(0);
  }, 15_000);

  it('tracks population changes correctly', () => {
    const world = createWorld(999);
    const targetSteps = Math.ceil((3 * DAY_SECONDS) / FIXED_STEP);

    const initialLucents = world.organisms.length;
    const initialGrazers = world.grazers.length;

    for (let i = 0; i < targetSteps; i++) {
      stepWorld(world);
    }

    expect(world.organisms.length).toBe(initialLucents);
    expect(world.grazers.length).toBe(initialGrazers);
    expect(world.elapsed).toBeGreaterThan(3 * DAY_SECONDS - 1);
    expect(world.nests.length).toBeGreaterThan(0);
  }, 15_000);
});
