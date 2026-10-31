import type { World } from '../types';

// A bounded external energy source, independent from rain and the saved PRNG.
// It advances only with simulated time and therefore pauses and restores exactly.
export function daylight(world: Pick<World, 'elapsed' | 'seed'>): number {
  return Math.max(0, Math.sin((2 * Math.PI * ((world.elapsed + (world.seed % 360)) % 360)) / 360));
}

export function getDaylight(world: Pick<World, 'elapsed' | 'seed'>): { intensity: number } {
  return { intensity: daylight(world) };
}
