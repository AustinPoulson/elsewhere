import { sedimentCurrentVelocity } from '../currents';
import { containingPool, shoreRho } from '../habitat';
import type { GlassLimpet, Sediment, Traits, World } from '../types';
import { baselineTraits, mutateTraits } from '../traits';
import { rainIntensityAt } from '../weather';
import { activeNewTypePopulation, NEW_TYPE_POPULATION_CAP, SPECIES_CATALOG } from './catalog';
import { AdmissionSources } from './admission-sources';
import { tryEventFounding } from './founding';
import { blendHue, MIN_SEDIMENT_GRAIN, safeId } from './resources';
import { settleDeath } from './remains';

const RULE = SPECIES_CATALOG.glassLimpet;
const TAU = 2 * Math.PI;
const indexes = new WeakMap<World, Map<number, Sediment>>();

export function glassLimpetReserveCapacity(traits: Pick<Traits, 'bulk'>): number {
  return RULE.reserveCapacity * traits.bulk;
}

export function glassLimpetFeedReach(traits: Pick<Traits, 'bulk'>): number {
  return RULE.feedReach * (1.15 - 0.15 * traits.bulk);
}

export function glassLimpetSurvivalFloor(traits: Pick<Traits, 'bulk'>): number {
  return Math.min(RULE.survivalFloor, Math.max(0, glassLimpetReserveCapacity(traits) - RULE.childCost));
}

export function glassLimpetBirthStake(traits: Pick<Traits, 'bulk'>): number {
  return RULE.childCost + glassLimpetSurvivalFloor(traits);
}

function legalShore(x: number, y: number): boolean {
  const pool = containingPool(x, y, RULE.margin);
  if (!pool) return false;
  const rho = shoreRho(x, y, pool);
  return rho >= RULE.shoreMin && rho <= RULE.shoreMax;
}

function grainHeldForStocking(world: World, grain: Sediment): boolean {
  for (const limpet of world.glassLimpets) {
    if (limpet.reserve >= glassLimpetBirthStake(limpet.traits)) continue;
    if (Math.hypot(limpet.x - grain.x, limpet.y - grain.y) <= glassLimpetFeedReach(limpet.traits)) return true;
  }
  return false;
}

function childSite(parent: GlassLimpet): { x: number; y: number } | null {
  const angle = ((parent.id % 4096) * 2.39996322973) % TAU;
  const x = parent.x + Math.cos(angle) * 8;
  const y = parent.y + Math.sin(angle) * 8;
  if (legalShore(x, y)) return { x, y };
  if (legalShore(parent.x, parent.y)) return { x: parent.x, y: parent.y };
  return null;
}

function grainInFlow(world: World, grain: Sediment): boolean {
  if (rainIntensityAt(world, grain.x, grain.y) > 0) return true;
  const velocity = sedimentCurrentVelocity(world, grain);
  return Math.hypot(velocity.x, velocity.y) >= RULE.currentFeedSpeed;
}

function stocking(limpet: GlassLimpet): boolean {
  return (
    glassLimpetReserveCapacity(limpet.traits) >= RULE.childCost && limpet.reserve < glassLimpetBirthStake(limpet.traits)
  );
}

function grainAvailable(world: World, limpet: GlassLimpet, grain: Sediment): boolean {
  return stocking(limpet) || grainInFlow(world, grain);
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
      grainHeldForStocking(world, grain) ||
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
    .filter((grain) => grain.strength >= RULE.coarseThreshold && !grainHeldForStocking(world, grain));
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
    parentId: null,
    nextBirthAt: world.elapsed + RULE.maturityAge,
    traits: baselineTraits(),
  });
  world.glassLimpetAdmissionAt = world.elapsed + RULE.admissionRest;
  return true;
}

function search(world: World, limpet: GlassLimpet): void {
  let nearest: Sediment | undefined;
  let distance: number = glassLimpetFeedReach(limpet.traits);
  for (const grain of world.sediment) {
    if (grain.strength <= MIN_SEDIMENT_GRAIN) continue;
    const reach = Math.hypot(grain.x - limpet.x, grain.y - limpet.y);
    if (reach > distance || (reach === distance && nearest && grain.id >= nearest.id)) continue;
    if (!grainAvailable(world, limpet, grain)) continue;
    nearest = grain;
    distance = reach;
  }
  limpet.targetSedimentId = nearest?.id ?? null;
}

function birth(world: World, parent: GlassLimpet): void {
  if (
    parent.age < RULE.maturityAge ||
    world.elapsed < parent.nextBirthAt ||
    parent.reserve < glassLimpetBirthStake(parent.traits) ||
    world.glassLimpets.length >= RULE.cap ||
    world.elapsed > Number.MAX_SAFE_INTEGER - RULE.breedingRest
  )
    return;
  tryEventFounding(world, (current) => {
    if (
      parent.reserve < glassLimpetBirthStake(parent.traits) ||
      !safeId(current) ||
      current.glassLimpets.length >= RULE.cap
    )
      return false;
    const site = childSite(parent);
    if (!site) return false;
    const child: GlassLimpet = {
      id: current.nextId,
      species: 'glassLimpet',
      x: site.x,
      y: site.y,
      body: RULE.childBody,
      reserve: RULE.childReserve,
      cargo: 0,
      age: 0,
      hue: parent.hue,
      starvedFor: 0,
      targetSedimentId: parent.targetSedimentId,
      parentId: parent.id,
      nextBirthAt: current.elapsed + RULE.maturityAge,
      traits: mutateTraits(current, parent.traits),
    };
    parent.reserve -= RULE.childCost;
    parent.nextBirthAt = current.elapsed + RULE.breedingRest;
    current.nextId++;
    current.glassLimpets.push(child);
    return true;
  });
}

function updateOne(world: World, limpet: GlassLimpet, dt: number, index: Map<number, Sediment>): void {
  limpet.age += dt;
  if (limpet.age >= RULE.lifespan || limpet.starvedFor >= RULE.starvationLimit) return;
  if ((world.tick + limpet.id) % 6 === 0) search(world, limpet);
  const food = limpet.targetSedimentId === null ? undefined : index.get(limpet.targetSedimentId);
  const reach = glassLimpetFeedReach(limpet.traits);
  if (food && food.strength > MIN_SEDIMENT_GRAIN && Math.hypot(food.x - limpet.x, food.y - limpet.y) <= reach) {
    if (grainAvailable(world, limpet, food)) {
      const filling = stocking(limpet);
      const intake = filling
        ? Math.min(
            food.strength,
            dt * RULE.intakeRate * limpet.traits.drive,
            Math.max(0, glassLimpetReserveCapacity(limpet.traits) - limpet.reserve),
          )
        : Math.min(
            food.strength,
            dt * RULE.intakeRate * limpet.traits.drive,
            Math.max(0, glassLimpetReserveCapacity(limpet.traits) - limpet.reserve) / 0.25,
            Math.max(0, RULE.cargoCapacity - limpet.cargo) / 0.75,
          );
      if (intake > 0) {
        limpet.hue = blendHue(limpet.hue, food.hue, limpet.reserve + limpet.cargo, intake);
        if (filling) limpet.reserve += intake;
        else {
          limpet.reserve += intake * 0.25;
          limpet.cargo += intake * 0.75;
        }
        food.strength -= intake;
        world.ecologyLedger.glassLimpetIntake += intake;
      }
    } else limpet.targetSedimentId = null;
  } else limpet.targetSedimentId = null;
  if (limpet.reserve > 0) birth(world, limpet);
  const maintenance = Math.min(limpet.reserve, dt * RULE.maintenanceRate * limpet.traits.drive);
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
  const initialCount = world.glassLimpets.length;
  for (let i = 0; i < initialCount; i++) updateOne(world, world.glassLimpets[i], dt, index);
  let write = 0;
  for (const limpet of world.glassLimpets) {
    if (limpet.age >= RULE.lifespan || limpet.starvedFor >= RULE.starvationLimit) {
      settleDeath(world, limpet, limpet.hue, limpet.body + limpet.reserve + limpet.cargo, 'glassLimpet');
    } else world.glassLimpets[write++] = limpet;
  }
  world.glassLimpets.length = write;
}
