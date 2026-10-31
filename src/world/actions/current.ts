import { isInPool, type Current, type Point, type World } from '../types';

export const CURRENT_RADIUS = 110;
export const CURRENT_DURATION = 8;
export const MAX_CURRENTS = 3;
export const CURRENT_SPEED = 12;
export const MAX_CURRENT_SPEED = 16;
export const SEDIMENT_DRIFT = 0.35;

export type CurrentResult = { status: 'applied'; currentId: number } | { status: 'invalid' | 'full' | 'exhausted' };

export function currentStrength(current: Current, elapsed: number): number {
  const age = elapsed - current.startedAt;
  return age < 0 || age >= current.duration ? 0 : 1 - age / current.duration;
}

export function applyCurrent(world: World, start: Point, end: Point): CurrentResult {
  if (![start.x, start.y, end.x, end.y].every(Number.isFinite)) return { status: 'invalid' };
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  if (length < 24 || length > 240 || world.elapsed > Number.MAX_SAFE_INTEGER - CURRENT_DURATION)
    return { status: 'invalid' };
  // Bounded coast hit testing also rejects strokes crossing an inlet.
  for (let i = 0; i <= 32; i++) {
    if (!isInPool(start.x + ((end.x - start.x) * i) / 32, start.y + ((end.y - start.y) * i) / 32))
      return { status: 'invalid' };
  }
  let active = 0;
  for (const current of world.currents) if (currentStrength(current, world.elapsed) > 0) active++;
  if (active >= MAX_CURRENTS) return { status: 'full' };
  if (world.nextId >= Number.MAX_SAFE_INTEGER) return { status: 'exhausted' };
  // Prune only on success: every rejected gesture leaves the world identical.
  let write = 0;
  for (const current of world.currents)
    if (currentStrength(current, world.elapsed) > 0) world.currents[write++] = current;
  world.currents.length = write;
  const id = world.nextId++;
  world.currents.push({
    id,
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
    dx: (end.x - start.x) / length,
    dy: (end.y - start.y) / length,
    startedAt: world.elapsed,
    duration: CURRENT_DURATION,
    radius: CURRENT_RADIUS,
  });
  return { status: 'applied', currentId: id };
}
