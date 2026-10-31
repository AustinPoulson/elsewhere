import { applyCurrent } from '../actions/current';
import { isInPool, type Rainbell, type Sediment, type World } from '../types';
import { effectiveWeather } from '../weather';
import { activeNewTypePopulation, NEW_TYPE_POPULATION_CAP, RAINBELL_CAP, SPECIES_CATALOG } from './catalog';
import { blendHue, returnPigment, safeId } from './resources';
import { AdmissionSources } from './admission-sources';

const RULE = SPECIES_CATALOG.rainbell;
const indexes = new WeakMap<World, Map<number, Sediment>>();

function search(world: World, bell: Rainbell): void {
  let feed: Sediment | undefined;
  let pump: Sediment | undefined;
  let feedDistance: number = RULE.feedReach;
  let pumpDistance: number = RULE.pumpMaxReach;
  // Both roles share one bounded sediment pass at the body's saved search phase.
  for (const grain of world.sediment) {
    if (grain.strength <= 0) continue;
    const distance = Math.hypot(grain.x - bell.x, grain.y - bell.y);
    if (
      distance <= RULE.feedReach &&
      (distance < feedDistance || (distance === feedDistance && (!feed || grain.id < feed.id)))
    ) {
      feed = grain;
      feedDistance = distance;
    }
    if (
      distance >= RULE.pumpMinReach &&
      distance <= RULE.pumpMaxReach &&
      (distance < pumpDistance || (distance === pumpDistance && (!pump || grain.id < pump.id)))
    ) {
      pump = grain;
      pumpDistance = distance;
    }
  }
  bell.feedTargetSedimentId = feed?.id ?? null;
  bell.pumpTargetSedimentId = pump?.id ?? null;
}

function updateOne(world: World, bell: Rainbell, dt: number, index: Map<number, Sediment>, raining: boolean): void {
  bell.age += dt;
  if (bell.age >= RULE.lifespan || bell.starvedFor >= RULE.starvationLimit) return;
  if ((world.tick + bell.id) % 6 === 0) search(world, bell);
  const feed = bell.feedTargetSedimentId === null ? undefined : index.get(bell.feedTargetSedimentId);
  if (feed && feed.strength > 0 && Math.hypot(feed.x - bell.x, feed.y - bell.y) <= RULE.feedReach) {
    const intake = Math.min(feed.strength, Math.max(0, RULE.reserveCapacity - bell.reserve), dt * RULE.intakeRate);
    if (intake > 0) {
      bell.hue = blendHue(bell.hue, feed.hue, bell.reserve, intake);
      bell.reserve += intake;
      feed.strength -= intake;
      world.ecologyLedger.rainbellIntake += intake;
    }
  } else bell.feedTargetSedimentId = null;
  const maintenance = Math.min(bell.reserve, dt * RULE.maintenanceRate);
  bell.reserve -= maintenance;
  world.ecologyLedger.rainbellMaintenancePigment += maintenance;
  bell.starvedFor = bell.reserve <= 0 ? bell.starvedFor + dt : 0;
  if (bell.starvedFor >= RULE.starvationLimit) return;
  const pump = bell.pumpTargetSedimentId === null ? undefined : index.get(bell.pumpTargetSedimentId);
  const pumpDistance = pump ? Math.hypot(pump.x - bell.x, pump.y - bell.y) : Infinity;
  if (!pump || pump.strength <= 0 || pumpDistance < RULE.pumpMinReach || pumpDistance > RULE.pumpMaxReach) {
    bell.pumpTargetSedimentId = null;
    return;
  }
  if (
    !raining ||
    bell.reserve < RULE.pulsePigment ||
    world.elapsed < bell.pulseNextAllowedAt ||
    !safeId(world) ||
    world.elapsed > Number.MAX_SAFE_INTEGER - RULE.pulseRest
  )
    return;
  // The existing action owns midpoint, coast, cap, speed and current lifetime.
  // Failed pulses spend neither pigment nor their next opportunity.
  if (applyCurrent(world, pump, bell).status !== 'applied') return;
  bell.reserve -= RULE.pulsePigment;
  world.ecologyLedger.rainbellPumpingPigment += RULE.pulsePigment;
  bell.pulseNextAllowedAt = world.elapsed + RULE.pulseRest;
  bell.lastPulseAt = world.elapsed;
}

export function admitRainbell(world: World): boolean {
  if (
    world.tick % 6 !== 0 ||
    world.elapsed < world.rainbellAdmissionAt ||
    world.rainbells.length >= RAINBELL_CAP ||
    activeNewTypePopulation(world) >= NEW_TYPE_POPULATION_CAP ||
    effectiveWeather(world).intensity < 0.5 ||
    !safeId(world) ||
    world.elapsed > Number.MAX_SAFE_INTEGER - RULE.admissionRest
  )
    return false;
  let first: Sediment | undefined;
  let afterCursor: Sediment | undefined;
  const neighborhoods = new AdmissionSources();
  for (const grain of world.sediment) {
    neighborhoods.add(grain);
    if (
      grain.strength <= 0 ||
      !isInPool(grain.x, grain.y, RULE.margin) ||
      world.rainbells.some((other) => Math.hypot(other.x - grain.x, other.y - grain.y) < RULE.spacing)
    )
      continue;
    if (!first || grain.id < first.id) first = grain;
    if (grain.id > world.rainbellCandidateAfterId && (!afterCursor || grain.id < afterCursor.id)) afterCursor = grain;
  }
  const center = afterCursor ?? first;
  if (!center) return false;
  world.rainbellCandidateAfterId = center.id;
  const sources = neighborhoods.within(center, RULE.rootReach);
  sources.sort(
    (a, b) => Math.hypot(a.x - center.x, a.y - center.y) - Math.hypot(b.x - center.x, b.y - center.y) || a.id - b.id,
  );
  if (sources.reduce((sum, source) => sum + source.strength, 0) < RULE.admissionPigment) return false;
  let remaining: number = RULE.admissionPigment;
  let paid = 0;
  let hue = center.hue;
  const payments: { source: Sediment; amount: number }[] = [];
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
  world.rainbells.push({
    id: world.nextId++,
    species: 'rainbell',
    x: center.x,
    y: center.y,
    body: 0.2,
    reserve: 0.4,
    age: 0,
    hue,
    starvedFor: 0,
    feedTargetSedimentId: null,
    pumpTargetSedimentId: null,
    pulseNextAllowedAt: world.elapsed,
    lastPulseAt: null,
  });
  world.rainbellAdmissionAt = world.elapsed + RULE.admissionRest;
  return true;
}

export function updateRainbells(world: World, dt: number, allowStandaloneAdmission = true): void {
  if (world.rainbells.length === 0) {
    if (allowStandaloneAdmission) admitRainbell(world);
    return;
  }
  let index = indexes.get(world);
  if (!index) {
    index = new Map();
    indexes.set(world, index);
  }
  index.clear();
  for (const grain of world.sediment) index.set(grain.id, grain);
  const raining = effectiveWeather(world).intensity >= 0.5;
  for (const bell of world.rainbells) updateOne(world, bell, dt, index, raining);
  let write = 0;
  for (const bell of world.rainbells) {
    if (bell.age >= RULE.lifespan || bell.starvedFor >= RULE.starvationLimit)
      returnPigment(world, bell, bell.hue, bell.body + bell.reserve);
    else world.rainbells[write++] = bell;
  }
  world.rainbells.length = write;
  if (allowStandaloneAdmission) admitRainbell(world);
}
