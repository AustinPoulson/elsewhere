import type { World } from '../types';

export const AMBIENT_FEED_RATE = 0.09;

export function daylight(world: Pick<World, 'elapsed' | 'seed'>): number {
  return Math.max(0, Math.sin((2 * Math.PI * ((world.elapsed + (world.seed % 360)) % 360)) / 360));
}

export function ambientOffer(world: Pick<World, 'elapsed' | 'seed'>, dt: number): number {
  return daylight(world) * AMBIENT_FEED_RATE * dt;
}

export function getDaylight(world: Pick<World, 'elapsed' | 'seed'>): { intensity: number } {
  return { intensity: daylight(world) };
}
