import type { World } from '../types';

// Catalog entries describe possible life. They allocate no bodies or resources.
export const NEW_TYPE_POPULATION_CAP = 24;
export const SKIMMER_CAP = 6;
export const REEDWELL_CAP = 6;
export const SPECIES_CATALOG = {
  skimmer: { cap: SKIMMER_CAP, bodyPigment: .2, initialReserve: .4,
    admissionPigment: .6, admissionRest: 60, lifespan: 480, starvationLimit: 60 },
  reedwell: { cap: REEDWELL_CAP, bodyPigment: .6, admissionPigment: .6,
    admissionRest: 60, lifespan: 900, lightCapacity: 3, harvestRate: .18,
    emissionLight: 1.5, emissionRest: 15, rootReach: 32, spacing: 64, margin: 14 },
} as const;

export function activeNewTypePopulation(world: World): number {
  return world.skimmers.length + world.reedwells.length;
}
