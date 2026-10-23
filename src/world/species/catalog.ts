import type { World } from '../types';

// Catalog entries describe possible life. They allocate no bodies or resources.
export const NEW_TYPE_POPULATION_CAP = 24;
export const SKIMMER_CAP = 6;
export const REEDWELL_CAP = 6;
export const RAINBELL_CAP = 4;
export const SPECIES_CATALOG = {
  skimmer: { cap: SKIMMER_CAP, bodyPigment: .2, initialReserve: .4,
    admissionPigment: .6, admissionRest: 60, lifespan: 480, starvationLimit: 60 },
  reedwell: { cap: REEDWELL_CAP, bodyPigment: .6, admissionPigment: .6,
    admissionRest: 60, lifespan: 900, lightCapacity: 3, harvestRate: .18,
    emissionLight: 1.5, emissionRest: 15, rootReach: 32, spacing: 64, margin: 14 },
  rainbell: { cap: RAINBELL_CAP, bodyPigment: .2, initialReserve: .4,
    admissionPigment: .6, admissionRest: 60, lifespan: 600, starvationLimit: 60,
    reserveCapacity: 1, intakeRate: .02, maintenanceRate: .001,
    pulsePigment: .04, pulseRest: 15, feedReach: 28, pumpMinReach: 30,
    pumpMaxReach: 60, rootReach: 32, spacing: 64, margin: 14 },
} as const;

export function activeNewTypePopulation(world: World): number {
  return world.skimmers.length + world.reedwells.length + world.rainbells.length;
}
