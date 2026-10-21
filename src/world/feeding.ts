import { LIMITS, isInPool, type Organism, type World } from './types';

export const PIGMENT_PER_LIGHT = 0.02;
export const MAX_FEEDING_CREDIT = 1;
export const MIN_FEEDING_DEPOSIT = 0.06;

/** Credit is paid only by actual source consumption, including tiny remnants. */
export function accrueFeedingPigment(world: World, organism: Organism, consumedLight: number): void {
  if (!(consumedLight > 0)) return;
  const credit = organism.pigmentCredit + consumedLight * PIGMENT_PER_LIGHT;
  organism.pigmentCredit = Math.min(MAX_FEEDING_CREDIT, credit);
  world.ecologyLedger.feedingCreditLost += Math.max(0, credit - MAX_FEEDING_CREDIT);
}

/** Capacity refusal retains paid credit; it never evicts an unrelated grain. */
export function depositFeedingPigment(world: World, organism: Organism): boolean {
  if (organism.pigmentCredit < MIN_FEEDING_DEPOSIT || world.sediment.length >= LIMITS.sediment
    || !Number.isSafeInteger(world.nextId) || world.nextId >= Number.MAX_SAFE_INTEGER
    || !isInPool(organism.x, organism.y)) return false;
  const amount = Math.min(0.3, organism.pigmentCredit);
  world.sediment.push({ id: world.nextId++, x: organism.x, y: organism.y,
    radius: 4 + amount * 4, hue: organism.hue, strength: amount, age: 0 });
  organism.pigmentCredit = Math.max(0, organism.pigmentCredit - amount);
  return true;
}
