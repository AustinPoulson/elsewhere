import { isInPool, type LightSource, type World } from '../types';

export const LIGHT_PICK_RADIUS = 30;

/** Bounded nearest-source lookup. Equal distances resolve by stable entity ID. */
export function nearestLiveLight(world: World, x: number, y: number, radius = LIGHT_PICK_RADIUS): LightSource | undefined {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius) || radius < 0) return undefined;
  let nearest: LightSource | undefined;
  let bestDistance = radius;
  for (const light of world.lights) {
    if (!Number.isFinite(light.energy) || light.energy <= 0.01) continue;
    const distance = Math.hypot(light.x - x, light.y - y);
    if (distance < bestDistance || (distance === bestDistance && (!nearest || light.id < nearest.id))) {
      nearest = light;
      bestDistance = distance;
    }
  }
  return nearest;
}

/** A spatial intervention only: no resource grant, ID allocation, time step or PRNG draw. */
export function moveLight(world: World, id: number, x: number, y: number): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !isInPool(x, y)) return false;
  const light = world.lights.find((entry) => entry.id === id);
  if (!light || !Number.isFinite(light.energy) || light.energy <= 0.01) return false;
  light.x = x;
  light.y = y;
  return true;
}
