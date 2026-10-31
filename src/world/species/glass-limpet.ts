import { sedimentCurrentVelocity } from '../currents';
import { isInPool, poolRadius, WORLD_HEIGHT, WORLD_WIDTH, type GlassLimpet, type Sediment, type World } from '../types';
import { activeNewTypePopulation, NEW_TYPE_POPULATION_CAP, SPECIES_CATALOG } from './catalog';
import { AdmissionSources } from './admission-sources';
import { blendHue, returnPigment, safeId } from './resources';

const RULE = SPECIES_CATALOG.glassLimpet;
const indexes = new WeakMap<World, Map<number, Sediment>>();

function legalShore(x: number, y: number): boolean {
  if (!isInPool(x, y, RULE.margin)) return false;
  const nx = (x - WORLD_WIDTH / 2) / 610;
  const ny = (y - WORLD_HEIGHT / 2) / 400;
  const rho = Math.hypot(nx, ny) / poolRadius(Math.atan2(ny, nx));
  return rho >= RULE.shoreMin && rho <= RULE.shoreMax;
}

// Called by the shared normal-founding scheduler: exactly one anchor is tried.
// One sediment pass builds local payment cells and rotates source IDs; only
// the chosen neighborhood is checked for funding. A refusal advances just
// the saved cursor, never time, pigment, IDs, or the random stream.
export function admitGlassLimpet(world: World): boolean {
  if (
    world.elapsed < world.glassLimpetAdmissionAt ||
    world.glassLimpets.length >= RULE.cap ||
    activeNewTypePopulation(world) >= NEW_TYPE_POPULATION_CAP ||
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
      grain.strength < RULE.coarseThreshold ||
      !legalShore(grain.x, grain.y) ||
      world.glassLimpets.some((other) => Math.hypot(other.x - grain.x, other.y - grain.y) < RULE.spacing)
    )
      continue;
    if (!first || grain.id < first.id) first = grain;
    if (grain.id > world.glassLimpetCandidateAfterId && (!afterCursor || grain.id < afterCursor.id))
      afterCursor = grain;
  }
  const center = afterCursor ?? first;
  if (!center) return false;
  world.glassLimpetCandidateAfterId = center.id;
  const sources = neighborhoods
    .within(center, RULE.rootReach)
    .filter((grain) => grain.strength >= RULE.coarseThreshold);
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
  world.glassLimpets.push({
    id: world.nextId++,
    species: 'glassLimpet',
    x: center.x,
    y: center.y,
    body: RULE.bodyPigment,
    reserve: RULE.initialReserve,
    cargo: 0,
    age: 0,
    hue,
    starvedFor: 0,
    targetSedimentId: null,
  });
  world.glassLimpetAdmissionAt = world.elapsed + RULE.admissionRest;
  return true;
}

function search(world: World, limpet: GlassLimpet): void {
  let nearest: Sediment | undefined;
  let distance: number = RULE.feedReach;
  for (const grain of world.sediment) {
    if (grain.strength < RULE.coarseThreshold) continue;
    const reach = Math.hypot(grain.x - limpet.x, grain.y - limpet.y);
    if (reach > RULE.feedReach || reach > distance || (reach === distance && nearest && grain.id >= nearest.id))
      continue;
    const velocity = sedimentCurrentVelocity(world, grain);
    if (Math.hypot(velocity.x, velocity.y) < RULE.currentFeedSpeed) continue;
    nearest = grain;
    distance = reach;
  }
  limpet.targetSedimentId = nearest?.id ?? null;
}

function updateOne(world: World, limpet: GlassLimpet, dt: number, index: Map<number, Sediment>): void {
  limpet.age += dt;
  if (limpet.age >= RULE.lifespan || limpet.starvedFor >= RULE.starvationLimit) return;
  if ((world.tick + limpet.id) % 6 === 0) search(world, limpet);
  const food = limpet.targetSedimentId === null ? undefined : index.get(limpet.targetSedimentId);
  if (
    food &&
    food.strength >= RULE.coarseThreshold &&
    Math.hypot(food.x - limpet.x, food.y - limpet.y) <= RULE.feedReach
  ) {
    const velocity = sedimentCurrentVelocity(world, food);
    if (Math.hypot(velocity.x, velocity.y) >= RULE.currentFeedSpeed) {
      // Both stores must fit their fixed share before any source debit. Cargo
      // cannot silently absorb reserve's quarter, nor vice versa.
      const intake = Math.min(
        food.strength,
        dt * RULE.intakeRate,
        Math.max(0, RULE.reserveCapacity - limpet.reserve) / 0.25,
        Math.max(0, RULE.cargoCapacity - limpet.cargo) / 0.75,
      );
      if (intake > 0) {
        limpet.hue = blendHue(limpet.hue, food.hue, limpet.reserve + limpet.cargo, intake);
        limpet.reserve += intake * 0.25;
        limpet.cargo += intake * 0.75;
        food.strength -= intake;
        world.ecologyLedger.glassLimpetIntake += intake;
      }
    } else limpet.targetSedimentId = null;
  } else limpet.targetSedimentId = null;
  const maintenance = Math.min(limpet.reserve, dt * RULE.maintenanceRate);
  limpet.reserve -= maintenance;
  world.ecologyLedger.glassLimpetMaintenancePigment += maintenance;
  limpet.starvedFor = limpet.reserve <= 0 ? limpet.starvedFor + dt : 0;
}

export function updateGlassLimpets(world: World, dt: number): void {
  if (world.glassLimpets.length === 0) return;
  let index = indexes.get(world);
  if (!index) {
    index = new Map();
    indexes.set(world, index);
  }
  index.clear();
  for (const grain of world.sediment) index.set(grain.id, grain);
  for (const limpet of world.glassLimpets) updateOne(world, limpet, dt, index);
  let write = 0;
  for (const limpet of world.glassLimpets) {
    if (limpet.age >= RULE.lifespan || limpet.starvedFor >= RULE.starvationLimit) {
      returnPigment(world, limpet, limpet.hue, limpet.body + limpet.reserve + limpet.cargo);
    } else world.glassLimpets[write++] = limpet;
  }
  world.glassLimpets.length = write;
}
