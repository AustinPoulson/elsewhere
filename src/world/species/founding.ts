import type { World } from '../types';
import { activeNewTypePopulation, NEW_TYPE_POPULATION_CAP, SPECIES_CATALOG } from './catalog';
import { admitSkimmer } from './skimmer';
import { admitReedwell } from './reedwell';
import { admitRainbell } from './rainbell';
import { admitSiltstitcher } from './siltstitcher';
import { admitGlassLimpet } from './glass-limpet';
import { admitCargoMite } from './cargo-mite';
import { safeId } from './resources';

const FOUNDERS = [
  { cap: SPECIES_CATALOG.skimmer.cap, population: (world: World) => world.skimmers.length, admit: admitSkimmer },
  { cap: SPECIES_CATALOG.reedwell.cap, population: (world: World) => world.reedwells.length, admit: admitReedwell },
  { cap: SPECIES_CATALOG.rainbell.cap, population: (world: World) => world.rainbells.length, admit: admitRainbell },
  {
    cap: SPECIES_CATALOG.siltstitcher.cap,
    population: (world: World) => world.siltstitchers.length,
    admit: admitSiltstitcher,
  },
  {
    cap: SPECIES_CATALOG.glassLimpet.cap,
    population: (world: World) => world.glassLimpets.length,
    admit: admitGlassLimpet,
  },
  { cap: SPECIES_CATALOG.cargoMite.cap, population: (world: World) => world.cargoMites.length, admit: admitCargoMite },
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

export function runNormalFounding(world: World): boolean {
  if (world.tick % 6 !== 0) return false;
  const founder = FOUNDERS[world.foundingTypeCursor % FOUNDERS.length];
  world.foundingTypeCursor = (world.foundingTypeCursor + 1) % FOUNDERS.length;
  if (!foundingBudgetAvailable(world) || founder.population(world) >= founder.cap) return false;
  if (!founder.admit(world)) return false;
  world.nextFoundingTick = world.tick + 6;
  return true;
}
