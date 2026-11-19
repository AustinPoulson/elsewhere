import { containingPool } from '../habitat';
import { blendHue } from '../species/resources';
import { NEST_CAPACITY, type Nest, type World } from '../types';

export const NEST_SLUMP = {
  amount: 0.005,
} as const;

export function heldNestPigment(world: Pick<World, 'nests'>): number {
  let total = 0;
  for (const nest of world.nests) total += nest.pigment;
  return total;
}

export function nestHasCarrier(world: Pick<World, 'siltstitchers'>, nest: Pick<Nest, 'id'>): boolean {
  return world.siltstitchers.some((body) => body.homeNestId === nest.id);
}

function fuller(a: Nest, b: Nest): boolean {
  return a.pigment > b.pigment || (a.pigment === b.pigment && a.id < b.id);
}

function fullestUnused(world: World, source: Nest): Nest | undefined {
  const pool = containingPool(source.x, source.y);
  if (!pool) return undefined;
  let dest: Nest | undefined;
  for (const nest of world.nests) {
    if (nest.id === source.id || nestHasCarrier(world, nest)) continue;
    const home = containingPool(nest.x, nest.y);
    if (!home || home.id !== pool.id) continue;
    if (!dest || fuller(nest, dest)) dest = nest;
  }
  return dest;
}

export function unusedNestsSlumping(world: World): boolean {
  for (const nest of world.nests) {
    if (nestHasCarrier(world, nest) || !(nest.pigment > 0.05)) continue;
    const dest = fullestUnused(world, nest);
    if (dest && dest.pigment < NEST_CAPACITY && nest.pigment + 0.05 < dest.pigment) return true;
  }
  return false;
}

export function slumpUnusedNests(world: World): void {
  if (world.tick % 6 !== 0 || world.nests.length < 2) return;
  const source = world.nests[Math.floor(world.tick / 6) % world.nests.length];
  if (nestHasCarrier(world, source) || !(source.pigment > 0)) return;
  const dest = fullestUnused(world, source);
  if (!dest || fuller(source, dest)) return;
  const moved = Math.min(NEST_SLUMP.amount, source.pigment, Math.max(0, NEST_CAPACITY - dest.pigment));
  if (!(moved > 0)) return;
  dest.hue = blendHue(dest.hue, source.hue, dest.pigment, moved);
  dest.pigment += moved;
  source.pigment -= moved;
}
