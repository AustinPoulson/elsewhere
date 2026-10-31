import { confinePosition } from '../geometry';
import { LIMITS, type Nest, type Sediment, type Skimmer, type World } from '../types';

import { activeNewTypePopulation, NEW_TYPE_POPULATION_CAP, SKIMMER_CAP, SPECIES_CATALOG } from './catalog';
import { blendHue, returnPigment, safeId } from './resources';

const SKIMMER_MAINTENANCE = 0.002;
const SKIMMER_INTAKE = 0.03;
const SKIMMER_EMISSION_PIGMENT = 0.9;
const SKIMMER_EMISSION_LIGHT = 1.35;
const TAU = Math.PI * 2;
const indexes = new WeakMap<World, Map<number, Sediment>>();

function findFood(world: World, skimmer: Skimmer): number | null {
  let best: Sediment | undefined;
  let distance = 240;
  for (const grain of world.sediment) {
    if (grain.strength <= 0.025) continue;
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
  if (skimmer.age >= SPECIES_CATALOG.skimmer.lifespan || skimmer.starvedFor >= SPECIES_CATALOG.skimmer.starvationLimit)
    return;
  skimmer.phase = (skimmer.phase + dt * 0.65) % TAU;
  if ((world.tick + skimmer.id) % 6 === 0) skimmer.targetSedimentId = findFood(world, skimmer);
  const food = skimmer.targetSedimentId === null ? undefined : index.get(skimmer.targetSedimentId);
  const edible = food && food.strength > 0.025 ? food : undefined;
  if (!edible) skimmer.targetSedimentId = null;
  const home = world.nests.find((nest) => nest.id === skimmer.homeNestId);
  const targetX = edible?.x ?? (home ? home.x + Math.cos(skimmer.phase) * 18 : skimmer.x);
  const targetY = edible?.y ?? (home ? home.y + Math.sin(skimmer.phase) * 18 : skimmer.y);
  const dx = targetX - skimmer.x;
  const dy = targetY - skimmer.y;
  const distance = Math.hypot(dx, dy);
  const speed = Math.min(10, distance / dt);
  skimmer.vx = distance > 0.001 ? (dx / distance) * speed : 0;
  skimmer.vy = distance > 0.001 ? (dy / distance) * speed : 0;
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
  if (
    skimmer.reserve >= SKIMMER_EMISSION_PIGMENT &&
    world.elapsed >= skimmer.emissionNextAllowedAt &&
    world.lights.length < LIMITS.lights &&
    safeId(world) &&
    world.elapsed <= Number.MAX_SAFE_INTEGER - 15
  ) {
    world.lights.push({
      id: world.nextId++,
      x: skimmer.x,
      y: skimmer.y,
      energy: SKIMMER_EMISSION_LIGHT,
      initialEnergy: SKIMMER_EMISSION_LIGHT,
      age: 0,
    });
    skimmer.reserve -= SKIMMER_EMISSION_PIGMENT;
    skimmer.emissionNextAllowedAt = world.elapsed + 15;
    skimmer.lastEmissionAt = world.elapsed;
    world.ecologyLedger.pigmentConverted += SKIMMER_EMISSION_PIGMENT;
    world.ecologyLedger.emittedLight += SKIMMER_EMISSION_LIGHT;
  }
}

export function admitSkimmer(world: World): boolean {
  if (
    world.tick % 6 !== 0 ||
    world.elapsed < world.skimmerAdmissionAt ||
    world.skimmers.length >= SKIMMER_CAP ||
    activeNewTypePopulation(world) >= NEW_TYPE_POPULATION_CAP
  )
    return false;
  let first: Nest | undefined;
  let afterCursor: Nest | undefined;
  for (const nest of world.nests) {
    if (nest.pigment < 0.6 || world.skimmers.some((skimmer) => skimmer.homeNestId === nest.id)) continue;
    if (!first || nest.id < first.id) first = nest;
    if (nest.id > world.skimmerCandidateAfterId && (!afterCursor || nest.id < afterCursor.id)) afterCursor = nest;
  }
  const candidate = afterCursor ?? first;
  if (!candidate || !safeId(world) || world.elapsed > Number.MAX_SAFE_INTEGER - 60) return false;
  // A legal but crowded nest cannot monopolize later paid homes.
  world.skimmerCandidateAfterId = candidate.id;
  const phase = ((candidate.id % 4096) * 2.39996322973) % TAU;
  const body: Skimmer = {
    id: world.nextId,
    species: 'skimmer',
    size: 8,
    body: 0.2,
    x: candidate.x + Math.cos(phase) * 20,
    y: candidate.y + Math.sin(phase) * 20,
    vx: Math.cos(phase) * 10,
    vy: Math.sin(phase) * 10,
    hue: candidate.hue,
    reserve: 0.4,
    age: 0,
    phase,
    homeNestId: candidate.id,
    targetSedimentId: null,
    starvedFor: 0,
    emissionNextAllowedAt: world.elapsed,
    lastEmissionAt: null,
  };
  confinePosition(body, 11);
  if (
    Math.hypot(body.x - candidate.x, body.y - candidate.y) > 24 ||
    world.skimmers.some((other) => Math.hypot(body.x - other.x, body.y - other.y) < 48)
  )
    return false;
  candidate.pigment -= 0.6;
  world.nextId++;
  world.skimmers.push(body);
  world.skimmerAdmissionAt = world.elapsed + 60;
  return true;
}

export function updateSkimmers(world: World, dt: number, allowStandaloneAdmission = true): void {
  if (world.skimmers.length === 0) {
    if (allowStandaloneAdmission) admitSkimmer(world);
    return;
  }
  // The lookup is derived, reused and never authoritative. Restores resolve saved
  // targets identically even between search phases: one shared <=600 pass/tick.
  let index = indexes.get(world);
  if (!index) {
    index = new Map();
    indexes.set(world, index);
  }
  index.clear();
  for (const grain of world.sediment) index.set(grain.id, grain);
  for (const skimmer of world.skimmers) updateOne(world, skimmer, dt, index);
  // Stage exits before admissions; no in-loop removal or hidden remains.
  let write = 0;
  for (const skimmer of world.skimmers) {
    if (
      skimmer.age >= SPECIES_CATALOG.skimmer.lifespan ||
      skimmer.starvedFor >= SPECIES_CATALOG.skimmer.starvationLimit
    )
      returnPigment(world, skimmer, skimmer.hue, skimmer.body + skimmer.reserve);
    else world.skimmers[write++] = skimmer;
  }
  world.skimmers.length = write;
  if (allowStandaloneAdmission) admitSkimmer(world);
}
