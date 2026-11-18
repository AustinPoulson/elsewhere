import type { World } from '../types';
import { activeNewTypePopulation, NEW_TYPE_POPULATION_CAP, SPECIES_CATALOG } from './catalog';
import { admitSkimmer } from './skimmer';
import { admitReedwell } from './reedwell';
import { admitRainbell } from './rainbell';
import { admitSiltstitcher } from './siltstitcher';
import { admitGlassLimpet } from './glass-limpet';
import { admitCargoMite } from './cargo-mite';
import { classifyFoundingRefuse, recordFoundingPoll } from './founding-report';
import { safeId } from './resources';

const FOUNDERS = [
  {
    kind: 'skimmer' as const,
    cap: SPECIES_CATALOG.skimmer.cap,
    population: (world: World) => world.skimmers.length,
    admit: admitSkimmer,
  },
  {
    kind: 'reedwell' as const,
    cap: SPECIES_CATALOG.reedwell.cap,
    population: (world: World) => world.reedwells.length,
    admit: admitReedwell,
  },
  {
    kind: 'rainbell' as const,
    cap: SPECIES_CATALOG.rainbell.cap,
    population: (world: World) => world.rainbells.length,
    admit: admitRainbell,
  },
  {
    kind: 'siltstitcher' as const,
    cap: SPECIES_CATALOG.siltstitcher.cap,
    population: (world: World) => world.siltstitchers.length,
    admit: admitSiltstitcher,
  },
  {
    kind: 'glassLimpet' as const,
    cap: SPECIES_CATALOG.glassLimpet.cap,
    population: (world: World) => world.glassLimpets.length,
    admit: admitGlassLimpet,
  },
  {
    kind: 'cargoMite' as const,
    cap: SPECIES_CATALOG.cargoMite.cap,
    population: (world: World) => world.cargoMites.length,
    admit: admitCargoMite,
  },
] as const;

export const NORMAL_FOUNDER_COUNT = FOUNDERS.length;

export function foundingBudgetAvailable(world: World): boolean {
  return (
    world.tick >= world.nextFoundingTick &&
    world.tick <= Number.MAX_SAFE_INTEGER - 6 &&
    safeId(world) &&
    activeNewTypePopulation(world) < NEW_TYPE_POPULATION_CAP
  );
}

export function tryEventFounding(world: World, offer: (world: World) => boolean): boolean {
  if (!foundingBudgetAvailable(world)) return false;
  if (!offer(world)) return false;
  world.nextFoundingTick = world.tick + 6;
  return true;
}

export function tryMarlgrubFounding(world: World, offer: (world: World) => boolean): boolean {
  if (world.remains.length === 0) {
    if (world.tick % 6 === 0) recordFoundingPoll(world, 'marlgrub', false, 'no-offer');
    return false;
  }
  const budgetOpen = foundingBudgetAvailable(world);
  const accepted = tryEventFounding(world, offer);
  if (accepted) recordFoundingPoll(world, 'marlgrub', true);
  else if (world.tick % 6 === 0)
    recordFoundingPoll(world, 'marlgrub', false, classifyFoundingRefuse(world, 'marlgrub', budgetOpen));
  return accepted;
}

export function runNormalFounding(world: World): boolean {
  if (world.tick % 6 !== 0) return false;
  const founder = FOUNDERS[world.foundingTypeCursor % FOUNDERS.length];
  world.foundingTypeCursor = (world.foundingTypeCursor + 1) % FOUNDERS.length;
  const atCap = founder.population(world) >= founder.cap;
  const budgetOpen = foundingBudgetAvailable(world);
  if (!budgetOpen || atCap) {
    recordFoundingPoll(world, founder.kind, false, atCap ? 'cap' : 'budget');
    return false;
  }
  if (!founder.admit(world)) {
    recordFoundingPoll(world, founder.kind, false, classifyFoundingRefuse(world, founder.kind, true));
    return false;
  }
  world.nextFoundingTick = world.tick + 6;
  recordFoundingPoll(world, founder.kind, true);
  return true;
}
