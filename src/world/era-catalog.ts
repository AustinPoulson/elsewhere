import { parseEraCatalog, type NamedEra } from './eras';
import anHourUnwatched from './era-snapshots/an-hour-unwatched.json';
import thirtyDaysUnwatched from './era-snapshots/thirty-days-unwatched.json';
import anotherSeedsSediment from './era-snapshots/another-seeds-sediment.json';

const ERA_FIXTURES: unknown[] = [anHourUnwatched, thirtyDaysUnwatched, anotherSeedsSediment];
const files = ERA_FIXTURES.map((file) => JSON.stringify(file));
const loaded = parseEraCatalog(files);
if (!loaded) throw new Error('The named eras could not be opened.');
const catalog: readonly NamedEra[] = loaded;

export function namedEras(): readonly NamedEra[] {
  return catalog;
}

export function eraById(id: string): NamedEra | null {
  return catalog.find((era) => era.id === id) ?? null;
}

export function isReviewedEraId(id: string): boolean {
  return catalog.some((era) => era.id === id);
}

export function eraCatalogBytes(): number {
  return files.reduce((total, file) => total + file.length, 0);
}
