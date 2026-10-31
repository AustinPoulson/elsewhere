import fixture from './shower-study.json';
import { restoreWorld } from '../world/persistence';
import { LIMITS, type World } from '../world/types';

export const SHOWER_STUDY = {
  name: 'During a shower',
  seed: 20261006,
  steps: 1200,
  seconds: 40,
  sourceRevision: '507de042a85b45eef69c90ed5e010f1ddc905b70',
  source: 'createWorld(20261006), followed by 1200 stepWorld calls at 1/30 second; no visitor actions.',
} as const;
const snapshot = JSON.stringify(fixture);
export function createShowerStudy(): World {
  const world = restoreWorld(snapshot);
  if (
    !world ||
    world.tick !== SHOWER_STUDY.steps ||
    world.sediment.length > LIMITS.sediment - 6 ||
    !world.nests.some((nest) => nest.pigment >= 3)
  )
    throw new Error('The shower study could not be opened.');
  return world;
}
