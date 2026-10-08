import {
  GRAZER_CAPACITY, LIMITS, NEST_CAPACITY, isInPool,
  type Grazer, type LightSource, type Nest, type Organism, type Sediment, type World,
} from './types';
import { initializeGrazers } from './simulation';

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
  if (!record(parsed) || (parsed.version !== 1 && parsed.version !== 2)
    || !integer(parsed.seed, 0, 0xffffffff) || !integer(parsed.randomState, 0, 0xffffffff)
    || !range(parsed.elapsed, 0, MAX_NUMBER) || !integer(parsed.tick)
    || !integer(parsed.nextId, 1) || !range(parsed.consumed, 0, MAX_NUMBER)) return null;

  const { organisms, lights, sediment: deposits } = parsed;
  if (!Array.isArray(organisms) || organisms.length < 1 || organisms.length > LIMITS.organisms
    || !Array.isArray(lights) || lights.length > LIMITS.lights
    || !Array.isArray(deposits) || deposits.length > LIMITS.sediment) return null;
  if (!organisms.every(organism) || !lights.every(light) || !deposits.every(sediment)) return null;

  let grazers: Grazer[] = [];
  let nests: Nest[] = [];
  if (parsed.version === 2) {
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
  for (const entry of [...organisms, ...lights, ...deposits, ...grazers, ...nests]) {
    const id = (entry as Record<string, unknown>).id as number;
    if (ids.has(id)) return null;
    ids.add(id);
    largestId = Math.max(largestId, id);
  }
  if (parsed.nextId <= largestId) return null;

  // Only the versioned contract enters the simulation; storage is a UI concern.
  const world: World = {
    version: 2, seed: parsed.seed, randomState: parsed.randomState,
    elapsed: parsed.elapsed, tick: parsed.tick, nextId: parsed.nextId,
    organisms: organisms as Organism[], lights: lights as LightSource[],
    sediment: deposits as Sediment[], grazers, nests, consumed: parsed.consumed,
  };
  if (parsed.version === 1) initializeGrazers(world);
  return world;
}
