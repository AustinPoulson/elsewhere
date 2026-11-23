import { containingPool, shoreRho } from '../habitat';
import { SPECIES_CATALOG } from '../species/catalog';
import { blendHue } from '../species/resources';
import type { GlassLimpet, HabitatPool, Point, Sediment, World } from '../types';

export const LOCKED_RETURN = {
  amount: 0.005,
} as const;

const SHORE = SPECIES_CATALOG.glassLimpet;

function onLimpetShore(grain: Point, pool: HabitatPool): boolean {
  const rho = shoreRho(grain.x, grain.y, pool);
  return rho >= SHORE.shoreMin && rho <= SHORE.shoreMax;
}

function fuller(a: Sediment, b: Sediment): boolean {
  return a.strength > b.strength || (a.strength === b.strength && a.id < b.id);
}

function receivingGrain(world: World, point: Point): Sediment | undefined {
  const pool = containingPool(point.x, point.y);
  if (!pool) return undefined;
  let shore: Sediment | undefined;
  let nearest: Sediment | undefined;
  let distance = Infinity;
  for (const grain of world.sediment) {
    if (!(grain.strength > 0) || grain.strength >= 1) continue;
    const home = containingPool(grain.x, grain.y);
    if (!home || home.id !== pool.id) continue;
    if (onLimpetShore(grain, pool) && (!shore || fuller(grain, shore))) shore = grain;
    const candidate = Math.hypot(grain.x - point.x, grain.y - point.y);
    if (candidate < distance || (candidate === distance && (!nearest || grain.id < nearest.id))) {
      distance = candidate;
      nearest = grain;
    }
  }
  return shore ?? nearest;
}

function pourOntoFloor(world: World, point: Point, hue: number, amount: number): number {
  const dest = receivingGrain(world, point);
  if (!dest) return 0;
  const moved = Math.min(amount, Math.max(0, 1 - dest.strength));
  if (!(moved > 0)) return 0;
  dest.hue = blendHue(dest.hue, hue, dest.strength, moved);
  dest.strength += moved;
  return moved;
}

function catchShells(world: World): GlassLimpet[] {
  const shells: GlassLimpet[] = [];
  for (const limpet of world.glassLimpets) {
    if (limpet.cargo > 0) shells.push(limpet);
  }
  return shells;
}

export function lockedColorReturning(world: World): boolean {
  for (const limpet of world.glassLimpets) {
    if (limpet.cargo > 0 && receivingGrain(world, limpet)) return true;
  }
  return false;
}

export function returnLockedColor(world: World): void {
  if (world.tick % 6 !== 0) return;
  const shells = catchShells(world);
  if (shells.length === 0) return;
  const source = shells[Math.floor(world.tick / 6) % shells.length];
  const moved = pourOntoFloor(world, source, source.hue, Math.min(LOCKED_RETURN.amount, source.cargo));
  if (!(moved > 0)) return;
  source.cargo -= moved;
}
