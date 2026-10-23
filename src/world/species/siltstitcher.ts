import { confinePosition } from '../geometry';
import { LIMITS, isInPool, type Nest, type Point, type Sediment, type Siltstitcher, type World } from '../types';
import { activeNewTypePopulation, NEW_TYPE_POPULATION_CAP, SILTSTITCHER_CAP, SPECIES_CATALOG } from './catalog';
import { blendHue, returnPigment, safeId } from './resources';

const RULE = SPECIES_CATALOG.siltstitcher;
const TAU = 2 * Math.PI;

function move(body: Siltstitcher, target: Point, dt: number): boolean {
  const dx = target.x - body.x;
  const dy = target.y - body.y;
  const distance = Math.hypot(dx, dy);
  const speed = Math.min(RULE.speed, distance / dt);
  body.vx = distance > .000001 ? dx / distance * speed : 0;
  body.vy = distance > .000001 ? dy / distance * speed : 0;
  body.x += body.vx * dt;
  body.y += body.vy * dt;
  confinePosition(body, RULE.margin);
  return Math.hypot(target.x - body.x, target.y - body.y) < .000001;
}

function returnHome(body: Siltstitcher): void {
  body.mode = 'returning'; body.destination = null; body.blockedFor = 0;
}

function refill(world: World, body: Siltstitcher, nest: Nest, dt: number, mayLoadCargo: boolean): void {
  const reserve = Math.min(Math.max(0, nest.pigment - RULE.protectedStock),
    Math.max(0, RULE.reserveCapacity - body.reserve), dt * RULE.reserveRefillRate);
  if (reserve > 0) {
    body.hue = blendHue(body.hue, nest.hue, body.body + body.reserve + body.cargo, reserve);
    nest.pigment -= reserve; body.reserve += reserve;
    world.ecologyLedger.siltstitcherNestReserve += reserve;
  }
  if (!mayLoadCargo) return;
  const cargo = Math.min(Math.max(0, nest.pigment - RULE.protectedStock),
    Math.max(0, RULE.cargoCapacity - body.cargo), dt * RULE.cargoRefillRate);
  if (cargo > 0) {
    body.hue = blendHue(body.hue, nest.hue, body.body + body.reserve + body.cargo, cargo);
    nest.pigment -= cargo; body.cargo += cargo;
    world.ecologyLedger.siltstitcherNestCargo += cargo;
  }
}

function candidate(world: World, body: Siltstitcher, nest: Nest): Point | null {
  // One of 24 finite sites per saved six-tick phase, rotating without a queue,
  // cursor history or random draws. Only this site's neighborhood is scored.
  const index = (Math.floor(world.tick / 6) + body.id) % 24;
  const angle = (nest.id % 4096) * 2.39996322973 + index % 8 * TAU / 8;
  const radius = RULE.destinationMinReach + Math.floor(index / 8) * 20;
  const point = { x: nest.x + Math.cos(angle) * radius, y: nest.y + Math.sin(angle) * radius };
  for (let i = 0; i <= 8; i++) {
    if (!isInPool(nest.x + (point.x - nest.x) * i / 8, nest.y + (point.y - nest.y) * i / 8, RULE.margin)) return null;
  }
  let homePigment = Math.max(0, nest.pigment - RULE.protectedStock) + body.cargo;
  let outwardPigment = 0;
  // A loaded nest's actual surplus and its already withdrawn payload are part
  // of its fringe stock. This permits
  // paid redistribution onto bare floor even when both floor neighborhoods lack
  // grains. All sediment contributions are actual nonnegative pigment.
  for (const grain of world.sediment) {
    if (grain.strength <= 0) continue;
    if (Math.hypot(grain.x - nest.x, grain.y - nest.y) <= RULE.homeFringeReach) homePigment += grain.strength;
    if (Math.hypot(grain.x - point.x, grain.y - point.y) <= RULE.destinationFringeReach) outwardPigment += grain.strength;
  }
  return outwardPigment < homePigment ? point : null;
}

function delivered(world: World, body: Siltstitcher): void {
  world.ecologyLedger.siltstitcherOutwardPigment += body.cargo;
  body.cargo = 0;
  returnHome(body);
}

function tryDelivery(world: World, body: Siltstitcher, maySearch: boolean): boolean {
  if (body.cargo <= 0) { returnHome(body); return true; }
  if (world.sediment.length < LIMITS.sediment && safeId(world)) {
    world.sediment.push({ id: world.nextId++, x: body.x, y: body.y, radius: 6,
      hue: body.hue, strength: body.cargo, age: 0 });
    delivered(world, body); return true;
  }
  if (!maySearch) return false;
  // Never split a payload, evict a grain or accept an approximate capacity fit.
  // One fallback scan replaces destination search on this body's saved phase.
  let nearest: Sediment | undefined;
  let distance: number = RULE.deliveryMergeReach;
  for (const grain of world.sediment) {
    if (1 - grain.strength < body.cargo) continue;
    const nextDistance = Math.hypot(grain.x - body.x, grain.y - body.y);
    if (nextDistance < distance || (nextDistance === distance && (!nearest || grain.id < nearest.id))) {
      distance = nextDistance; nearest = grain;
    }
  }
  if (!nearest) return false;
  nearest.hue = blendHue(nearest.hue, body.hue, nearest.strength, body.cargo);
  nearest.strength += body.cargo;
  delivered(world, body); return true;
}

function updateOne(world: World, body: Siltstitcher, dt: number): void {
  body.age += dt;
  if (body.age >= RULE.lifespan || body.starvedFor >= RULE.starvationLimit) return;
  const home = world.nests.find(nest => nest.id === body.homeNestId);
  const phase = (world.tick + body.id) % 6 === 0;
  body.vx = 0; body.vy = 0;
  if (!home) returnHome(body);
  else if (body.mode === 'home' || body.mode === 'returning') {
    const atHome = Math.hypot(home.x - body.x, home.y - body.y) <= RULE.homeReach;
    if (!atHome) move(body, home, dt);
    else {
      if (body.mode === 'returning' && body.cargo === 0) body.mode = 'home';
      const loading = body.mode === 'home';
      refill(world, body, home, dt, loading);
      const loaded = body.cargo >= RULE.cargoCapacity
        || (body.cargo >= RULE.minimumPartialCargo && (!loading || home.pigment <= RULE.protectedStock));
      if (loaded && phase) {
        const destination = candidate(world, body, home);
        if (destination) { body.destination = destination; body.mode = 'outbound'; }
      }
    }
  } else if (body.destination) {
    const arrived = move(body, body.destination, dt);
    if (arrived && !tryDelivery(world, body, phase)) {
      body.mode = 'blocked';
      body.blockedFor += dt;
      if (body.blockedFor >= RULE.blockedLimit) returnHome(body);
    } else if (body.mode === 'blocked') {
      body.blockedFor += dt;
      if (body.blockedFor >= RULE.blockedLimit) returnHome(body);
    }
  } else returnHome(body);
  const maintenance = Math.min(body.reserve, dt * RULE.maintenanceRate);
  body.reserve -= maintenance;
  world.ecologyLedger.siltstitcherMaintenancePigment += maintenance;
  body.starvedFor = body.reserve <= 0 ? body.starvedFor + dt : 0;
}

function admit(world: World): void {
  if (world.tick % 6 !== 0 || world.elapsed < world.siltstitcherAdmissionAt
    || world.siltstitchers.length >= SILTSTITCHER_CAP || activeNewTypePopulation(world) >= NEW_TYPE_POPULATION_CAP
    || !safeId(world) || world.elapsed > Number.MAX_SAFE_INTEGER - RULE.admissionRest) return;
  let first: Nest | undefined;
  let afterCursor: Nest | undefined;
  for (const nest of world.nests) {
    if (nest.pigment < RULE.admissionThreshold || !isInPool(nest.x, nest.y, RULE.margin)
      || world.siltstitchers.some(body => body.homeNestId === nest.id
        || Math.hypot(body.x - nest.x, body.y - nest.y) < RULE.spacing)) continue;
    if (!first || nest.id < first.id) first = nest;
    if (nest.id > world.siltstitcherCandidateAfterId && (!afterCursor || nest.id < afterCursor.id)) afterCursor = nest;
  }
  const home = afterCursor ?? first;
  if (!home) return;
  world.siltstitcherCandidateAfterId = home.id;
  home.pigment -= RULE.admissionPigment;
  world.siltstitchers.push({ id: world.nextId++, species: 'siltstitcher', x: home.x, y: home.y,
    vx: 0, vy: 0, body: .2, reserve: .1, cargo: 0, age: 0, hue: home.hue, homeNestId: home.id,
    starvedFor: 0, mode: 'home', destination: null, blockedFor: 0 });
  world.siltstitcherAdmissionAt = world.elapsed + RULE.admissionRest;
}

export function updateSiltstitchers(world: World, dt: number): void {
  for (const body of world.siltstitchers) updateOne(world, body, dt);
  let write = 0;
  for (const body of world.siltstitchers) {
    if (body.age >= RULE.lifespan || body.starvedFor >= RULE.starvationLimit) returnPigment(world, body, body.hue, body.body + body.reserve + body.cargo);
    else world.siltstitchers[write++] = body;
  }
  world.siltstitchers.length = write;
  admit(world);
}
