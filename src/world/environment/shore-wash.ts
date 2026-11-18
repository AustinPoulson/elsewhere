import { containingPool, shoreRho } from '../habitat';
import { confinePosition } from '../geometry';
import { blendHue, MIN_SEDIMENT_GRAIN } from '../species/resources';
import { remainRadius } from '../species/remains';
import type { Point, Remain, Sediment, World } from '../types';
import { REMAIN_CAPACITY } from '../types';
import { rainScale, depthAt } from './depth';
import { effectiveWeather } from '../weather';

export const SHORE_WASH = {
  speed: 3.6,
  targetRho: 0.78,
  ease: 0.3,
  compactReach: 28,
  compactAmount: 0.08,
} as const;

function signed(value: number): number {
  return value === 0 ? 0 : value;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

export function shoreWashVelocity(point: Point, intensity: number, out?: Point): Point {
  const result = out ?? { x: 0, y: 0 };
  if (!(intensity > 0)) {
    result.x = 0;
    result.y = 0;
    return result;
  }
  const pool = containingPool(point.x, point.y);
  if (!pool) {
    result.x = 0;
    result.y = 0;
    return result;
  }
  const dx = point.x - pool.x;
  const dy = point.y - pool.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) {
    result.x = 0;
    result.y = 0;
    return result;
  }
  const error = SHORE_WASH.targetRho - shoreRho(point.x, point.y, pool);
  const speed =
    SHORE_WASH.speed * intensity * rainScale(depthAt(point.x, point.y)) * clamp(error / SHORE_WASH.ease, -1, 1);
  result.x = signed((dx / dist) * speed);
  result.y = signed((dy / dist) * speed);
  return result;
}

function pourSediment(into: Sediment, from: Sediment, amount: number): void {
  const moved = Math.min(amount, from.strength, Math.max(0, 1 - into.strength));
  if (!(moved > 0)) return;
  into.hue = blendHue(into.hue, from.hue, into.strength, moved);
  into.strength += moved;
  from.strength -= moved;
  if (from.strength > 0 && from.strength < MIN_SEDIMENT_GRAIN && into.strength < 1) {
    const rest = Math.min(from.strength, 1 - into.strength);
    into.hue = blendHue(into.hue, from.hue, into.strength, rest);
    into.strength += rest;
    from.strength -= rest;
  }
}

function pourRemain(into: Remain, from: Remain, amount: number): void {
  const moved = Math.min(amount, from.pigment, Math.max(0, REMAIN_CAPACITY - into.pigment));
  if (!(moved > 0)) return;
  into.hue = blendHue(into.hue, from.hue, into.pigment, moved);
  into.pigment += moved;
  into.radius = remainRadius(into.pigment);
  from.pigment -= moved;
  from.radius = remainRadius(from.pigment);
}

function nearestSediment(world: World, grain: Sediment, reach: number): Sediment | undefined {
  let nearest: Sediment | undefined;
  let distance = reach;
  for (const other of world.sediment) {
    if (other.id === grain.id || other.strength <= 0) continue;
    const candidate = Math.hypot(other.x - grain.x, other.y - grain.y);
    if (candidate < distance || (candidate === distance && (!nearest || other.id < nearest.id))) {
      distance = candidate;
      nearest = other;
    }
  }
  return nearest;
}

function nearestRemain(world: World, remain: Remain, reach: number): Remain | undefined {
  let nearest: Remain | undefined;
  let distance = reach;
  for (const other of world.remains) {
    if (other.id === remain.id || other.pigment <= 0) continue;
    const candidate = Math.hypot(other.x - remain.x, other.y - remain.y);
    if (candidate < distance || (candidate === distance && (!nearest || other.id < nearest.id))) {
      distance = candidate;
      nearest = other;
    }
  }
  return nearest;
}

function shoreRank(point: Point): number {
  const pool = containingPool(point.x, point.y);
  return pool ? shoreRho(point.x, point.y, pool) : -1;
}

export function compactShoreResources(world: World): void {
  if (world.tick % 6 !== 0) return;
  const intensity = effectiveWeather(world).intensity;
  if (!(intensity > 0)) return;
  const amount = SHORE_WASH.compactAmount * intensity;
  if (world.sediment.length >= 2) {
    const grain = world.sediment[world.tick % world.sediment.length];
    const other = nearestSediment(world, grain, SHORE_WASH.compactReach);
    if (other) {
      const into = shoreRank(grain) >= shoreRank(other) ? grain : other;
      const from = into === grain ? other : grain;
      pourSediment(into, from, amount);
    }
  }
  if (world.remains.length >= 2) {
    const remain = world.remains[world.tick % world.remains.length];
    const other = nearestRemain(world, remain, SHORE_WASH.compactReach);
    if (other) {
      const into = shoreRank(remain) >= shoreRank(other) ? remain : other;
      const from = into === remain ? other : remain;
      pourRemain(into, from, amount);
    }
  }
}

export function washShorePoint(point: Point, dt: number, intensity: number): void {
  if (!(intensity > 0) || !(dt > 0)) return;
  const velocity = shoreWashVelocity(point, intensity);
  if (velocity.x === 0 && velocity.y === 0) return;
  point.x += velocity.x * dt;
  point.y += velocity.y * dt;
  confinePosition(point, 0);
}
