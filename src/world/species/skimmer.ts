import { confinePosition } from '../geometry';
import { LIMITS, type Nest, type Sediment, type Skimmer, type World } from '../types';

export const NEW_TYPE_POPULATION_CAP = 24;
export const SKIMMER_CAP = 6;
export const SPECIES_CATALOG = { skimmer: { cap: SKIMMER_CAP, bodyPigment: .2, initialReserve: .4,
  admissionPigment: .6, admissionRest: 60, lifespan: 480, starvationLimit: 60 } } as const;
export const SKIMMER_MAINTENANCE = .002;
export const SKIMMER_INTAKE = .03;
export const SKIMMER_EMISSION_PIGMENT = .9;
export const SKIMMER_EMISSION_LIGHT = 1.35;
const TAU = Math.PI * 2;
const indexes = new WeakMap<World, Map<number, Sediment>>();

function blendHue(a: number, b: number, amountA: number, amountB: number): number {
  if (amountA <= 0) return b;
  const radians = Math.PI / 180;
  const x = Math.cos(a * radians) * amountA + Math.cos(b * radians) * amountB;
  const y = Math.sin(a * radians) * amountA + Math.sin(b * radians) * amountB;
  return Math.hypot(x, y) < 1e-9 ? b : (Math.atan2(y, x) / radians + 360) % 360;
}

function safeId(world: World): boolean { return Number.isSafeInteger(world.nextId) && world.nextId > 0 && world.nextId < Number.MAX_SAFE_INTEGER; }

function findFood(world: World, skimmer: Skimmer): number | null {
  let best: Sediment | undefined;
  let distance = 240;
  for (const grain of world.sediment) {
    if (grain.strength <= .025) continue;
    const candidate = Math.hypot(grain.x - skimmer.x, grain.y - skimmer.y);
    if (candidate < distance || (candidate === distance && (!best || grain.id < best.id))) {
      distance = candidate;
      best = grain;
    }
  }
  return best?.id ?? null;
}

function updateOne(world: World, skimmer: Skimmer, dt: number, index: Map<number, Sediment>): void {
  skimmer.age += dt;
  if (skimmer.age >= SPECIES_CATALOG.skimmer.lifespan || skimmer.starvedFor >= SPECIES_CATALOG.skimmer.starvationLimit) return;
  skimmer.phase = (skimmer.phase + dt * .65) % TAU;
  if ((world.tick + skimmer.id) % 6 === 0) skimmer.targetSedimentId = findFood(world, skimmer);
  const food = skimmer.targetSedimentId === null ? undefined : index.get(skimmer.targetSedimentId);
  const edible = food && food.strength > .025 ? food : undefined;
  if (!edible) skimmer.targetSedimentId = null;
  const home = world.nests.find(nest => nest.id === skimmer.homeNestId);
  const targetX = edible?.x ?? (home ? home.x + Math.cos(skimmer.phase) * 18 : skimmer.x);
  const targetY = edible?.y ?? (home ? home.y + Math.sin(skimmer.phase) * 18 : skimmer.y);
  const dx = targetX - skimmer.x;
  const dy = targetY - skimmer.y;
  const distance = Math.hypot(dx, dy);
  const speed = Math.min(10, distance / dt);
  skimmer.vx = distance > .001 ? dx / distance * speed : 0;
  skimmer.vy = distance > .001 ? dy / distance * speed : 0;
  skimmer.x += skimmer.vx * dt;
  skimmer.y += skimmer.vy * dt;
  confinePosition(skimmer, 11);
  if (edible && Math.hypot(edible.x - skimmer.x, edible.y - skimmer.y) <= 16 + edible.radius) {
    const gathered = Math.min(edible.strength, Math.max(0, 1 - skimmer.reserve), dt * SKIMMER_INTAKE);
    if (gathered > 0) {
      skimmer.hue = blendHue(skimmer.hue, edible.hue, skimmer.reserve, gathered);
      edible.strength -= gathered;
      skimmer.reserve += gathered;
    }
  }
  const maintenance = Math.min(skimmer.reserve, dt * SKIMMER_MAINTENANCE);
  skimmer.reserve -= maintenance;
  world.ecologyLedger.maintenancePigment += maintenance;
  skimmer.starvedFor = skimmer.reserve <= 0 ? skimmer.starvedFor + dt : 0;
  if (skimmer.starvedFor >= SPECIES_CATALOG.skimmer.starvationLimit) return;
  if (skimmer.reserve >= SKIMMER_EMISSION_PIGMENT && world.elapsed >= skimmer.emissionNextAllowedAt
    && world.lights.length < LIMITS.lights && safeId(world) && world.elapsed <= Number.MAX_SAFE_INTEGER - 15) {
    world.lights.push({ id: world.nextId++, x: skimmer.x, y: skimmer.y,
      energy: SKIMMER_EMISSION_LIGHT, initialEnergy: SKIMMER_EMISSION_LIGHT, age: 0 });
    skimmer.reserve -= SKIMMER_EMISSION_PIGMENT;
    skimmer.emissionNextAllowedAt = world.elapsed + 15;
    skimmer.lastEmissionAt = world.elapsed;
    world.ecologyLedger.pigmentConverted += SKIMMER_EMISSION_PIGMENT;
    world.ecologyLedger.emittedLight += SKIMMER_EMISSION_LIGHT;
  }
}

function returnPigment(world: World, skimmer: Skimmer): void {
  let amount = skimmer.body + skimmer.reserve;
  if (amount > 0 && world.sediment.length < LIMITS.sediment && safeId(world)) {
    const returned = Math.min(1, amount);
    world.sediment.push({ id: world.nextId++, x: skimmer.x, y: skimmer.y, radius: 6,
      hue: skimmer.hue, strength: returned, age: 0 });
    amount -= returned;
  } else if (amount > 0) {
    let nearest: Sediment | undefined;
    let distance = Infinity;
    for (const grain of world.sediment) {
      if (grain.strength >= 1) continue;
      const candidate = Math.hypot(grain.x - skimmer.x, grain.y - skimmer.y);
      if (candidate < distance || (candidate === distance && (!nearest || grain.id < nearest.id))) {
        nearest = grain;
        distance = candidate;
      }
    }
    if (nearest) {
      const returned = Math.min(amount, 1 - nearest.strength);
      nearest.hue = blendHue(nearest.hue, skimmer.hue, nearest.strength, returned);
      nearest.strength += returned;
      amount -= returned;
    }
  }
  world.ecologyLedger.mineralizedPigment += amount;
}

function admit(world: World): void {
  if (world.tick % 6 !== 0 || world.elapsed < world.skimmerAdmissionAt
    || world.skimmers.length >= SKIMMER_CAP || world.skimmers.length >= NEW_TYPE_POPULATION_CAP) return;
  let candidate: Nest | undefined;
  for (const nest of world.nests) {
    if (nest.pigment >= .6 && !world.skimmers.some(skimmer => skimmer.homeNestId === nest.id)
      && (!candidate || nest.id < candidate.id)) candidate = nest;
  }
  if (!candidate || !safeId(world) || world.elapsed > Number.MAX_SAFE_INTEGER - 60) return;
  const phase = ((candidate.id % 4096) * 2.39996322973) % TAU;
  const body: Skimmer = { id: world.nextId, species: 'skimmer', size: 8, body: .2,
    x: candidate.x + Math.cos(phase) * 20, y: candidate.y + Math.sin(phase) * 20,
    vx: Math.cos(phase) * 10, vy: Math.sin(phase) * 10, hue: candidate.hue, reserve: .4,
    age: 0, phase, homeNestId: candidate.id, targetSedimentId: null, starvedFor: 0,
    emissionNextAllowedAt: world.elapsed, lastEmissionAt: null };
  confinePosition(body, 11);
  if (Math.hypot(body.x - candidate.x, body.y - candidate.y) > 24
    || world.skimmers.some(other => Math.hypot(body.x - other.x, body.y - other.y) < 48)) return;
  candidate.pigment -= .6;
  world.nextId++;
  world.skimmers.push(body);
  world.skimmerAdmissionAt = world.elapsed + 60;
}

export function updateSkimmers(world: World, dt: number): void {
  // The lookup is derived, reused and never authoritative. Restores resolve saved
  // targets identically even between search phases: one shared <=600 pass/tick.
  let index = indexes.get(world);
  if (!index) { index = new Map(); indexes.set(world, index); }
  index.clear();
  for (const grain of world.sediment) index.set(grain.id, grain);
  for (const skimmer of world.skimmers) updateOne(world, skimmer, dt, index);
  // Stage exits before admissions; no in-loop removal or hidden remains.
  let write = 0;
  for (const skimmer of world.skimmers) {
    if (skimmer.age >= SPECIES_CATALOG.skimmer.lifespan || skimmer.starvedFor >= SPECIES_CATALOG.skimmer.starvationLimit) returnPigment(world, skimmer);
    else world.skimmers[write++] = skimmer;
  }
  world.skimmers.length = write;
  admit(world);
}
