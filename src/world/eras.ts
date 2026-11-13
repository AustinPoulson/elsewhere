import { inInletPool } from './habitat';
import { MINERAL_SEAM, seamRemaining } from './environment/mineral-seam';
import { seasonLabel } from './environment/seasons';
import { restoreWorld, serializeWorld } from './persistence';
import { FOSSIL_LABEL, FOSSIL_SOURCES, fossilsBySource } from './species/fossils';
import { addLight, createWorld, getStats, SPRINGS, stepWorld } from './simulation';
import { FIXED_STEP, SCHEMA_REVISION, type World } from './types';

export const ERA_FORMAT = 'elsewhere-era';
export const ERA_FORMAT_REVISION = 1;
export const MAX_NAMED_ERAS = 8;
export const MAX_ERA_ID_LENGTH = 48;
export const MAX_ERA_NAME_LENGTH = 72;
export const MAX_ERA_NOTE_LENGTH = 720;
export const MAX_ERA_SOURCE_LENGTH = 280;
export const MAX_ERA_SNAPSHOT_LENGTH = 1_000_000;
export const MAX_ERA_FILE_LENGTH = 1_002_000;
export const MAX_ERA_CATALOG_BYTES = 4_000_000;
export const MAX_ERA_WORLD_DAYS = 100_000;
export const ERA_DAY_SECONDS = 360;

export interface EraProvenance {
  seed: number;
  worldDays: number;
  visitorLight: boolean;
  schemaRevision: number;
  source: string;
}

export interface EraFile {
  format: typeof ERA_FORMAT;
  formatRevision: typeof ERA_FORMAT_REVISION;
  id: string;
  name: string;
  note: string;
  provenance: EraProvenance;
  world: unknown;
}

export interface NamedEra {
  id: string;
  name: string;
  note: string;
  provenance: EraProvenance;
  world: World;
  snapshot: string;
}

export interface CaptureEraOptions {
  id: string;
  name: string;
  note: string;
  seed: number;
  worldDays: number;
  visitorLight: boolean;
  source: string;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function integer(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}

function finite(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function text(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

export function isEraId(value: unknown): value is string {
  return text(value, MAX_ERA_ID_LENGTH) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function parseEraFile(input: string): NamedEra | null {
  if (typeof input !== 'string' || input.length === 0 || input.length > MAX_ERA_FILE_LENGTH) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(input) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
  if (
    !record(parsed) ||
    parsed.format !== ERA_FORMAT ||
    parsed.formatRevision !== ERA_FORMAT_REVISION ||
    !isEraId(parsed.id) ||
    !text(parsed.name, MAX_ERA_NAME_LENGTH) ||
    !text(parsed.note, MAX_ERA_NOTE_LENGTH) ||
    !record(parsed.provenance) ||
    !integer(parsed.provenance.seed, 0, 0xffffffff) ||
    !finite(parsed.provenance.worldDays, 0, MAX_ERA_WORLD_DAYS) ||
    typeof parsed.provenance.visitorLight !== 'boolean' ||
    !integer(parsed.provenance.schemaRevision, 1, SCHEMA_REVISION) ||
    !text(parsed.provenance.source, MAX_ERA_SOURCE_LENGTH) ||
    !('world' in parsed)
  )
    return null;
  const snapshot = JSON.stringify(parsed.world);
  if (snapshot.length === 0 || snapshot.length > MAX_ERA_SNAPSHOT_LENGTH) return null;
  const world = restoreWorld(snapshot);
  if (!world || world.seed !== parsed.provenance.seed) return null;
  const expectedElapsed = parsed.provenance.worldDays * ERA_DAY_SECONDS;
  if (Math.abs(world.elapsed - expectedElapsed) > FIXED_STEP) return null;
  return {
    id: parsed.id,
    name: parsed.name,
    note: parsed.note,
    provenance: {
      seed: parsed.provenance.seed,
      worldDays: parsed.provenance.worldDays,
      visitorLight: parsed.provenance.visitorLight,
      schemaRevision: parsed.provenance.schemaRevision,
      source: parsed.provenance.source,
    },
    world,
    snapshot,
  };
}

export function parseEraCatalog(files: string[]): NamedEra[] | null {
  if (!Array.isArray(files) || files.length === 0 || files.length > MAX_NAMED_ERAS) return null;
  let total = 0;
  const eras: NamedEra[] = [];
  const ids = new Set<string>();
  for (const file of files) {
    if (typeof file !== 'string') return null;
    total += file.length;
    if (total > MAX_ERA_CATALOG_BYTES) return null;
    const era = parseEraFile(file);
    if (!era || ids.has(era.id)) return null;
    ids.add(era.id);
    eras.push(era);
  }
  return eras;
}

export function captureNamedEra(options: CaptureEraOptions): { file: EraFile; era: NamedEra } {
  if (!Number.isFinite(options.worldDays) || options.worldDays <= 0) {
    throw new RangeError('Era capture needs a positive number of world days.');
  }
  const world = createWorld(options.seed);
  const targetSteps = Math.ceil((options.worldDays * ERA_DAY_SECONDS) / FIXED_STEP);
  let lastVisitorDay = Math.floor(world.elapsed / ERA_DAY_SECONDS);
  for (let step = 0; step < targetSteps; step++) {
    stepWorld(world);
    if (options.visitorLight) {
      const day = Math.floor(world.elapsed / ERA_DAY_SECONDS);
      if (day > lastVisitorDay) {
        const spring = SPRINGS[day % SPRINGS.length];
        addLight(world, spring.x, spring.y);
        lastVisitorDay = day;
      }
    }
  }
  world.lastSeenAt = null;
  world.awayTraces = [];
  world.shoreMemory = [];
  const file = eraFileFromWorld(world, {
    id: options.id,
    name: options.name,
    note: options.note,
    worldDays: options.worldDays,
    visitorLight: options.visitorLight,
    source: options.source,
  });
  const era = parseEraFile(JSON.stringify(file));
  if (!era) throw new Error(`The era “${options.id}” could not be captured within the named-era format.`);
  return { file, era };
}

export function describeKeptEra(world: World): { name: string; note: string } {
  const name = keptEraName(world);
  const stats = getStats(world);
  const days = world.elapsed / ERA_DAY_SECONDS;
  const when =
    world.elapsed < FIXED_STEP
      ? 'at its opening'
      : days < 1
        ? `at ${clockLabel(world.elapsed)}`
        : `after ${worldDaysLabel(days)}`;
  const season = seasonLabel(world.elapsed).toLowerCase();
  const living = livingCensus(world);
  const fossils = fossilNote(world);
  const inlet = world.sediment.reduce(
    (total, grain) => total + (inInletPool(grain.x, grain.y) ? grain.strength : 0),
    0,
  );
  const seam = seamRemaining(world);
  const light = world.consumed > 0 ? 'Visitor light has been used.' : 'No visitor light was left.';
  const pigment =
    inlet >= 0.05
      ? `Nested color is ${stats.nestPigment.toFixed(1)}; ${stats.pigment.toFixed(1)} pigment lies loose, ${inlet.toFixed(1)} of it in the inlet.`
      : `Nested color is ${stats.nestPigment.toFixed(1)}; ${stats.pigment.toFixed(1)} pigment lies loose.`;
  const rock =
    seam <= 0
      ? 'The mineral seam is spent.'
      : `The mineral seam still holds ${seam.toFixed(1)} of ${MINERAL_SEAM.capacity}.`;
  const note = [`Kept from seed ${world.seed} ${when}, in ${season}.`, living, fossils, pigment, rock, light]
    .filter((part) => part.length > 0)
    .join(' ');
  return {
    name: name.slice(0, MAX_ERA_NAME_LENGTH),
    note: note.slice(0, MAX_ERA_NOTE_LENGTH),
  };
}

export function keepLiveEra(world: World, id: string): { file: EraFile; era: NamedEra } | null {
  if (!isEraId(id)) return null;
  const before = serializeWorld(world);
  const frozen = structuredClone(world);
  frozen.lastSeenAt = null;
  frozen.awayTraces = [];
  frozen.shoreMemory = [];
  const identity = describeKeptEra(frozen);
  const worldDays = frozen.elapsed / ERA_DAY_SECONDS;
  if (worldDays > MAX_ERA_WORLD_DAYS) return null;
  const visitorLight = frozen.consumed > 0;
  const file = eraFileFromWorld(frozen, {
    id,
    name: identity.name,
    note: identity.note,
    worldDays,
    visitorLight,
    source: keptEraSource(frozen, visitorLight),
  });
  const era = parseEraFile(JSON.stringify(file));
  if (!era || serializeWorld(world) !== before) return null;
  return { file, era };
}

function eraFileFromWorld(
  world: World,
  identity: {
    id: string;
    name: string;
    note: string;
    worldDays: number;
    visitorLight: boolean;
    source: string;
  },
): EraFile {
  return {
    format: ERA_FORMAT,
    formatRevision: ERA_FORMAT_REVISION,
    id: identity.id,
    name: identity.name,
    note: identity.note,
    provenance: {
      seed: world.seed,
      worldDays: identity.worldDays,
      visitorLight: identity.visitorLight,
      schemaRevision: SCHEMA_REVISION,
      source: identity.source,
    },
    world: JSON.parse(serializeWorld(world)) as unknown,
  };
}

function keptEraSource(world: World, visitorLight: boolean): string {
  const days = world.elapsed / ERA_DAY_SECONDS;
  const age = world.elapsed < FIXED_STEP ? 'opening moment' : `${worldDaysLabel(days)} of recorded time`;
  const source = `Kept from the live shore, seed ${world.seed}, ${age}; visitor light ${visitorLight ? 'on' : 'off'}.`;
  return source.slice(0, MAX_ERA_SOURCE_LENGTH);
}

function keptEraName(world: World): string {
  if (world.elapsed < FIXED_STEP) return 'This shore at its opening';
  const days = world.elapsed / ERA_DAY_SECONDS;
  if (days < 1) return `This shore at ${clockLabel(world.elapsed)}`;
  return `This shore after ${worldDaysLabel(days)}`;
}

function clockLabel(seconds: number): string {
  const mins = Math.floor(Math.max(0, seconds) / 60);
  const secs = Math.floor(Math.max(0, seconds) % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function worldDaysLabel(days: number): string {
  const rounded = Math.round(days * 10) / 10;
  const amount = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${amount} world day${rounded === 1 ? '' : 's'}`;
}

function livingCensus(world: World): string {
  const stats = getStats(world);
  const mortal: string[] = [];
  if (stats.skimmers > 0) mortal.push(`${stats.skimmers} skimmer${stats.skimmers === 1 ? '' : 's'}`);
  if (stats.reedwells > 0) mortal.push(`${stats.reedwells} reedwell${stats.reedwells === 1 ? '' : 's'}`);
  if (stats.rainbells > 0) mortal.push(`${stats.rainbells} rainbell${stats.rainbells === 1 ? '' : 's'}`);
  if (stats.siltstitchers > 0)
    mortal.push(`${stats.siltstitchers} siltstitcher${stats.siltstitchers === 1 ? '' : 's'}`);
  if (stats.glassLimpets > 0) mortal.push(`${stats.glassLimpets} glass limpet${stats.glassLimpets === 1 ? '' : 's'}`);
  if (stats.cargoMites > 0) mortal.push(`${stats.cargoMites} cargo mite${stats.cargoMites === 1 ? '' : 's'}`);
  if (stats.marlgrubs > 0) mortal.push(`${stats.marlgrubs} marlgrub${stats.marlgrubs === 1 ? '' : 's'}`);
  const floor = `${stats.population} lucent${stats.population === 1 ? '' : 's'} and ${stats.grazers} grazer${stats.grazers === 1 ? '' : 's'} remain`;
  if (mortal.length === 0) return `${floor}.`;
  return `${floor}, with ${listPhrase(mortal)}.`;
}

function fossilNote(world: World): string {
  if (world.fossils.length === 0) return '';
  const summary = fossilsBySource(world);
  const names: string[] = [];
  for (const source of FOSSIL_SOURCES) {
    if (summary[source].count > 0) names.push(FOSSIL_LABEL[source].plural);
  }
  if (names.length === 0) return '';
  return `Fossils hold impressions of ${listPhrase(names)}.`;
}

function listPhrase(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}
