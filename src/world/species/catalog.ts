import type { World } from '../types';

// Catalog entries describe possible life. They allocate no bodies or resources.
export const NEW_TYPE_POPULATION_CAP = 24;
export const SKIMMER_CAP = 6;
export const REEDWELL_CAP = 6;
export const RAINBELL_CAP = 4;
export const SILTSTITCHER_CAP = 6;
export const GLASS_LIMPET_CAP = 4;
export const CARGO_MITE_CAP = 4;
export const SPECIES_CATALOG = {
  skimmer: {
    cap: SKIMMER_CAP,
    bodyPigment: 0.2,
    initialReserve: 0.4,
    admissionPigment: 0.6,
    admissionRest: 60,
    lifespan: 480,
    starvationLimit: 60,
  },
  reedwell: {
    cap: REEDWELL_CAP,
    bodyPigment: 0.6,
    admissionPigment: 0.6,
    admissionRest: 60,
    lifespan: 900,
    lightCapacity: 3,
    harvestRate: 0.18,
    emissionLight: 1.5,
    emissionRest: 15,
    rootReach: 32,
    spacing: 64,
    margin: 14,
  },
  rainbell: {
    cap: RAINBELL_CAP,
    bodyPigment: 0.2,
    initialReserve: 0.4,
    admissionPigment: 0.6,
    admissionRest: 60,
    lifespan: 600,
    starvationLimit: 60,
    reserveCapacity: 1,
    intakeRate: 0.02,
    maintenanceRate: 0.001,
    pulsePigment: 0.04,
    pulseRest: 15,
    feedReach: 28,
    pumpMinReach: 30,
    pumpMaxReach: 60,
    rootReach: 32,
    spacing: 64,
    margin: 14,
  },
  siltstitcher: {
    cap: SILTSTITCHER_CAP,
    bodyPigment: 0.2,
    initialReserve: 0.1,
    admissionThreshold: 1.5,
    admissionPigment: 0.3,
    admissionRest: 60,
    protectedStock: 1.2,
    reserveCapacity: 0.1,
    reserveRefillRate: 0.01,
    cargoCapacity: 0.3,
    cargoRefillRate: 0.04,
    minimumPartialCargo: 0.06,
    maintenanceRate: 0.001,
    lifespan: 480,
    starvationLimit: 60,
    blockedLimit: 10,
    speed: 10,
    margin: 11,
    homeReach: 16,
    spacing: 48,
    destinationMinReach: 60,
    destinationMaxReach: 100,
    homeFringeReach: 32,
    destinationFringeReach: 16,
    deliveryMergeReach: 12,
  },
  glassLimpet: {
    cap: GLASS_LIMPET_CAP,
    bodyPigment: 0.2,
    initialReserve: 0.1,
    admissionPigment: 0.3,
    admissionRest: 60,
    lifespan: 480,
    starvationLimit: 60,
    reserveCapacity: 0.2,
    cargoCapacity: 0.8,
    intakeRate: 0.04,
    maintenanceRate: 0.001,
    feedReach: 22,
    rootReach: 32,
    spacing: 64,
    margin: 14,
    coarseThreshold: 0.12,
    currentFeedSpeed: 0.5,
    shoreMin: 0.65,
    shoreMax: 0.9,
  },
  cargoMite: {
    cap: CARGO_MITE_CAP,
    bodyPigment: 0.1,
    initialReserve: 0.4,
    admissionPigment: 0.5,
    admissionRest: 60,
    admissionThreshold: 0.5,
    reserveCapacity: 0.5,
    intakeRate: 0.008,
    maintenanceRate: 0.0005,
    childCost: 0.2,
    childBody: 0.1,
    childReserve: 0.1,
    maturityAge: 30,
    breedingRest: 60,
    lifespan: 240,
    starvationLimit: 60,
    seekReach: 80,
    attachReach: 10,
    speed: 8,
    margin: 11,
    spacing: 48,
    hostCap: 2,
  },
} as const;

export function activeNewTypePopulation(world: World): number {
  return (
    world.skimmers.length +
    world.reedwells.length +
    world.rainbells.length +
    world.siltstitchers.length +
    world.glassLimpets.length +
    world.cargoMites.length
  );
}
