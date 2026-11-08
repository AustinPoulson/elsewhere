import type { World } from '../types';
import { dayStrengthAt, nightBiasAt } from './seasons';

export const AMBIENT_FEED_RATE = 0.09;
const DAY_SECONDS = 360;

export function daylight(world: Pick<World, 'elapsed' | 'seed'>): number {
  const raw = Math.sin((2 * Math.PI * ((world.elapsed + (world.seed % DAY_SECONDS)) % DAY_SECONDS)) / DAY_SECONDS);
  const nightBias = nightBiasAt(world.elapsed);
  const span = 1 - nightBias;
  if (span <= 0) return 0;
  return Math.max(0, ((raw - nightBias) / span) * dayStrengthAt(world.elapsed));
}

export function ambientOffer(world: Pick<World, 'elapsed' | 'seed'>, dt: number): number {
  return daylight(world) * AMBIENT_FEED_RATE * dt;
}

export function getDaylight(world: Pick<World, 'elapsed' | 'seed'>): { intensity: number } {
  return { intensity: daylight(world) };
}
