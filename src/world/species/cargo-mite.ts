import { confinePosition } from '../geometry';
import type { CargoMite, Grazer, World } from '../types';
import { activeNewTypePopulation, NEW_TYPE_POPULATION_CAP, SPECIES_CATALOG } from './catalog';
import { tryEventFounding } from './founding';
import { blendHue, returnPigment, safeId } from './resources';

const RULE = SPECIES_CATALOG.cargoMite;

function hostFor(world: World, id: number | null): Grazer | undefined {
  return id === null ? undefined : world.grazers.find((host) => host.id === id);
}

function hostPopulation(world: World, hostId: number): number {
  let count = 0;
  for (const mite of world.cargoMites) if (mite.mode === 'attached' && mite.hostId === hostId) count++;
  return count;
}

function detach(mite: CargoMite): void {
  mite.mode = 'seeking';
  mite.hostId = null;
  mite.targetHostId = null;
}

// The normal catalog scheduler selects this type at most once per six ticks.
// Its saved host-ID cursor rotates one loaded candidate; refusal advances only
// that cursor and never spends cargo, an ID, a breeding deadline, or randomness.
export function admitCargoMite(world: World): boolean {
  if (
    world.elapsed < world.cargoMiteAdmissionAt ||
    world.cargoMites.length >= RULE.cap ||
    activeNewTypePopulation(world) >= NEW_TYPE_POPULATION_CAP ||
    !safeId(world) ||
    world.elapsed > Number.MAX_SAFE_INTEGER - RULE.admissionRest
  )
    return false;
  let first: Grazer | undefined;
  let after: Grazer | undefined;
  for (const host of world.grazers) {
    if (host.cargo < RULE.admissionThreshold || hostPopulation(world, host.id) !== 0) continue;
    if (!first || host.id < first.id) first = host;
    if (host.id > world.cargoMiteCandidateAfterId && (!after || host.id < after.id)) after = host;
  }
  const host = after ?? first;
  if (!host) return false;
  world.cargoMiteCandidateAfterId = host.id;
  if (
    world.cargoMites.some((mite) => Math.hypot(mite.x - host.x, mite.y - host.y) < RULE.spacing) ||
    world.elapsed > Number.MAX_SAFE_INTEGER - RULE.maturityAge
  )
    return false;
  const mite: CargoMite = {
    id: world.nextId,
    species: 'cargoMite',
    x: host.x,
    y: host.y,
    vx: 0,
    vy: 0,
    body: RULE.bodyPigment,
    reserve: RULE.initialReserve,
    age: 0,
    hue: host.hue,
    starvedFor: 0,
    mode: 'attached',
    hostId: host.id,
    targetHostId: null,
    parentId: null,
    nextBirthAt: world.elapsed + RULE.maturityAge,
  };
  host.cargo -= RULE.admissionPigment;
  if (host.cargo <= 0) {
    host.cargo = 0;
    host.returning = false;
  }
  world.nextId++;
  world.cargoMites.push(mite);
  world.cargoMiteAdmissionAt = world.elapsed + RULE.admissionRest;
  return true;
}

function chooseTarget(world: World, mite: CargoMite): void {
  let nearest: Grazer | undefined;
  let best: number = RULE.seekReach;
  for (const host of world.grazers) {
    if (host.cargo <= 0 || hostPopulation(world, host.id) >= RULE.hostCap) continue;
    const distance = Math.hypot(mite.x - host.x, mite.y - host.y);
    if (distance < best || (distance === best && (!nearest || host.id < nearest.id))) {
      best = distance;
      nearest = host;
    }
  }
  mite.targetHostId = nearest?.id ?? null;
}

function moveSeeking(world: World, mite: CargoMite, dt: number): void {
  if ((world.tick + mite.id) % 6 === 0) chooseTarget(world, mite);
  const host = hostFor(world, mite.targetHostId);
  if (
    !host ||
    host.cargo <= 0 ||
    hostPopulation(world, host.id) >= RULE.hostCap ||
    Math.hypot(mite.x - host.x, mite.y - host.y) > RULE.seekReach
  ) {
    mite.targetHostId = null;
    mite.vx = 0;
    mite.vy = 0;
    return;
  }
  const dx = host.x - mite.x;
  const dy = host.y - mite.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= RULE.attachReach) {
    mite.mode = 'attached';
    mite.hostId = host.id;
    mite.targetHostId = null;
    mite.x = host.x;
    mite.y = host.y;
    mite.vx = host.vx;
    mite.vy = host.vy;
    return;
  }
  const speed = Math.min(RULE.speed, Math.max(0, distance - RULE.attachReach) / dt);
  mite.vx = (dx / distance) * speed;
  mite.vy = (dy / distance) * speed;
  mite.x += mite.vx * dt;
  mite.y += mite.vy * dt;
  confinePosition(mite, RULE.margin);
}

function feed(world: World, mite: CargoMite, host: Grazer, dt: number): void {
  const intake = Math.min(host.cargo, dt * RULE.intakeRate, Math.max(0, RULE.reserveCapacity - mite.reserve));
  if (intake <= 0) return;
  mite.hue = blendHue(mite.hue, host.hue, mite.reserve, intake);
  host.cargo -= intake;
  if (host.cargo <= 0) {
    host.cargo = 0;
    host.returning = false;
  }
  mite.reserve += intake;
  world.ecologyLedger.cargoMiteIntake += intake;
}

function birth(world: World, parent: CargoMite, host: Grazer): void {
  if (
    parent.age < RULE.maturityAge ||
    world.elapsed < parent.nextBirthAt ||
    parent.reserve < RULE.initialReserve ||
    hostPopulation(world, host.id) >= RULE.hostCap ||
    world.cargoMites.length >= RULE.cap ||
    world.elapsed > Number.MAX_SAFE_INTEGER - RULE.breedingRest
  )
    return;
  tryEventFounding(world, (current) => {
    if (hostPopulation(current, host.id) >= RULE.hostCap || parent.reserve < RULE.childCost || !safeId(current))
      return false;
    const child: CargoMite = {
      id: current.nextId,
      species: 'cargoMite',
      x: host.x,
      y: host.y,
      vx: host.vx,
      vy: host.vy,
      body: RULE.childBody,
      reserve: RULE.childReserve,
      age: 0,
      hue: parent.hue,
      starvedFor: 0,
      mode: 'attached',
      hostId: host.id,
      targetHostId: null,
      parentId: parent.id,
      nextBirthAt: current.elapsed + RULE.maturityAge,
    };
    parent.reserve -= RULE.childCost;
    parent.nextBirthAt = current.elapsed + RULE.breedingRest;
    current.nextId++;
    current.cargoMites.push(child);
    return true;
  });
}

function updateOne(world: World, mite: CargoMite, dt: number): void {
  mite.age += dt;
  if (mite.age >= RULE.lifespan || mite.starvedFor >= RULE.starvationLimit) return;
  let host = mite.mode === 'attached' ? hostFor(world, mite.hostId) : undefined;
  if (mite.mode === 'attached' && !host) detach(mite);
  if (mite.mode === 'seeking') {
    moveSeeking(world, mite, dt);
    host = hostFor(world, mite.hostId);
  }
  if (host) {
    mite.x = host.x;
    mite.y = host.y;
    mite.vx = host.vx;
    mite.vy = host.vy;
    feed(world, mite, host, dt);
  }
  const maintenance = Math.min(mite.reserve, dt * RULE.maintenanceRate);
  mite.reserve -= maintenance;
  world.ecologyLedger.cargoMiteMaintenancePigment += maintenance;
  mite.starvedFor = mite.reserve <= 0 ? mite.starvedFor + dt : 0;
  if (host && mite.starvedFor < RULE.starvationLimit) birth(world, mite, host);
}

export function updateCargoMites(world: World, dt: number): void {
  if (world.cargoMites.length === 0) return;
  const initialCount = world.cargoMites.length;
  for (let i = 0; i < initialCount; i++) updateOne(world, world.cargoMites[i], dt);
  let write = 0;
  for (const mite of world.cargoMites) {
    if (mite.age >= RULE.lifespan || mite.starvedFor >= RULE.starvationLimit) {
      returnPigment(world, mite, mite.hue, mite.body + mite.reserve);
    } else world.cargoMites[write++] = mite;
  }
  world.cargoMites.length = write;
}

// Grazers are displaced by currents after species updates. The authoritative
// host position is copied again then, without adding the drift a second time.
export function syncAttachedCargoMites(world: World): void {
  for (const mite of world.cargoMites) {
    if (mite.mode !== 'attached') continue;
    const host = hostFor(world, mite.hostId);
    if (!host) {
      detach(mite);
      continue;
    }
    mite.x = host.x;
    mite.y = host.y;
    mite.vx = host.vx;
    mite.vy = host.vy;
  }
}
