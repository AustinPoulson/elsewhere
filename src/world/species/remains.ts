import { confinePosition } from '../geometry';
import { LIMITS, REMAIN_CAPACITY, isInPool, type Point, type Remain, type World } from '../types';
import { blendHue, returnPigment, safeId } from './resources';

export const REMAIN_DECAY_RATE = 0.003;
export const REMAIN_MIN = 0.015;
export const REMAIN_MERGE_REACH = 28;
export const DEATH_SEDIMENT_FRACTION = 2 / 3;

export function remainRadius(pigment: number): number {
  return Math.min(12, 4 + Math.max(0, pigment) * 4);
}

export function heldRemainPigment(world: Pick<World, 'remains'>): number {
  let total = 0;
  for (const remain of world.remains) total += remain.pigment;
  return total;
}

export function takeRemainPigment(world: World, remain: Remain, amount: number): number {
  const taken = Math.min(remain.pigment, Math.max(0, amount));
  remain.pigment -= taken;
  remain.radius = remainRadius(remain.pigment);
  world.ecologyLedger.remainsConsumed += taken;
  return taken;
}

export function discardEmptyRemains(world: World): void {
  let write = 0;
  for (const remain of world.remains) {
    if (remain.pigment > 0) world.remains[write++] = remain;
  }
  world.remains.length = write;
}

function leachRemain(world: World, remain: Remain, amount: number): number {
  const leached = Math.min(remain.pigment, Math.max(0, amount));
  remain.pigment -= leached;
  remain.radius = remainRadius(remain.pigment);
  world.ecologyLedger.remainsDecayed += leached;
  returnPigment(world, remain, remain.hue, leached);
  return leached;
}

function oldestRemain(world: World): Remain | undefined {
  let oldest: Remain | undefined;
  for (const remain of world.remains) {
    if (!oldest || remain.age > oldest.age || (remain.age === oldest.age && remain.id < oldest.id)) oldest = remain;
  }
  return oldest;
}

function nearestRemain(world: World, point: Point, reach: number): Remain | undefined {
  let nearest: Remain | undefined;
  let distance = reach;
  for (const remain of world.remains) {
    if (remain.pigment >= REMAIN_CAPACITY) continue;
    const candidate = Math.hypot(remain.x - point.x, remain.y - point.y);
    if (candidate < distance || (candidate === distance && (!nearest || remain.id < nearest.id))) {
      distance = candidate;
      nearest = remain;
    }
  }
  return nearest;
}

export function settleDeath(world: World, point: Point, hue: number, pigment: number): void {
  const amount = Math.max(0, pigment);
  if (amount <= 0) return;
  const sedimentShare = amount * DEATH_SEDIMENT_FRACTION;
  const remainShare = amount - sedimentShare;
  if (remainShare > 0) depositRemain(world, point, hue, remainShare);
  if (sedimentShare > 0) returnPigment(world, point, hue, sedimentShare);
}

export function depositRemain(world: World, point: Point, hue: number, pigment: number): void {
  let amount = pigment;
  if (amount <= 0) return;
  const location = { x: point.x, y: point.y };
  if (!isInPool(location.x, location.y)) confinePosition(location, 0);
  world.ecologyLedger.remainsCreated += amount;
  const nearby = nearestRemain(world, location, REMAIN_MERGE_REACH);
  if (nearby) {
    const added = Math.min(amount, REMAIN_CAPACITY - nearby.pigment);
    nearby.hue = blendHue(nearby.hue, hue, nearby.pigment, added);
    nearby.pigment += added;
    nearby.radius = remainRadius(nearby.pigment);
    amount -= added;
  }
  while (amount > 0 && world.remains.length >= LIMITS.remains) {
    const oldest = oldestRemain(world);
    if (!oldest) break;
    leachRemain(world, oldest, oldest.pigment);
    discardEmptyRemains(world);
  }
  if (amount > 0 && world.remains.length < LIMITS.remains && safeId(world)) {
    const held = Math.min(amount, REMAIN_CAPACITY);
    world.remains.push({
      id: world.nextId++,
      species: 'remain',
      x: location.x,
      y: location.y,
      pigment: held,
      hue,
      age: 0,
      radius: remainRadius(held),
    });
    amount -= held;
  }
  if (amount > 0) {
    world.ecologyLedger.remainsDecayed += amount;
    returnPigment(world, location, hue, amount);
  }
}

export function updateRemains(world: World, dt: number): void {
  if (world.remains.length === 0) return;
  let write = 0;
  for (const remain of world.remains) {
    remain.age += dt;
    leachRemain(world, remain, dt * REMAIN_DECAY_RATE);
    if (remain.pigment > 0 && remain.pigment < REMAIN_MIN) leachRemain(world, remain, remain.pigment);
    if (remain.pigment > 0) world.remains[write++] = remain;
  }
  world.remains.length = write;
}
