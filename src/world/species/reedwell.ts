import { daylight } from '../environment/daylight';
import { LIMITS, isInPool, type Reedwell, type Sediment, type World } from '../types';
import { effectiveWeather } from '../weather';
import { activeNewTypePopulation, NEW_TYPE_POPULATION_CAP, REEDWELL_CAP, SPECIES_CATALOG } from './catalog';
import { blendHue, returnPigment, safeId } from './resources';
import { AdmissionSources } from './admission-sources';

const RULE = SPECIES_CATALOG.reedwell;

function updateOne(world: World, reedwell: Reedwell, dt: number, intensity: number): void {
  reedwell.age += dt;
  if (reedwell.age >= RULE.lifespan) return;
  const offered = RULE.harvestRate * intensity * dt;
  const harvested = Math.min(offered, Math.max(0, RULE.lightCapacity - reedwell.lightStore));
  reedwell.lightStore += harvested;
  world.ecologyLedger.daylightHarvested += harvested;
  world.ecologyLedger.daylightUnharvested += offered - harvested;
  if (
    reedwell.lightStore < RULE.emissionLight ||
    world.elapsed < reedwell.emissionNextAllowedAt ||
    world.lights.length >= LIMITS.lights ||
    !safeId(world) ||
    world.elapsed > Number.MAX_SAFE_INTEGER - RULE.emissionRest
  )
    return;
  world.lights.push({
    id: world.nextId++,
    x: reedwell.x,
    y: reedwell.y,
    energy: RULE.emissionLight,
    initialEnergy: RULE.emissionLight,
    age: 0,
  });
  reedwell.lightStore -= RULE.emissionLight;
  reedwell.emissionNextAllowedAt = world.elapsed + RULE.emissionRest;
  reedwell.lastEmissionAt = world.elapsed;
  world.ecologyLedger.reedwellEmittedLight += RULE.emissionLight;
}

export function admitReedwell(world: World): boolean {
  if (
    world.tick % 6 !== 0 ||
    world.elapsed < world.reedwellAdmissionAt ||
    world.reedwells.length >= REEDWELL_CAP ||
    activeNewTypePopulation(world) >= NEW_TYPE_POPULATION_CAP ||
    effectiveWeather(world).intensity < 0.5 ||
    !safeId(world) ||
    world.elapsed > Number.MAX_SAFE_INTEGER - RULE.admissionRest
  )
    return false;
  // One candidate per poll, rotating in source-ID order. A single saved cursor
  // prevents an unfunded low-ID pocket from permanently hiding later habitat,
  // without a hidden queue, random retries or all-neighborhood search.
  let afterCursor: Sediment | undefined;
  let first: Sediment | undefined;
  const neighborhoods = new AdmissionSources();
  for (const grain of world.sediment) {
    neighborhoods.add(grain);
    if (
      grain.strength <= 0 ||
      !isInPool(grain.x, grain.y, RULE.margin) ||
      world.reedwells.some((other) => Math.hypot(other.x - grain.x, other.y - grain.y) < RULE.spacing)
    )
      continue;
    if (!first || grain.id < first.id) first = grain;
    if (grain.id > world.reedwellCandidateAfterId && (!afterCursor || grain.id < afterCursor.id)) afterCursor = grain;
  }
  const candidate = afterCursor ?? first;
  if (!candidate) return false;
  // Bookkeeping advances even when this one neighborhood cannot pay. Resource
  // balances, IDs, admission cooldown and PRNG remain untouched on that refusal.
  world.reedwellCandidateAfterId = candidate.id;
  const center = candidate;
  const sources = neighborhoods.within(center, RULE.rootReach);
  sources.sort(
    (a, b) => Math.hypot(a.x - center.x, a.y - center.y) - Math.hypot(b.x - center.x, b.y - center.y) || a.id - b.id,
  );
  if (sources.reduce((sum, source) => sum + source.strength, 0) < RULE.admissionPigment) return false;
  // Stage the debit before mutation: exact availability, no epsilon credit.
  let remaining: number = RULE.admissionPigment;
  const payments: { source: Sediment; amount: number }[] = [];
  let hue = center.hue;
  let paid = 0;
  for (const source of sources) {
    const amount = Math.min(source.strength, remaining);
    if (amount > 0) {
      payments.push({ source, amount });
      hue = blendHue(hue, source.hue, paid, amount);
      paid += amount;
      remaining -= amount;
    }
    if (remaining === 0) break;
  }
  if (remaining > 0) return false;
  for (const { source, amount } of payments) source.strength -= amount;
  world.reedwells.push({
    id: world.nextId++,
    species: 'reedwell',
    x: center.x,
    y: center.y,
    body: 0.6,
    age: 0,
    hue,
    lightStore: 0,
    emissionNextAllowedAt: world.elapsed,
    lastEmissionAt: null,
  });
  world.reedwellAdmissionAt = world.elapsed + RULE.admissionRest;
  return true;
}

export function updateReedwells(world: World, dt: number, allowStandaloneAdmission = true): void {
  const intensity = daylight(world);
  for (const reedwell of world.reedwells) updateOne(world, reedwell, dt, intensity);
  let write = 0;
  for (const reedwell of world.reedwells) {
    if (reedwell.age >= RULE.lifespan) {
      returnPigment(world, reedwell, reedwell.hue, reedwell.body);
      world.ecologyLedger.reedwellDissipatedLight += reedwell.lightStore;
    } else world.reedwells[write++] = reedwell;
  }
  world.reedwells.length = write;
  if (allowStandaloneAdmission) admitReedwell(world);
}
