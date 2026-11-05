import { confinePosition } from '../geometry';
import { FOSSIL_CAPACITY, LIMITS, isInPool, type Fossil, type FossilSource, type Point, type World } from '../types';
import { blendHue, returnPigment, safeId } from './resources';

export const FOSSIL_MERGE_REACH = 36;
export const FOSSIL_MIN = 0.001;
export const FOSSIL_SOURCES: FossilSource[] = [
  'skimmer',
  'reedwell',
  'rainbell',
  'siltstitcher',
  'glassLimpet',
  'cargoMite',
  'marlgrub',
];

export const FOSSIL_LABEL: Record<FossilSource, { singular: string; plural: string }> = {
  skimmer: { singular: 'skimmer', plural: 'skimmers' },
  reedwell: { singular: 'reedwell', plural: 'reedwells' },
  rainbell: { singular: 'rainbell', plural: 'rainbells' },
  siltstitcher: { singular: 'siltstitcher', plural: 'siltstitchers' },
  glassLimpet: { singular: 'glass limpet', plural: 'glass limpets' },
  cargoMite: { singular: 'cargo mite', plural: 'cargo mites' },
  marlgrub: { singular: 'marlgrub', plural: 'marlgrubs' },
};

export function isFossilSource(value: unknown): value is FossilSource {
  return typeof value === 'string' && (FOSSIL_SOURCES as string[]).includes(value);
}

export function isRemainSource(value: unknown): value is World['remains'][number]['source'] {
  return value === 'unknown' || isFossilSource(value);
}

export function fossilRadius(pigment: number): number {
  return Math.min(14, 5 + Math.max(0, pigment) * 5);
}

export function heldFossilPigment(world: Pick<World, 'fossils'>): number {
  let total = 0;
  for (const fossil of world.fossils) total += fossil.pigment;
  return total;
}

export function lineageAlive(world: World, source: FossilSource): boolean {
  switch (source) {
    case 'skimmer':
      return world.skimmers.length > 0;
    case 'reedwell':
      return world.reedwells.length > 0;
    case 'rainbell':
      return world.rainbells.length > 0;
    case 'siltstitcher':
      return world.siltstitchers.length > 0;
    case 'glassLimpet':
      return world.glassLimpets.length > 0;
    case 'cargoMite':
      return world.cargoMites.length > 0;
    case 'marlgrub':
      return world.marlgrubs.length > 0;
  }
}

function nearestFossil(world: World, point: Point, source: FossilSource, reach: number): Fossil | undefined {
  let nearest: Fossil | undefined;
  let distance = reach;
  for (const fossil of world.fossils) {
    if (fossil.source !== source) continue;
    const candidate = Math.hypot(fossil.x - point.x, fossil.y - point.y);
    if (candidate < distance || (candidate === distance && (!nearest || fossil.id < nearest.id))) {
      distance = candidate;
      nearest = fossil;
    }
  }
  return nearest;
}

export function depositFossil(world: World, point: Point, hue: number, pigment: number, source: FossilSource): void {
  let amount = pigment;
  if (amount <= 0) return;
  const location = { x: point.x, y: point.y };
  if (!isInPool(location.x, location.y)) confinePosition(location, 0);
  const nearby = nearestFossil(world, location, source, FOSSIL_MERGE_REACH);
  if (nearby) {
    const added = Math.min(amount, Math.max(0, FOSSIL_CAPACITY - nearby.pigment));
    if (added > 0) {
      nearby.hue = blendHue(nearby.hue, hue, nearby.pigment, added);
      nearby.pigment += added;
      nearby.radius = fossilRadius(nearby.pigment);
      world.ecologyLedger.fossilsFormed += added;
      amount -= added;
    }
    if (amount > 0) returnPigment(world, location, hue, amount);
    return;
  }
  if (amount >= FOSSIL_MIN && world.fossils.length < LIMITS.fossils && safeId(world)) {
    const held = Math.min(amount, FOSSIL_CAPACITY);
    world.fossils.push({
      id: world.nextId++,
      species: 'fossil',
      source,
      x: location.x,
      y: location.y,
      pigment: held,
      hue,
      age: 0,
      radius: fossilRadius(held),
      formedAt: world.elapsed,
    });
    world.ecologyLedger.fossilsFormed += held;
    amount -= held;
  }
  if (amount > 0) returnPigment(world, location, hue, amount);
}

export function fossilsBySource(
  world: Pick<World, 'fossils'>,
): Record<FossilSource, { count: number; pigment: number }> {
  const summary = {} as Record<FossilSource, { count: number; pigment: number }>;
  for (const source of FOSSIL_SOURCES) summary[source] = { count: 0, pigment: 0 };
  for (const fossil of world.fossils) {
    summary[fossil.source].count += 1;
    summary[fossil.source].pigment += fossil.pigment;
  }
  return summary;
}
