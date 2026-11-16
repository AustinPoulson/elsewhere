import { confinePosition } from '../geometry';
import type { Marlgrub, Remain, Traits, World } from '../types';
import { baselineTraits, mutateTraits, traitMobility } from '../traits';
import { activeNewTypePopulation, NEW_TYPE_POPULATION_CAP, SPECIES_CATALOG } from './catalog';
import { tryEventFounding } from './founding';
import { blendHue, safeId } from './resources';
import { discardEmptyRemains, settleDeath, takeRemainPigment } from './remains';

const RULE = SPECIES_CATALOG.marlgrub;
const TAU = 2 * Math.PI;
const indexes = new WeakMap<World, Map<number, Remain>>();

function remainIndex(world: World): Map<number, Remain> {
  let index = indexes.get(world);
  if (!index) {
    index = new Map();
    indexes.set(world, index);
  }
  index.clear();
  for (const remain of world.remains) index.set(remain.id, remain);
  return index;
}

export function marlgrubReserveCapacity(traits: Pick<Traits, 'bulk'>): number {
  return RULE.reserveCapacity * traits.bulk;
}

export function marlgrubSeekReach(traits: Pick<Traits, 'bulk'>): number {
  return RULE.seekReach * (1.15 - 0.15 * traits.bulk);
}

export function marlgrubSurvivalFloor(traits: Pick<Traits, 'bulk'>): number {
  return Math.min(RULE.initialReserve, Math.max(0, marlgrubReserveCapacity(traits) - RULE.childCost));
}

export function marlgrubBirthStake(traits: Pick<Traits, 'bulk'>): number {
  return RULE.childCost + marlgrubSurvivalFloor(traits);
}

export function admitMarlgrub(world: World): boolean {
  if (
    world.elapsed < world.marlgrubAdmissionAt ||
    world.marlgrubs.length >= RULE.cap ||
    activeNewTypePopulation(world) >= NEW_TYPE_POPULATION_CAP ||
    !safeId(world) ||
    world.elapsed > Number.MAX_SAFE_INTEGER - RULE.admissionRest
  )
    return false;
  let first: Remain | undefined;
  let after: Remain | undefined;
  for (const remain of world.remains) {
    if (remain.pigment < RULE.admissionPigment) continue;
    if (world.marlgrubs.some((grub) => Math.hypot(grub.x - remain.x, grub.y - remain.y) < RULE.spacing)) continue;
    if (!first || remain.id < first.id) first = remain;
    if (remain.id > world.marlgrubCandidateAfterId && (!after || remain.id < after.id)) after = remain;
  }
  const source = after ?? first;
  if (!source) return false;
  world.marlgrubCandidateAfterId = source.id;
  const grub: Marlgrub = {
    id: world.nextId,
    species: 'marlgrub',
    x: source.x,
    y: source.y,
    vx: 0,
    vy: 0,
    body: RULE.bodyPigment,
    reserve: RULE.initialReserve,
    age: 0,
    hue: source.hue,
    starvedFor: 0,
    targetRemainId: source.pigment > RULE.admissionPigment ? source.id : null,
    parentId: null,
    nextBirthAt: world.elapsed + RULE.maturityAge,
    traits: baselineTraits(),
  };
  confinePosition(grub, RULE.margin);
  takeRemainPigment(world, source, RULE.admissionPigment);
  discardEmptyRemains(world);
  world.nextId++;
  world.marlgrubs.push(grub);
  world.marlgrubAdmissionAt = world.elapsed + RULE.admissionRest;
  return true;
}

function chooseTarget(world: World, grub: Marlgrub): void {
  let nearest: Remain | undefined;
  const reach = marlgrubSeekReach(grub.traits);
  let best = reach;
  for (const remain of world.remains) {
    if (remain.pigment <= 0) continue;
    const distance = Math.hypot(grub.x - remain.x, grub.y - remain.y);
    if (distance > reach) continue;
    if (distance < best || (distance === best && (!nearest || remain.id < nearest.id))) {
      best = distance;
      nearest = remain;
    }
  }
  grub.targetRemainId = nearest?.id ?? null;
}

function birth(world: World, parent: Marlgrub): void {
  if (
    parent.age < RULE.maturityAge ||
    world.elapsed < parent.nextBirthAt ||
    parent.reserve < marlgrubBirthStake(parent.traits) ||
    world.marlgrubs.length >= RULE.cap ||
    world.elapsed > Number.MAX_SAFE_INTEGER - RULE.breedingRest
  )
    return;
  tryEventFounding(world, (current) => {
    if (parent.reserve < marlgrubBirthStake(parent.traits) || !safeId(current) || current.marlgrubs.length >= RULE.cap)
      return false;
    const angle = ((parent.id % 4096) * 2.39996322973) % TAU;
    const child: Marlgrub = {
      id: current.nextId,
      species: 'marlgrub',
      x: parent.x + Math.cos(angle) * 16,
      y: parent.y + Math.sin(angle) * 16,
      vx: parent.vx,
      vy: parent.vy,
      body: RULE.childBody,
      reserve: RULE.childReserve,
      age: 0,
      hue: parent.hue,
      starvedFor: 0,
      targetRemainId: null,
      parentId: parent.id,
      nextBirthAt: current.elapsed + RULE.maturityAge,
      traits: mutateTraits(current, parent.traits),
    };
    confinePosition(child, RULE.margin);
    parent.reserve -= RULE.childCost;
    parent.nextBirthAt = current.elapsed + RULE.breedingRest;
    current.nextId++;
    current.marlgrubs.push(child);
    return true;
  });
}

function updateOne(world: World, grub: Marlgrub, dt: number, index: Map<number, Remain>): void {
  grub.age += dt;
  if (grub.age >= RULE.lifespan || grub.starvedFor >= RULE.starvationLimit) return;
  if ((world.tick + grub.id) % 6 === 0) chooseTarget(world, grub);
  const food = grub.targetRemainId === null ? undefined : index.get(grub.targetRemainId);
  const edible = food && food.pigment > 0 ? food : undefined;
  if (!edible) grub.targetRemainId = null;
  if (edible) {
    const dx = edible.x - grub.x;
    const dy = edible.y - grub.y;
    const distance = Math.hypot(dx, dy);
    const speed = RULE.speed * traitMobility(grub.traits);
    if (distance <= RULE.feedReach) {
      grub.vx = 0;
      grub.vy = 0;
      const intake = takeRemainPigment(
        world,
        edible,
        Math.min(
          dt * RULE.intakeRate * grub.traits.drive,
          Math.max(0, marlgrubReserveCapacity(grub.traits) - grub.reserve),
        ),
      );
      if (intake > 0) {
        grub.hue = blendHue(grub.hue, edible.hue, grub.reserve, intake);
        grub.reserve += intake;
        world.ecologyLedger.marlgrubIntake += intake;
      }
    } else {
      const travel = Math.min(speed, Math.max(0, distance - RULE.feedReach) / dt);
      grub.vx = distance > 0.001 ? (dx / distance) * travel : 0;
      grub.vy = distance > 0.001 ? (dy / distance) * travel : 0;
      grub.x += grub.vx * dt;
      grub.y += grub.vy * dt;
      confinePosition(grub, RULE.margin);
    }
  } else {
    grub.vx = 0;
    grub.vy = 0;
  }
  if (grub.reserve > 0) birth(world, grub);
  const maintenance = Math.min(grub.reserve, dt * RULE.maintenanceRate * grub.traits.drive);
  grub.reserve -= maintenance;
  world.ecologyLedger.marlgrubMaintenancePigment += maintenance;
  grub.starvedFor = grub.reserve <= 0 ? grub.starvedFor + dt : 0;
}

export function updateMarlgrubs(world: World, dt: number): void {
  if (world.marlgrubs.length === 0) return;
  const index = remainIndex(world);
  const initialCount = world.marlgrubs.length;
  for (let i = 0; i < initialCount; i++) updateOne(world, world.marlgrubs[i], dt, index);
  discardEmptyRemains(world);
  let write = 0;
  for (const grub of world.marlgrubs) {
    if (grub.age >= RULE.lifespan || grub.starvedFor >= RULE.starvationLimit) {
      settleDeath(world, grub, grub.hue, grub.body + grub.reserve, 'marlgrub');
    } else world.marlgrubs[write++] = grub;
  }
  world.marlgrubs.length = write;
}
