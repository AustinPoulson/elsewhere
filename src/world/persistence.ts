import {
  GRAZER_CAPACITY, LIMITS, NEST_CAPACITY, isInPool,
  type Current, type Grazer, type LightSource, type Nest, type Organism, type Sediment, type World,
} from './types';
import { initializeGrazers } from './simulation';
import { RAIN_CALL_COOLDOWN } from './weather';
import { CURRENT_DURATION, CURRENT_RADIUS, MAX_CURRENTS, currentStrength } from './actions/current';

const MAX_SAVE_LENGTH = 1_000_000;
const MAX_NUMBER = Number.MAX_SAFE_INTEGER;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function range(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function integer(value: unknown, min = 0, max = MAX_NUMBER): value is number {
  return range(value, min, max) && Number.isSafeInteger(value);
}

function point(value: unknown, margin = 0): value is Record<string, unknown> & { x: number; y: number } {
  return record(value) && range(value.x, -10000, 10000) && range(value.y, -10000, 10000)
    && isInPool(value.x, value.y, margin);
}

function organism(value: unknown): boolean {
  if (!record(value) || !range(value.size, 1, 24) || !point(value, value.size + 3)) return false;
  return integer(value.id, 1) && value.species === 'lucent'
    && range(value.vx, -200, 200) && range(value.vy, -200, 200)
    && range(value.energy, 0.12, 2) && range(value.age, 0, MAX_NUMBER)
    && range(value.hue, 0, 360) && value.hue < 360
    && range(value.phase, 0, Math.PI * 2)
    && Array.isArray(value.trail) && value.trail.length <= LIMITS.trail
    && value.trail.every((entry: unknown) => point(entry));
}

function light(value: unknown): boolean {
  return point(value) && integer(value.id, 1)
    && range(value.initialEnergy, 0.001, 300)
    && range(value.energy, 0, value.initialEnergy)
    && range(value.age, 0, MAX_NUMBER);
}

function sediment(value: unknown): boolean {
  return point(value) && integer(value.id, 1)
    && range(value.radius, 0.1, 32) && range(value.hue, 0, 360) && value.hue < 360
    && range(value.strength, 0.001, 1) && range(value.age, 0, MAX_NUMBER);
}

function grazer(value: unknown): boolean {
  if (!record(value) || !range(value.size, 1, 24) || !point(value, value.size + 3)) return false;
  return integer(value.id, 1) && value.species === 'grazer'
    && range(value.vx, -80, 80) && range(value.vy, -80, 80)
    && range(value.age, 0, MAX_NUMBER) && range(value.phase, 0, Math.PI * 2)
    && range(value.hue, 0, 360) && value.hue < 360
    && range(value.cargo, 0, GRAZER_CAPACITY) && integer(value.nestId, 1)
    && typeof value.returning === 'boolean'
    && (!value.returning || value.cargo > 0)
    && (value.cargo < GRAZER_CAPACITY || value.returning);
}

function nest(value: unknown): boolean {
  return point(value, 18) && integer(value.id, 1)
    && range(value.hue, 0, 360) && value.hue < 360
    && range(value.pigment, 0, NEST_CAPACITY) && range(value.age, 0, MAX_NUMBER);
}

function weatherCall(value: unknown, elapsed: number): value is World['weatherCall'] {
  if (!record(value) || !range(value.nextAllowedAt, 0, MAX_NUMBER)) return false;
  if (value.startedAt === null) return value.nextAllowedAt === 0;
  return range(value.startedAt, 0, Math.min(elapsed, MAX_NUMBER - RAIN_CALL_COOLDOWN))
    && value.nextAllowedAt === value.startedAt + RAIN_CALL_COOLDOWN;
}

function current(value: unknown, elapsed: number): boolean {
  return point(value) && integer(value.id, 1)
    && range(value.dx, -1, 1) && range(value.dy, -1, 1)
    && Math.abs(Math.hypot(value.dx, value.dy) - 1) < 1e-9
    && value.radius === CURRENT_RADIUS && value.duration === CURRENT_DURATION
    && range(value.startedAt, 0, Math.min(elapsed, MAX_NUMBER - CURRENT_DURATION));
}

type LegacyWorld = Omit<World, 'version' | 'schemaRevision' | 'weatherCall' | 'currents'> & { version: 1 | 2 };
type Revision1World = Omit<World, 'schemaRevision' | 'currents'> & { schemaRevision: 1 };

// Ordered, pure migrations operate on validated data, without touching old ecology.
function migrateV1ToV2(previous: LegacyWorld): LegacyWorld {
  const next = { ...previous, version: 2 as const, grazers: [], nests: [] };
  initializeGrazers(next);
  return next;
}

function migrateV2ToV3(previous: LegacyWorld): Revision1World {
  return { ...previous, version: 3, schemaRevision: 1, weatherCall: { startedAt: null, nextAllowedAt: 0 } };
}

function migrateRevision1To2(previous: Revision1World): World {
  return { ...previous, schemaRevision: 2, currents: [] };
}

export function serializeWorld(world: World): string {
  return JSON.stringify(world);
}

export function restoreWorld(input: string): World | null {
  if (typeof input !== 'string' || input.length === 0 || input.length > MAX_SAVE_LENGTH) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(input) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
  if (!record(parsed) || (parsed.version !== 1 && parsed.version !== 2 && parsed.version !== 3)
    || !integer(parsed.seed, 0, 0xffffffff) || !integer(parsed.randomState, 0, 0xffffffff)
    || !range(parsed.elapsed, 0, MAX_NUMBER) || !integer(parsed.tick)
    || !integer(parsed.nextId, 1) || !range(parsed.consumed, 0, MAX_NUMBER)) return null;

  if ((parsed.version === 3 && ((parsed.schemaRevision !== 1 && parsed.schemaRevision !== 2) || !weatherCall(parsed.weatherCall, parsed.elapsed)))
    || (parsed.version !== 3 && ('schemaRevision' in parsed || 'weatherCall' in parsed || 'currents' in parsed))) return null;
  let currents: Current[] = [];
  if (parsed.version === 3 && parsed.schemaRevision === 2) {
    if (!Array.isArray(parsed.currents) || parsed.currents.length > MAX_CURRENTS
      || !parsed.currents.every((entry: unknown) => current(entry, parsed.elapsed as number))) return null;
    currents = parsed.currents as Current[];
  } else if ('currents' in parsed) return null;

  const { organisms, lights, sediment: deposits } = parsed;
  if (!Array.isArray(organisms) || organisms.length < 1 || organisms.length > LIMITS.organisms
    || !Array.isArray(lights) || lights.length > LIMITS.lights
    || !Array.isArray(deposits) || deposits.length > LIMITS.sediment) return null;
  if (!organisms.every(organism) || !lights.every(light) || !deposits.every(sediment)) return null;

  let grazers: Grazer[] = [];
  let nests: Nest[] = [];
  if (parsed.version >= 2) {
    if (!Array.isArray(parsed.grazers) || parsed.grazers.length > LIMITS.grazers
      || !Array.isArray(parsed.nests) || parsed.nests.length > LIMITS.nests
      || !parsed.grazers.every(grazer) || !parsed.nests.every(nest)) return null;
    grazers = parsed.grazers as Grazer[];
    nests = parsed.nests as Nest[];
    const nestIds = new Set(nests.map((entry) => entry.id));
    if (grazers.some((entry) => !nestIds.has(entry.nestId))) return null;
  } else if (parsed.nextId > MAX_NUMBER - 8) return null;

  const ids = new Set<number>();
  let largestId = 0;
  for (const entry of [...organisms, ...lights, ...deposits, ...grazers, ...nests, ...currents]) {
    const id = (entry as Record<string, unknown>).id as number;
    if (ids.has(id)) return null;
    ids.add(id);
    largestId = Math.max(largestId, id);
  }
  if (parsed.nextId <= largestId) return null;

  // Only the versioned contract enters the simulation; storage is a UI concern.
  const ecology = {
    seed: parsed.seed, randomState: parsed.randomState,
    elapsed: parsed.elapsed, tick: parsed.tick, nextId: parsed.nextId,
    organisms: organisms as Organism[], lights: lights as LightSource[],
    sediment: deposits as Sediment[], grazers, nests, consumed: parsed.consumed,
  };
  if (parsed.version === 3) {
    const revision1: Revision1World = { ...ecology, version: 3, schemaRevision: 1,
      weatherCall: { ...(parsed.weatherCall as World['weatherCall']) } };
    return parsed.schemaRevision === 1 ? migrateRevision1To2(revision1)
      : { ...revision1, schemaRevision: 2, currents: currents.filter(entry => currentStrength(entry, parsed.elapsed as number) > 0) };
  }
  let legacy: LegacyWorld = { ...ecology, version: parsed.version };
  if (legacy.version === 1) legacy = migrateV1ToV2(legacy);
  return migrateRevision1To2(migrateV2ToV3(legacy));
}
