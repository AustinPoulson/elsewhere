import type { World } from '../types';
import { activeNewTypePopulation, NEW_TYPE_POPULATION_CAP, SPECIES_CATALOG } from './catalog';
import { admitSkimmer } from './skimmer';
import { admitReedwell } from './reedwell';
import { admitRainbell } from './rainbell';
import { admitSiltstitcher } from './siltstitcher';
import { admitGlassLimpet } from './glass-limpet';
import { admitCargoMite } from './cargo-mite';
import { safeId } from './resources';

// Catalog definitions are possible life; this fixed registry schedules scans
// without allocating a body for every available type. Additions extend the
// rotation rather than multiplying normal source work per simulation phase.
const FOUNDERS = [
  { cap: SPECIES_CATALOG.skimmer.cap, population: (world: World) => world.skimmers.length, admit: admitSkimmer },
  { cap: SPECIES_CATALOG.reedwell.cap, population: (world: World) => world.reedwells.length, admit: admitReedwell },
  { cap: SPECIES_CATALOG.rainbell.cap, population: (world: World) => world.rainbells.length, admit: admitRainbell },
  { cap: SPECIES_CATALOG.siltstitcher.cap, population: (world: World) => world.siltstitchers.length, admit: admitSiltstitcher },
  { cap: SPECIES_CATALOG.glassLimpet.cap, population: (world: World) => world.glassLimpets.length, admit: admitGlassLimpet },
  { cap: SPECIES_CATALOG.cargoMite.cap, population: (world: World) => world.cargoMites.length, admit: admitCargoMite },
] as const;

export const NORMAL_FOUNDER_COUNT = FOUNDERS.length;

export function foundingBudgetAvailable(world: World): boolean {
  return world.tick >= world.nextFoundingTick && world.tick <= Number.MAX_SAFE_INTEGER - 6
    && safeId(world) && activeNewTypePopulation(world) < NEW_TYPE_POPULATION_CAP;
}

// An actual birth, including a future off-phase death offer, takes the same
// saved six-tick slot. Refusals leave the budget and all paid resources alone.
export function tryEventFounding(world: World, offer: (world: World) => boolean): boolean {
  if (!foundingBudgetAvailable(world)) return false;
  if (!offer(world)) return false;
  world.nextFoundingTick = world.tick + 6;
  return true;
}

export function runNormalFounding(world: World): boolean {
  if (world.tick % 6 !== 0) return false;
  const founder = FOUNDERS[world.foundingTypeCursor];
  // The cursor advances even when this type is capped, unready, or its source
  // refuses payment. No other type searches during this six-tick phase.
  world.foundingTypeCursor = (world.foundingTypeCursor + 1) % FOUNDERS.length;
  if (!foundingBudgetAvailable(world) || founder.population(world) >= founder.cap) return false;
  if (!founder.admit(world)) return false;
  world.nextFoundingTick = world.tick + 6;
  return true;
}
