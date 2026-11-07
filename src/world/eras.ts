import { restoreWorld, serializeWorld } from './persistence';
import { addLight, createWorld, SPRINGS, stepWorld } from './simulation';
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
    !finite(parsed.provenance.worldDays, 1 / ERA_DAY_SECONDS, 365) ||
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
  const file: EraFile = {
    format: ERA_FORMAT,
    formatRevision: ERA_FORMAT_REVISION,
    id: options.id,
    name: options.name,
    note: options.note,
    provenance: {
      seed: world.seed,
      worldDays: options.worldDays,
      visitorLight: options.visitorLight,
      schemaRevision: SCHEMA_REVISION,
      source: options.source,
    },
    world: JSON.parse(serializeWorld(world)) as unknown,
  };
  const era = parseEraFile(JSON.stringify(file));
  if (!era) throw new Error(`The era “${options.id}” could not be captured within the named-era format.`);
  return { file, era };
}
