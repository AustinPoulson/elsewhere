import { containingPool, shoreRho } from '../habitat';
import { SPECIES_CATALOG } from '../species/catalog';
import { grainHeldForStocking } from '../species/glass-limpet';
import { blendHue, MIN_SEDIMENT_GRAIN } from '../species/resources';
import type { Sediment, World } from '../types';

const LIMEST = SPECIES_CATALOG.glassLimpet;

export const SHORE_SLUMP = {
  amount: 0.005,
  capacity: 1,
} as const;

function inLimpetShore(x: number, y: number): boolean {
  const pool = containingPool(x, y, LIMEST.margin);
  if (!pool) return false;
  const rho = shoreRho(x, y, pool);
  return rho >= LIMEST.shoreMin && rho <= LIMEST.shoreMax;
}

function unusedShoreGrain(world: World, grain: Sediment): boolean {
  return grain.strength > 0 && inLimpetShore(grain.x, grain.y) && !grainHeldForStocking(world, grain);
}

function fuller(a: Sediment, b: Sediment): boolean {
  return a.strength > b.strength || (a.strength === b.strength && a.id < b.id);
}

function fullestUnused(world: World, source: Sediment): Sediment | undefined {
  const pool = containingPool(source.x, source.y);
  if (!pool) return undefined;
  let dest: Sediment | undefined;
  for (const grain of world.sediment) {
    if (grain.id === source.id || !unusedShoreGrain(world, grain)) continue;
    const home = containingPool(grain.x, grain.y);
    if (!home || home.id !== pool.id) continue;
    if (!dest || fuller(grain, dest)) dest = grain;
  }
  return dest;
}

export function unusedShoreGrainsSlumping(world: World): boolean {
  for (const grain of world.sediment) {
    if (!unusedShoreGrain(world, grain) || !(grain.strength > 0.02)) continue;
    const dest = fullestUnused(world, grain);
    if (dest && dest.strength < SHORE_SLUMP.capacity && grain.strength + 0.02 < dest.strength) return true;
  }
  return false;
}

function pour(into: Sediment, from: Sediment, amount: number): void {
  const moved = Math.min(amount, from.strength, Math.max(0, SHORE_SLUMP.capacity - into.strength));
  if (!(moved > 0)) return;
  into.hue = blendHue(into.hue, from.hue, into.strength, moved);
  into.strength += moved;
  from.strength -= moved;
  if (from.strength > 0 && from.strength < MIN_SEDIMENT_GRAIN && into.strength < SHORE_SLUMP.capacity) {
    const rest = Math.min(from.strength, SHORE_SLUMP.capacity - into.strength);
    into.hue = blendHue(into.hue, from.hue, into.strength, rest);
    into.strength += rest;
    from.strength -= rest;
  }
}

export function slumpUnusedShoreGrains(world: World): void {
  if (world.tick % 6 !== 0 || world.sediment.length < 2) return;
  const source = world.sediment[Math.floor(world.tick / 6) % world.sediment.length];
  if (!unusedShoreGrain(world, source)) return;
  const dest = fullestUnused(world, source);
  if (!dest || fuller(source, dest)) return;
  pour(dest, source, SHORE_SLUMP.amount);
}
