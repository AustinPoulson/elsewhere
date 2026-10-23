import type { World } from '../types';

// Catalog entries describe possible life. They allocate no bodies or resources.
export const NEW_TYPE_POPULATION_CAP = 24;
export const SKIMMER_CAP = 6;
export const REEDWELL_CAP = 6;
export const RAINBELL_CAP = 4;
export const SILTSTITCHER_CAP = 6;
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
  siltstitcher: { cap: SILTSTITCHER_CAP, bodyPigment: .2, initialReserve: .1,
    admissionThreshold: 1.5, admissionPigment: .3, admissionRest: 60,
    protectedStock: 1.2, reserveCapacity: .1, reserveRefillRate: .01,
    cargoCapacity: .3, cargoRefillRate: .04, minimumPartialCargo: .06,
    maintenanceRate: .001, lifespan: 480, starvationLimit: 60,
    blockedLimit: 10, speed: 10, margin: 11, homeReach: 16, spacing: 48,
    destinationMinReach: 60, destinationMaxReach: 100,
    homeFringeReach: 32, destinationFringeReach: 16, deliveryMergeReach: 12 },
} as const;

export function activeNewTypePopulation(world: World): number {
  return world.skimmers.length + world.reedwells.length + world.rainbells.length + world.siltstitchers.length;
}
