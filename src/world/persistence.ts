import {
  LIMITS, isInPool, type LightSource, type Organism, type Sediment, type World,
} from './types';

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
  if (!record(parsed) || parsed.version !== 1
    || !integer(parsed.seed, 0, 0xffffffff) || !integer(parsed.randomState, 0, 0xffffffff)
    || !range(parsed.elapsed, 0, MAX_NUMBER) || !integer(parsed.tick)
    || !integer(parsed.nextId, 1) || !range(parsed.consumed, 0, MAX_NUMBER)) return null;

  const { organisms, lights, sediment: deposits } = parsed;
  if (!Array.isArray(organisms) || organisms.length < 1 || organisms.length > LIMITS.organisms
    || !Array.isArray(lights) || lights.length > LIMITS.lights
    || !Array.isArray(deposits) || deposits.length > LIMITS.sediment) return null;
  if (!organisms.every(organism) || !lights.every(light) || !deposits.every(sediment)) return null;

  const ids = new Set<number>();
  let largestId = 0;
  for (const entry of [...organisms, ...lights, ...deposits]) {
    const id = (entry as Record<string, unknown>).id as number;
    if (ids.has(id)) return null;
    ids.add(id);
    largestId = Math.max(largestId, id);
  }
  if (parsed.nextId <= largestId) return null;

  // Only the versioned contract enters the simulation; storage is a UI concern.
  return {
    version: 1, seed: parsed.seed, randomState: parsed.randomState,
    elapsed: parsed.elapsed, tick: parsed.tick, nextId: parsed.nextId,
    organisms: organisms as Organism[], lights: lights as LightSource[],
    sediment: deposits as Sediment[], consumed: parsed.consumed,
  };
}
