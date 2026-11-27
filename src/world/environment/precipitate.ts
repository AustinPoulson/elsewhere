import { inDeep } from './depth';
import { inStrandline } from './strandline';
import { effectiveWeather } from '../weather';
import {
  TIDE_INFLUENCE,
  TIDE_MOUTH_WIDTH,
  inOpeningPool,
  inSea,
  inTideMouth,
  mouthSegment,
  tideConnectedAt,
} from '../habitat';
import { blendHue, MIN_SEDIMENT_GRAIN, safeId } from '../species/resources';
import { SPECIES_CATALOG } from '../species/catalog';
import { LIMITS, type Point, type Sediment, type World } from '../types';

export const PRECIPITATE = {
  amount: 0.005,
  spawn: 0.026,
  coarse: SPECIES_CATALOG.glassLimpet.coarseThreshold,
} as const;

export type StillRegion = 'deep' | 'pool' | 'sea';

function awayFromMouth(x: number, y: number): boolean {
  if (inTideMouth(x, y)) return false;
  const link = mouthSegment();
  const reach = TIDE_MOUTH_WIDTH / 2 + TIDE_INFLUENCE;
  const abx = link.bx - link.ax;
  const aby = link.by - link.ay;
  const span = abx * abx + aby * aby;
  const t = span === 0 ? 0 : Math.min(1, Math.max(0, ((x - link.ax) * abx + (y - link.ay) * aby) / span));
  return Math.hypot(x - (link.ax + t * abx), y - (link.ay + t * aby)) > reach;
}

export function stillRegionAt(world: World, x: number, y: number): StillRegion | null {
  if (effectiveWeather(world).intensity > 0) return null;
  if (inDeep(x, y)) return 'deep';
  if (inSea(x, y) && awayFromMouth(x, y)) return 'sea';
  if (!tideConnectedAt(world.elapsed) && inOpeningPool(x, y)) return 'pool';
  return null;
}

function looseGrain(grain: Sediment): boolean {
  return grain.strength > 0 && grain.strength < PRECIPITATE.coarse && !inStrandline(grain.x, grain.y);
}

function underfilled(grain: Sediment): boolean {
  return grain.strength > 0 && grain.strength <= 1 - PRECIPITATE.amount && !inStrandline(grain.x, grain.y);
}

function packedDest(world: World, source: Sediment, region: StillRegion): Sediment | undefined {
  let packed: Sediment | undefined;
  let distance = Infinity;
  for (const grain of world.sediment) {
    if (grain.id === source.id || grain.strength <= 1 - PRECIPITATE.amount) continue;
    if (inStrandline(grain.x, grain.y)) continue;
    if (stillRegionAt(world, grain.x, grain.y) !== region) continue;
    const candidate = Math.hypot(grain.x - source.x, grain.y - source.y);
    if (candidate < distance || (candidate === distance && (!packed || grain.id < packed.id))) {
      distance = candidate;
      packed = grain;
    }
  }
  return packed;
}

function pourSediment(into: Sediment, from: Sediment, amount: number): number {
  const moved = Math.min(amount, from.strength, Math.max(0, 1 - into.strength));
  if (!(moved > 0)) return 0;
  into.hue = blendHue(into.hue, from.hue, into.strength, moved);
  into.strength += moved;
  from.strength -= moved;
  if (from.strength > 0 && from.strength < MIN_SEDIMENT_GRAIN && into.strength < 1) {
    const rest = Math.min(from.strength, 1 - into.strength);
    into.hue = blendHue(into.hue, from.hue, into.strength, rest);
    into.strength += rest;
    from.strength -= rest;
    return moved + rest;
  }
  return moved;
}

function spawnGrain(world: World, at: Point, hue: number, amount: number): number {
  const placed = Math.min(1, amount);
  if (placed < MIN_SEDIMENT_GRAIN || world.sediment.length >= LIMITS.sediment || !safeId(world)) return 0;
  world.sediment.push({
    id: world.nextId++,
    x: at.x,
    y: at.y,
    radius: 6,
    hue,
    strength: placed,
    age: 0,
  });
  return placed;
}

function nearestDest(world: World, source: Sediment, region: StillRegion, coarseOnly: boolean): Sediment | undefined {
  let nearest: Sediment | undefined;
  let distance = Infinity;
  for (const grain of world.sediment) {
    if (grain.id === source.id || !underfilled(grain)) continue;
    if (coarseOnly && grain.strength < PRECIPITATE.coarse) continue;
    if (stillRegionAt(world, grain.x, grain.y) !== region) continue;
    const candidate = Math.hypot(grain.x - source.x, grain.y - source.y);
    if (candidate < distance || (candidate === distance && (!nearest || grain.id < nearest.id))) {
      distance = candidate;
      nearest = grain;
    }
  }
  return nearest;
}

function destFor(world: World, source: Sediment, region: StillRegion): Sediment | undefined {
  return nearestDest(world, source, region, true) ?? nearestDest(world, source, region, false);
}

export function looseColorSettling(world: World): boolean {
  for (const grain of world.sediment) {
    if (!looseGrain(grain)) continue;
    const region = stillRegionAt(world, grain.x, grain.y);
    if (!region) continue;
    if (destFor(world, grain, region) || packedDest(world, grain, region)) return true;
  }
  return false;
}

export function precipitateLooseColor(world: World): void {
  if (world.tick % 6 !== 1) return;
  const sources: Sediment[] = [];
  for (const grain of world.sediment) {
    if (!looseGrain(grain)) continue;
    if (!stillRegionAt(world, grain.x, grain.y)) continue;
    sources.push(grain);
  }
  if (sources.length === 0) return;
  const source = sources[Math.floor(world.tick / 6) % sources.length];
  const region = stillRegionAt(world, source.x, source.y);
  if (!region) return;
  const dest = destFor(world, source, region);
  let moved = 0;
  if (dest) moved = pourSediment(dest, source, PRECIPITATE.amount);
  else {
    const packed = packedDest(world, source, region);
    if (packed) {
      const offered = Math.min(source.strength, PRECIPITATE.spawn);
      const placed = spawnGrain(world, packed, source.hue, offered);
      if (placed > 0) {
        source.strength -= placed;
        moved = placed;
      }
    }
  }
  if (moved > 0) world.ecologyLedger.precipitatedPigment += moved;
}
