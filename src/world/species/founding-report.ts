import { containingPool, shoreRho } from '../habitat';
import { effectiveWeather } from '../weather';
import type { World } from '../types';
import { SPECIES_CATALOG } from './catalog';

export const FOUNDING_KINDS = [
  'skimmer',
  'reedwell',
  'rainbell',
  'siltstitcher',
  'glassLimpet',
  'cargoMite',
  'marlgrub',
] as const;

export type FoundingKind = (typeof FOUNDING_KINDS)[number];
export type FoundingRefuse = 'cap' | 'rest' | 'budget' | 'no-resource' | 'no-offer';

export interface FoundingTally {
  polls: number;
  accepted: number;
  cap: number;
  rest: number;
  budget: number;
  noResource: number;
  noOffer: number;
  lastAcceptedAt: number | null;
}

export interface FoundingStock {
  worldTime: number;
  coarseShore: number;
  coarseShorePigment: number;
  shorePigment: number;
  coarseAnywhere: number;
  payableRemains: number;
  remainPigment: number;
  richNests: number;
  nestPigment: number;
  fossils: number;
  fossilPigment: number;
}

export type FoundingCensus = Record<FoundingKind, FoundingTally>;

const LIMEST = SPECIES_CATALOG.glassLimpet;
const SILT = SPECIES_CATALOG.siltstitcher;
const GRUB = SPECIES_CATALOG.marlgrub;

const watchers = new WeakMap<World, FoundingCensus>();

function emptyTally(): FoundingTally {
  return {
    polls: 0,
    accepted: 0,
    cap: 0,
    rest: 0,
    budget: 0,
    noResource: 0,
    noOffer: 0,
    lastAcceptedAt: null,
  };
}

export function emptyFoundingCensus(): FoundingCensus {
  const census = {} as FoundingCensus;
  for (const kind of FOUNDING_KINDS) census[kind] = emptyTally();
  return census;
}

export function watchFounding(world: World): FoundingCensus {
  let census = watchers.get(world);
  if (!census) {
    census = emptyFoundingCensus();
    watchers.set(world, census);
  }
  return census;
}

export function foundingCensus(world: World): FoundingCensus | undefined {
  return watchers.get(world);
}

export function recordFoundingPoll(world: World, kind: FoundingKind, accepted: boolean, refuse?: FoundingRefuse): void {
  const census = watchers.get(world);
  if (!census) return;
  const tally = census[kind];
  tally.polls += 1;
  if (accepted) {
    tally.accepted += 1;
    tally.lastAcceptedAt = world.elapsed;
    return;
  }
  if (refuse === 'cap') tally.cap += 1;
  else if (refuse === 'rest') tally.rest += 1;
  else if (refuse === 'budget') tally.budget += 1;
  else if (refuse === 'no-offer') tally.noOffer += 1;
  else tally.noResource += 1;
}

const ADMISSION_AT: Record<FoundingKind, (world: World) => number> = {
  skimmer: (world) => world.skimmerAdmissionAt,
  reedwell: (world) => world.reedwellAdmissionAt,
  rainbell: (world) => world.rainbellAdmissionAt,
  siltstitcher: (world) => world.siltstitcherAdmissionAt,
  glassLimpet: (world) => world.glassLimpetAdmissionAt,
  cargoMite: (world) => world.cargoMiteAdmissionAt,
  marlgrub: (world) => world.marlgrubAdmissionAt,
};

export function classifyFoundingRefuse(world: World, kind: FoundingKind, budgetOpen: boolean): FoundingRefuse {
  if (!budgetOpen) return 'budget';
  if (world.elapsed < ADMISSION_AT[kind](world)) return 'rest';
  if (kind === 'reedwell' || kind === 'rainbell') {
    if (effectiveWeather(world).intensity < 0.5) return 'no-offer';
  }
  if (kind === 'marlgrub' && world.remains.length === 0) return 'no-offer';
  return 'no-resource';
}

function inLimpetShore(x: number, y: number): boolean {
  const pool = containingPool(x, y, LIMEST.margin);
  if (!pool) return false;
  const rho = shoreRho(x, y, pool);
  return rho >= LIMEST.shoreMin && rho <= LIMEST.shoreMax;
}

export function probeFoundingStock(world: World): FoundingStock {
  let coarseShore = 0;
  let coarseShorePigment = 0;
  let shorePigment = 0;
  let coarseAnywhere = 0;
  for (const grain of world.sediment) {
    if (grain.strength >= LIMEST.coarseThreshold) coarseAnywhere += 1;
    if (!inLimpetShore(grain.x, grain.y)) continue;
    shorePigment += grain.strength;
    if (grain.strength >= LIMEST.coarseThreshold) {
      coarseShore += 1;
      coarseShorePigment += grain.strength;
    }
  }
  let payableRemains = 0;
  let remainPigment = 0;
  for (const remain of world.remains) {
    remainPigment += remain.pigment;
    if (remain.pigment >= GRUB.admissionPigment) payableRemains += 1;
  }
  let richNests = 0;
  let nestPigment = 0;
  for (const nest of world.nests) {
    nestPigment += nest.pigment;
    if (nest.pigment >= SILT.admissionThreshold) richNests += 1;
  }
  let fossilPigment = 0;
  for (const fossil of world.fossils) fossilPigment += fossil.pigment;
  return {
    worldTime: world.elapsed,
    coarseShore,
    coarseShorePigment,
    shorePigment,
    coarseAnywhere,
    payableRemains,
    remainPigment,
    richNests,
    nestPigment,
    fossils: world.fossils.length,
    fossilPigment,
  };
}
