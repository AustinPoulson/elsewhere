import { confineToWater } from '../habitat';
import { MIN_SEDIMENT_GRAIN, returnPigment } from '../species/resources';
import type { Point, World } from '../types';
import { effectiveWeather } from '../weather';

export const MINERAL_SEAM = {
  ax: 508,
  ay: 528,
  bx: 642,
  by: 612,
  x: 575,
  y: 570,
  capacity: 24,
  rate: 0.00072,
  rainBonus: 0.4,
  hue: 24,
  grain: 0.05,
  reach: 90,
} as const;

function assertTime(elapsed: number): void {
  if (!Number.isFinite(elapsed) || elapsed < 0) throw new RangeError('Seam time must be finite and nonnegative.');
}

function signed(value: number): number {
  return value === 0 ? 0 : value;
}

export function seamRemaining(world: Pick<World, 'seamAccrued' | 'ecologyLedger'>): number {
  return signed(Math.max(0, MINERAL_SEAM.capacity - world.seamAccrued - world.ecologyLedger.seamDissolved));
}

export function pigmentNearSeam(world: Pick<World, 'sediment'>, radius = MINERAL_SEAM.reach): number {
  return world.sediment.reduce(
    (total, grain) =>
      total + (Math.hypot(grain.x - MINERAL_SEAM.x, grain.y - MINERAL_SEAM.y) <= radius ? grain.strength : 0),
    0,
  );
}

export function seamEmitPoint(tick: number): Point {
  const t = (tick * 0.61803398875) % 1;
  const alongX = MINERAL_SEAM.ax + (MINERAL_SEAM.bx - MINERAL_SEAM.ax) * t;
  const alongY = MINERAL_SEAM.ay + (MINERAL_SEAM.by - MINERAL_SEAM.ay) * t;
  const angle = ((tick % 360) * Math.PI) / 180;
  const radius = 6 + (tick % 19);
  const point = { x: alongX + Math.cos(angle) * radius, y: alongY + Math.sin(angle) * radius };
  confineToWater(point, 8);
  return point;
}

export function dissolveMineralSeam(world: World, dt: number): void {
  if (!Number.isFinite(dt) || dt <= 0) return;
  assertTime(world.elapsed);
  let remaining = seamRemaining(world);
  if (remaining <= 0 && world.seamAccrued < MIN_SEDIMENT_GRAIN) return;
  if (remaining > 0) {
    const wet = effectiveWeather(world).intensity;
    const rate = MINERAL_SEAM.rate * (1 + MINERAL_SEAM.rainBonus * wet);
    const taken = Math.min(rate * dt, remaining);
    world.seamAccrued += taken;
    remaining -= taken;
  }
  const ready = world.seamAccrued >= MINERAL_SEAM.grain || (remaining <= 0 && world.seamAccrued > 0);
  if (!ready) return;
  const amount = world.seamAccrued >= MINERAL_SEAM.grain ? MINERAL_SEAM.grain : world.seamAccrued;
  world.seamAccrued = signed(world.seamAccrued - amount);
  world.ecologyLedger.seamDissolved += amount;
  returnPigment(world, seamEmitPoint(world.tick), MINERAL_SEAM.hue, amount);
}

export function describeSeamChange(beforeRemaining: number, afterRemaining: number, released: number): string | null {
  if (!Number.isFinite(beforeRemaining) || !Number.isFinite(afterRemaining) || !Number.isFinite(released)) return null;
  if (beforeRemaining > 0 && afterRemaining <= 0) return 'The mineral seam ran out.';
  if (released >= 0.2) return 'A mineral seam leaked more color into the floor.';
  return null;
}
