import { containingPool } from '../habitat';
import { blendHue } from '../species/resources';
import { discardEmptyRemains, remainRadius } from '../species/remains';
import { remainHeldForStocking } from '../species/marlgrub';
import { REMAIN_CAPACITY, type Remain, type World } from '../types';

export const REMAIN_SLUMP = {
  amount: 0.005,
} as const;

function fuller(a: Remain, b: Remain): boolean {
  return a.pigment > b.pigment || (a.pigment === b.pigment && a.id < b.id);
}

function fullestUnused(world: World, source: Remain): Remain | undefined {
  const pool = containingPool(source.x, source.y);
  if (!pool) return undefined;
  let dest: Remain | undefined;
  for (const remain of world.remains) {
    if (remain.id === source.id || remain.pigment <= 0 || remainHeldForStocking(world, remain)) continue;
    const home = containingPool(remain.x, remain.y);
    if (!home || home.id !== pool.id) continue;
    if (!dest || fuller(remain, dest)) dest = remain;
  }
  return dest;
}

export function unusedRemainsSlumping(world: World): boolean {
  for (const remain of world.remains) {
    if (remainHeldForStocking(world, remain) || !(remain.pigment > 0.02)) continue;
    const dest = fullestUnused(world, remain);
    if (dest && dest.pigment < REMAIN_CAPACITY && remain.pigment + 0.02 < dest.pigment) return true;
  }
  return false;
}

export function slumpUnusedRemains(world: World): void {
  if (world.tick % 6 !== 0 || world.remains.length < 2) return;
  const source = world.remains[Math.floor(world.tick / 6) % world.remains.length];
  if (remainHeldForStocking(world, source) || !(source.pigment > 0)) return;
  const dest = fullestUnused(world, source);
  if (!dest || fuller(source, dest)) return;
  const moved = Math.min(REMAIN_SLUMP.amount, source.pigment, Math.max(0, REMAIN_CAPACITY - dest.pigment));
  if (!(moved > 0)) return;
  dest.hue = blendHue(dest.hue, source.hue, dest.pigment, moved);
  dest.pigment += moved;
  dest.radius = remainRadius(dest.pigment);
  source.pigment -= moved;
  source.radius = remainRadius(source.pigment);
  if (!(source.pigment > 0)) discardEmptyRemains(world);
}
