import { confinePosition } from '../geometry';
import { inSea, inStrandline, strandlinePoint, tideConnectedAt } from '../habitat';
import {
  LIMITS,
  isInPool,
  type Nest,
  type Point,
  type Sediment,
  type Siltstitcher,
  type Traits,
  type World,
} from '../types';
import { baselineTraits, mutateTraits, traitMobility } from '../traits';
import { activeNewTypePopulation, NEW_TYPE_POPULATION_CAP, SILTSTITCHER_CAP, SPECIES_CATALOG } from './catalog';
import { tryEventFounding } from './founding';
import { blendHue, safeId } from './resources';
import { settleDeath } from './remains';

const RULE = SPECIES_CATALOG.siltstitcher;
const TAU = 2 * Math.PI;

export function siltstitcherReserveCapacity(traits: Pick<Traits, 'bulk'>): number {
  return RULE.reserveCapacity * traits.bulk;
}

export function siltstitcherSurvivalFloor(traits: Pick<Traits, 'bulk'>): number {
  return Math.min(RULE.initialReserve, Math.max(0, siltstitcherReserveCapacity(traits) - RULE.childCost));
}

export function siltstitcherBirthStake(traits: Pick<Traits, 'bulk'>): number {
  return RULE.childCost + siltstitcherSurvivalFloor(traits);
}

function move(body: Siltstitcher, target: Point, dt: number): boolean {
  const dx = target.x - body.x;
  const dy = target.y - body.y;
  const distance = Math.hypot(dx, dy);
  const speed = Math.min(RULE.speed * traitMobility(body.traits), distance / dt);
  body.vx = distance > 0.000001 ? (dx / distance) * speed : 0;
  body.vy = distance > 0.000001 ? (dy / distance) * speed : 0;
  body.x += body.vx * dt;
  body.y += body.vy * dt;
  confinePosition(body, RULE.margin);
  return Math.hypot(target.x - body.x, target.y - body.y) < 0.000001;
}

function returnHome(body: Siltstitcher): void {
  body.mode = 'returning';
  body.destination = null;
  body.blockedFor = 0;
}

function refillFromGrain(body: Siltstitcher, grain: Sediment, dt: number, mayLoadCargo: boolean): void {
  const reserve = Math.min(
    grain.strength,
    Math.max(0, siltstitcherReserveCapacity(body.traits) - body.reserve),
    dt * RULE.reserveRefillRate * body.traits.drive,
  );
  if (reserve > 0) {
    body.hue = blendHue(body.hue, grain.hue, body.body + body.reserve + body.cargo, reserve);
    grain.strength -= reserve;
    body.reserve += reserve;
  }
  if (!mayLoadCargo) return;
  const cargo = Math.min(
    grain.strength,
    Math.max(0, RULE.cargoCapacity - body.cargo),
    dt * RULE.cargoRefillRate * body.traits.drive,
  );
  if (cargo > 0) {
    body.hue = blendHue(body.hue, grain.hue, body.body + body.reserve + body.cargo, cargo);
    grain.strength -= cargo;
    body.cargo += cargo;
  }
}

function nearestStrandGrain(world: World, body: Point): Sediment | undefined {
  let nearest: Sediment | undefined;
  let best = Infinity;
  for (const grain of world.sediment) {
    if (!(grain.strength > 0) || !inStrandline(grain.x, grain.y)) continue;
    const distance = Math.hypot(grain.x - body.x, grain.y - body.y);
    if (distance < best || (distance === best && (!nearest || grain.id < nearest.id))) {
      best = distance;
      nearest = grain;
    }
  }
  return nearest;
}

function forageStrandline(world: World, body: Siltstitcher, dt: number): void {
  const grain = nearestStrandGrain(world, body);
  const target = grain ?? strandlinePoint(world.tick, body.id);
  const arrived = Math.hypot(target.x - body.x, target.y - body.y) <= RULE.homeReach;
  if (!arrived) {
    move(body, target, dt);
    return;
  }
  if (grain) refillFromGrain(body, grain, dt, true);
}

function refill(world: World, body: Siltstitcher, nest: Nest, dt: number, mayLoadCargo: boolean): void {
  const reserve = Math.min(
    Math.max(0, nest.pigment - RULE.protectedStock),
    Math.max(0, siltstitcherReserveCapacity(body.traits) - body.reserve),
    dt * RULE.reserveRefillRate * body.traits.drive,
  );
  if (reserve > 0) {
    body.hue = blendHue(body.hue, nest.hue, body.body + body.reserve + body.cargo, reserve);
    nest.pigment -= reserve;
    body.reserve += reserve;
    world.ecologyLedger.siltstitcherNestReserve += reserve;
  }
  if (!mayLoadCargo) return;
  const cargo = Math.min(
    Math.max(0, nest.pigment - RULE.protectedStock),
    Math.max(0, RULE.cargoCapacity - body.cargo),
    dt * RULE.cargoRefillRate * body.traits.drive,
  );
  if (cargo > 0) {
    body.hue = blendHue(body.hue, nest.hue, body.body + body.reserve + body.cargo, cargo);
    nest.pigment -= cargo;
    body.cargo += cargo;
    world.ecologyLedger.siltstitcherNestCargo += cargo;
  }
}

function candidate(world: World, body: Siltstitcher, nest: Nest): Point | null {
  // One of 24 finite sites per saved six-tick phase, rotating without a queue,
  // cursor history or random draws. Only this site's neighborhood is scored.
  const index = (Math.floor(world.tick / 6) + body.id) % 24;
  const angle = (nest.id % 4096) * 2.39996322973 + ((index % 8) * TAU) / 8;
  const radius = RULE.destinationMinReach + Math.floor(index / 8) * 20;
  const point = { x: nest.x + Math.cos(angle) * radius, y: nest.y + Math.sin(angle) * radius };
  for (let i = 0; i <= 8; i++) {
    if (!isInPool(nest.x + ((point.x - nest.x) * i) / 8, nest.y + ((point.y - nest.y) * i) / 8, RULE.margin))
      return null;
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
    if (Math.hypot(grain.x - point.x, grain.y - point.y) <= RULE.destinationFringeReach)
      outwardPigment += grain.strength;
  }
  return outwardPigment < homePigment ? point : null;
}

function delivered(world: World, body: Siltstitcher): void {
  world.ecologyLedger.siltstitcherOutwardPigment += body.cargo;
  body.cargo = 0;
  returnHome(body);
}

function tryDelivery(world: World, body: Siltstitcher, maySearch: boolean): boolean {
  if (body.cargo <= 0) {
    returnHome(body);
    return true;
  }
  if (world.sediment.length < LIMITS.sediment && safeId(world)) {
    world.sediment.push({
      id: world.nextId++,
      x: body.x,
      y: body.y,
      radius: 6,
      hue: body.hue,
      strength: body.cargo,
      age: 0,
    });
    delivered(world, body);
    return true;
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
      distance = nextDistance;
      nearest = grain;
    }
  }
  if (!nearest) return false;
  nearest.hue = blendHue(nearest.hue, body.hue, nearest.strength, body.cargo);
  nearest.strength += body.cargo;
  delivered(world, body);
  return true;
}

function birth(world: World, parent: Siltstitcher): void {
  if (
    parent.age < RULE.maturityAge ||
    world.elapsed < parent.nextBirthAt ||
    parent.reserve < siltstitcherBirthStake(parent.traits) ||
    world.siltstitchers.length >= RULE.cap ||
    world.elapsed > Number.MAX_SAFE_INTEGER - RULE.breedingRest
  )
    return;
  tryEventFounding(world, (current) => {
    if (
      parent.reserve < siltstitcherBirthStake(parent.traits) ||
      !safeId(current) ||
      current.siltstitchers.length >= RULE.cap ||
      current.siltstitchers.filter((body) => body.homeNestId === parent.homeNestId).length >= 2
    )
      return false;
    const angle = ((parent.id % 4096) * 2.39996322973) % TAU;
    const child: Siltstitcher = {
      id: current.nextId,
      species: 'siltstitcher',
      x: parent.x + Math.cos(angle) * 16,
      y: parent.y + Math.sin(angle) * 16,
      vx: parent.vx,
      vy: parent.vy,
      body: RULE.childBody,
      reserve: RULE.childReserve,
      cargo: 0,
      age: 0,
      hue: parent.hue,
      homeNestId: parent.homeNestId,
      starvedFor: 0,
      mode: 'home',
      destination: null,
      blockedFor: 0,
      parentId: parent.id,
      nextBirthAt: current.elapsed + RULE.maturityAge,
      traits: mutateTraits(current, parent.traits),
    };
    confinePosition(child, RULE.margin);
    parent.reserve -= RULE.childCost;
    parent.nextBirthAt = current.elapsed + RULE.breedingRest;
    current.nextId++;
    current.siltstitchers.push(child);
    return true;
  });
}

function updateOne(world: World, body: Siltstitcher, dt: number): void {
  body.age += dt;
  if (body.age >= RULE.lifespan || body.starvedFor >= RULE.starvationLimit) return;
  const home = world.nests.find((nest) => nest.id === body.homeNestId);
  const phase = (world.tick + body.id) % 6 === 0;
  body.vx = 0;
  body.vy = 0;
  const atHome = home ? Math.hypot(home.x - body.x, home.y - body.y) <= RULE.homeReach : false;
  const isolatedAtSea = inSea(body.x, body.y) && !atHome && !tideConnectedAt(world.elapsed);
  if (isolatedAtSea) forageStrandline(world, body, dt);
  else if (!home) returnHome(body);
  else if (body.mode === 'home' || body.mode === 'returning') {
    const atHome = Math.hypot(home.x - body.x, home.y - body.y) <= RULE.homeReach;
    if (!atHome) move(body, home, dt);
    else {
      if (body.mode === 'returning' && body.cargo === 0) body.mode = 'home';
      const loading = body.mode === 'home';
      const stocking =
        siltstitcherReserveCapacity(body.traits) >= RULE.childCost &&
        body.age >= RULE.maturityAge &&
        body.reserve < siltstitcherBirthStake(body.traits) &&
        home.pigment > RULE.protectedStock;
      refill(world, body, home, dt, loading && !stocking);
      const loaded =
        body.cargo >= RULE.cargoCapacity ||
        (body.cargo >= RULE.minimumPartialCargo && (!loading || home.pigment <= RULE.protectedStock));
      if (loaded && phase && !stocking) {
        const destination = candidate(world, body, home);
        if (destination) {
          body.destination = destination;
          body.mode = 'outbound';
        }
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
  if (body.reserve > 0) birth(world, body);
  const maintenance = Math.min(body.reserve, dt * RULE.maintenanceRate * body.traits.drive);
  body.reserve -= maintenance;
  world.ecologyLedger.siltstitcherMaintenancePigment += maintenance;
  body.starvedFor = body.reserve <= 0 ? body.starvedFor + dt : 0;
}

export function admitSiltstitcher(world: World): boolean {
  if (
    world.tick % 6 !== 0 ||
    world.elapsed < world.siltstitcherAdmissionAt ||
    world.siltstitchers.length >= SILTSTITCHER_CAP ||
    activeNewTypePopulation(world) >= NEW_TYPE_POPULATION_CAP ||
    !safeId(world) ||
    world.elapsed > Number.MAX_SAFE_INTEGER - RULE.admissionRest
  )
    return false;
  let first: Nest | undefined;
  let afterCursor: Nest | undefined;
  for (const nest of world.nests) {
    if (
      nest.pigment < RULE.admissionThreshold ||
      !isInPool(nest.x, nest.y, RULE.margin) ||
      world.siltstitchers.some(
        (body) => body.homeNestId === nest.id || Math.hypot(body.x - nest.x, body.y - nest.y) < RULE.spacing,
      )
    )
      continue;
    if (!first || nest.id < first.id) first = nest;
    if (nest.id > world.siltstitcherCandidateAfterId && (!afterCursor || nest.id < afterCursor.id)) afterCursor = nest;
  }
  const home = afterCursor ?? first;
  if (!home) return false;
  world.siltstitcherCandidateAfterId = home.id;
  home.pigment -= RULE.admissionPigment;
  world.siltstitchers.push({
    id: world.nextId++,
    species: 'siltstitcher',
    x: home.x,
    y: home.y,
    vx: 0,
    vy: 0,
    body: RULE.bodyPigment,
    reserve: RULE.initialReserve,
    cargo: 0,
    age: 0,
    hue: home.hue,
    homeNestId: home.id,
    starvedFor: 0,
    mode: 'home',
    destination: null,
    blockedFor: 0,
    parentId: null,
    nextBirthAt: world.elapsed + RULE.maturityAge,
    traits: baselineTraits(),
  });
  world.siltstitcherAdmissionAt = world.elapsed + RULE.admissionRest;
  return true;
}

export function updateSiltstitchers(world: World, dt: number, allowStandaloneAdmission = true): void {
  const initialCount = world.siltstitchers.length;
  for (let i = 0; i < initialCount; i++) updateOne(world, world.siltstitchers[i], dt);
  let write = 0;
  for (const body of world.siltstitchers) {
    if (body.age >= RULE.lifespan || body.starvedFor >= RULE.starvationLimit)
      settleDeath(world, body, body.hue, body.body + body.reserve + body.cargo, 'siltstitcher');
    else world.siltstitchers[write++] = body;
  }
  world.siltstitchers.length = write;
  if (allowStandaloneAdmission) admitSiltstitcher(world);
}
