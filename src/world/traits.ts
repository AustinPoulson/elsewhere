import { nextRandom } from './rng';
import type { Traits, World } from './types';

export const TRAIT_MIN = 0.7;
export const TRAIT_MAX = 1.3;
export const TRAIT_MUTATION = 0.08;

export function baselineTraits(): Traits {
  return { drive: 1, bulk: 1 };
}

export function clampTrait(value: number): number {
  return Math.min(TRAIT_MAX, Math.max(TRAIT_MIN, value));
}

export function mutateTraits(world: Pick<World, 'randomState'>, parent: Traits = baselineTraits()): Traits {
  return {
    drive: clampTrait(parent.drive + (nextRandom(world) - 0.5) * 2 * TRAIT_MUTATION),
    bulk: clampTrait(parent.bulk + (nextRandom(world) - 0.5) * 2 * TRAIT_MUTATION),
  };
}

export function traitMobility(traits: Traits): number {
  return traits.drive / traits.bulk;
}

export function appearanceScale(traits: Traits): number {
  return 0.78 + traits.bulk * 0.22;
}

export function appearanceGlow(traits: Traits): number {
  return 0.75 + traits.drive * 0.25;
}

export function describeDrive(value: number): string {
  if (value >= 1.08) return `Keen · ${value.toFixed(2)}`;
  if (value <= 0.92) return `Spare · ${value.toFixed(2)}`;
  return `Even · ${value.toFixed(2)}`;
}

export function describeBulk(value: number): string {
  if (value >= 1.08) return `Stout · ${value.toFixed(2)}`;
  if (value <= 0.92) return `Slight · ${value.toFixed(2)}`;
  return `Even · ${value.toFixed(2)}`;
}
