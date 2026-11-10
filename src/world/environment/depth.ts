import { inOpeningPool } from '../habitat';
import type { Point, Remain, World } from '../types';

export const DEEP_BASIN = {
  x: 1090,
  y: 318,
  rx: 100,
  ry: 76,
  lightLoss: 0.62,
  rainLoss: 0.75,
  stillLoss: 0.88,
  settle: 1.15,
  notice: 0.22,
} as const;

function signed(value: number): number {
  return value === 0 ? 0 : value;
}

export function depthAt(x: number, y: number): number {
  const nx = (x - DEEP_BASIN.x) / DEEP_BASIN.rx;
  const ny = (y - DEEP_BASIN.y) / DEEP_BASIN.ry;
  const rho = nx * nx + ny * ny;
  if (rho >= 1) return 0;
  const falloff = 1 - rho;
  return signed(falloff * falloff);
}

export function inDeep(x: number, y: number): boolean {
  return depthAt(x, y) > 0;
}

export function inDeepWater(x: number, y: number): boolean {
  return depthAt(x, y) >= DEEP_BASIN.notice;
}

export function lightScale(depth: number): number {
  return signed(1 - DEEP_BASIN.lightLoss * Math.max(0, Math.min(1, depth)));
}

export function rainScale(depth: number): number {
  return signed(1 - DEEP_BASIN.rainLoss * Math.max(0, Math.min(1, depth)));
}

export function stillScale(depth: number): number {
  return signed(1 - DEEP_BASIN.stillLoss * Math.max(0, Math.min(1, depth)));
}

export function settleVelocity(body: Point, out?: Point): Point {
  const result = out ?? { x: 0, y: 0 };
  const depth = depthAt(body.x, body.y);
  if (depth <= 0) {
    result.x = 0;
    result.y = 0;
    return result;
  }
  const dx = DEEP_BASIN.x - body.x;
  const dy = DEEP_BASIN.y - body.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) {
    result.x = 0;
    result.y = 0;
    return result;
  }
  const speed = DEEP_BASIN.settle * depth;
  result.x = (dx / dist) * speed;
  result.y = (dy / dist) * speed;
  return result;
}

export function pigmentInDeep(world: Pick<World, 'sediment'>): number {
  return world.sediment.reduce((total, grain) => total + (inDeep(grain.x, grain.y) ? grain.strength : 0), 0);
}

export function remainsInDeep(world: Pick<World, 'remains'>): number {
  return world.remains.reduce((total, remain: Remain) => total + (inDeep(remain.x, remain.y) ? remain.pigment : 0), 0);
}

export function fossilsInDeep(world: Pick<World, 'fossils'>): number {
  return world.fossils.reduce((total, fossil) => total + (inDeep(fossil.x, fossil.y) ? fossil.pigment : 0), 0);
}

export function describeDeepChange(before: number, after: number): string | null {
  if (!Number.isFinite(before) || !Number.isFinite(after)) return null;
  if (after - before >= 0.2) return 'Color settled into the deeper water.';
  return null;
}

export function deepBasinInOpeningPool(): boolean {
  return (
    inOpeningPool(DEEP_BASIN.x, DEEP_BASIN.y) &&
    inOpeningPool(DEEP_BASIN.x + DEEP_BASIN.rx * 0.92, DEEP_BASIN.y) &&
    inOpeningPool(DEEP_BASIN.x - DEEP_BASIN.rx * 0.92, DEEP_BASIN.y) &&
    inOpeningPool(DEEP_BASIN.x, DEEP_BASIN.y + DEEP_BASIN.ry * 0.92) &&
    inOpeningPool(DEEP_BASIN.x, DEEP_BASIN.y - DEEP_BASIN.ry * 0.92)
  );
}
