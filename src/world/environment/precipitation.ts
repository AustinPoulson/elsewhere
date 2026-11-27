import { confinePosition } from '../geometry';
import { containingPool, inSea, mouthSegment, tideConnectedAt } from '../habitat';
import { SPECIES_CATALOG } from '../species/catalog';
import { blendHue, MIN_SEDIMENT_GRAIN, safeId } from '../species/resources';
import { LIMITS, type HabitatPool, type Point, type Sediment, type World } from '../types';
import { effectiveWeather } from '../weather';
import { DEEP_BASIN, inDeep } from './depth';

export const PRECIPITATION = {
  amount: 0.008,
  coarse: SPECIES_CATALOG.glassLimpet.coarseThreshold,
  grainCap: LIMITS.sediment,
} as const;

function nearMouth(point: Point): boolean {
  const link = mouthSegment();
  const reach = link.width / 2 + 18;
  const abx = link.bx - link.ax;
  const aby = link.by - link.ay;
  const span = abx * abx + aby * aby;
  const t = span === 0 ? 0 : Math.min(1, Math.max(0, ((point.x - link.ax) * abx + (point.y - link.ay) * aby) / span));
  return Math.hypot(point.x - (link.ax + t * abx), point.y - (link.ay + t * aby)) <= reach;
}

function basinOf(point: Point): HabitatPool | null {
  return containingPool(point.x, point.y);
}

export function inStillWater(world: World, x: number, y: number): boolean {
  if (nearMouth({ x, y })) return false;
  if (inDeep(x, y)) return true;
  if (effectiveWeather(world).intensity > 0) return false;
  if (inSea(x, y)) return true;
  const basin = containingPool(x, y);
  if (!basin || basin.id === 3) return false;
  return !tideConnectedAt(world.elapsed);
}

function isFine(grain: Sediment): boolean {
  return grain.strength > 0 && grain.strength < PRECIPITATION.coarse;
}

function isCoarse(grain: Sediment): boolean {
  return grain.strength >= PRECIPITATION.coarse;
}

function underfilled(grain: Sediment): boolean {
  return grain.strength > 0 && grain.strength < 1;
}

function sameBasin(a: Point, b: Point): boolean {
  const left = basinOf(a);
  const right = basinOf(b);
  return !!left && !!right && left.id === right.id;
}

function nearestUnderfilled(world: World, source: Sediment, coarseOnly: boolean): Sediment | undefined {
  let nearest: Sediment | undefined;
  let distance = Infinity;
  for (const grain of world.sediment) {
    if (grain.id === source.id || !underfilled(grain)) continue;
    if (coarseOnly && !isCoarse(grain)) continue;
    if (!sameBasin(source, grain)) continue;
    const candidate = Math.hypot(grain.x - source.x, grain.y - source.y);
    if (candidate < distance || (candidate === distance && (!nearest || grain.id < nearest.id))) {
      distance = candidate;
      nearest = grain;
    }
  }
  return nearest;
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

function discardEmptyGrains(world: World): void {
  let write = 0;
  for (const grain of world.sediment) {
    if (grain.strength > 0) world.sediment[write++] = grain;
  }
  world.sediment.length = write;
}

function toward(from: Point, dest: Point): Point {
  const dx = dest.x - from.x;
  const dy = dest.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) return { x: from.x, y: from.y };
  const step = Math.min(8, dist * 0.15);
  return { x: from.x + (dx / dist) * step, y: from.y + (dy / dist) * step };
}

function nucleatePoint(source: Point): Point {
  const dest = inDeep(source.x, source.y) ? { x: DEEP_BASIN.x, y: DEEP_BASIN.y } : (basinOf(source) ?? source);
  const point = toward(source, dest);
  confinePosition(point, 6);
  return point;
}

function nucleateGrain(world: World, source: Sediment): number {
  if (world.sediment.length >= PRECIPITATION.grainCap || !safeId(world)) return 0;
  const moved = Math.min(source.strength, Math.max(PRECIPITATION.amount, MIN_SEDIMENT_GRAIN));
  if (moved < MIN_SEDIMENT_GRAIN) return 0;
  const point = nucleatePoint(source);
  world.sediment.push({
    id: world.nextId++,
    x: point.x,
    y: point.y,
    radius: 6,
    hue: source.hue,
    strength: moved,
    age: 0,
  });
  source.strength -= moved;
  return moved;
}

export function receivingGrain(world: World, source: Sediment): Sediment | undefined {
  return nearestUnderfilled(world, source, true) ?? nearestUnderfilled(world, source, false);
}

export function looseColorSettling(world: World): boolean {
  for (const grain of world.sediment) {
    if (!isFine(grain) || !inStillWater(world, grain.x, grain.y)) continue;
    if (receivingGrain(world, grain)) return true;
    if (world.sediment.length < PRECIPITATION.grainCap && grain.strength >= MIN_SEDIMENT_GRAIN) return true;
  }
  return false;
}

export function describePrecipitationChange(before: number, after: number): string | null {
  if (!Number.isFinite(before) || !Number.isFinite(after)) return null;
  if (after - before >= 0.2) return 'Loose color settled into grains.';
  return null;
}

export function heldSedimentPigment(world: Pick<World, 'sediment'>): number {
  let total = 0;
  for (const grain of world.sediment) total += grain.strength;
  return total;
}

export function precipitateLooseColor(world: World): void {
  if (world.tick % 6 !== 5) return;
  const fines: Sediment[] = [];
  for (const grain of world.sediment) {
    if (isFine(grain) && inStillWater(world, grain.x, grain.y)) fines.push(grain);
  }
  if (fines.length === 0) return;
  const source = fines[Math.floor(world.tick / 6) % fines.length];
  const dest = receivingGrain(world, source);
  const moved = dest ? pourSediment(dest, source, PRECIPITATION.amount) : nucleateGrain(world, source);
  if (!(moved > 0)) return;
  world.ecologyLedger.precipitated += moved;
  discardEmptyGrains(world);
}
