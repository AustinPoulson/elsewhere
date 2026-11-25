import { nextRandom } from '../rng';
import {
  SEA_POOL,
  TIDE_CONNECT,
  TIDE_FLOW,
  TIDE_INFLUENCE,
  TIDE_MOUTH_WIDTH,
  TIDE_PERIOD,
  TIDE_POCKET_INFLUENCE,
  TIDE_POCKET_MOUTH_WIDTH,
  inPocket,
  inSea,
  mouthSegment,
  pocketConnectedAt,
  pocketEbbAt,
  pocketFlowAt,
  pocketMouthSegment,
  syncTide,
  tideConnectedAt,
  tideFlowAt,
  tideHeightAt,
  tideRegion,
  type TideRegion,
} from '../habitat';

export { pocketConnectedAt, pocketEbbAt, pocketFlowAt, tideConnectedAt, tideFlowAt, tideHeightAt, tideRegion };
import { confinePosition } from '../geometry';
import { baselineTraits } from '../traits';
import {
  LIMITS,
  POCKET_BODY_CAP,
  SEA_BODY_CAP,
  SEA_SEDIMENT_CAP,
  type CargoMite,
  type Grazer,
  type Marlgrub,
  type Organism,
  type Point,
  type Siltstitcher,
  type Skimmer,
  type World,
} from '../types';

const TAU = Math.PI * 2;
const WASH_CHANCE = 0.16;
const WASH_DISTANCE = 40;
const POCKET_WASH_DISTANCE = 48;
const POCKET_WASH_TICK = 6;
const POCKET_EBB_WASH_DISTANCE = 24;
const POCKET_EBB_WASH_TICK = 18;
export const SEA_LUCENTS = 4;
export const SEA_GRAINS = 8;
export const POCKET_LUCENT_CAP = 2;

export type TideName = 'low' | 'rising' | 'high' | 'falling';

type MobileBody = Organism | Grazer | Skimmer | Siltstitcher | CargoMite | Marlgrub;

function seedUnit(seed: number, lane: number): number {
  return ((Math.imul(seed ^ (lane * 0x9e3779b9), 0x85ebca6b) >>> 0) % 10_000) / 10_000;
}

function seaPoint(seed: number, lane: number, margin: number): Point {
  const angle = seedUnit(seed, lane) * TAU;
  const radius = Math.sqrt(seedUnit(seed, lane + 17)) * 0.72;
  const point = {
    x: SEA_POOL.x + Math.cos(angle) * radius * (SEA_POOL.rx - margin),
    y: SEA_POOL.y + Math.sin(angle) * radius * (SEA_POOL.ry - margin),
  };
  confinePosition(point, margin);
  return point;
}

export function tideNameAt(elapsed: number): TideName {
  const height = tideHeightAt(elapsed);
  const rising = Math.cos((elapsed / TIDE_PERIOD) * Math.PI * 2) > 0;
  if (height >= 0.72) return 'high';
  if (height <= -0.72) return 'low';
  return rising ? 'rising' : 'falling';
}

export function tideNote(elapsed: number): string {
  const connected = tideConnectedAt(elapsed);
  const name = tideNameAt(elapsed);
  if (name === 'high') return 'High tide. The mouth is open to the sea.';
  if (name === 'low') return 'Low tide. The pool is cut off from the sea.';
  if (name === 'rising') {
    return connected
      ? 'The tide is rising. Color can wash with the sea.'
      : 'The tide is rising. The pool is still cut off.';
  }
  return connected
    ? 'The tide is falling. The mouth is still open.'
    : 'The tide is falling. The pool is cut off from the sea.';
}

export function pocketNote(elapsed: number): string {
  if (!pocketConnectedAt(elapsed)) return 'A high rock pool sits cut off above the tide.';
  if (pocketEbbAt(elapsed)) return 'A high rock pool is leaking slowly back to the sea.';
  return 'A high rock pool is open to the sea.';
}

export function initializeSea(world: World): void {
  const hues = [168, 196, 226, 302];
  for (let i = 0; i < SEA_LUCENTS; i++) {
    const point = seaPoint(world.seed, 40 + i * 3, 24);
    const heading = seedUnit(world.seed, 80 + i) * TAU;
    const size = 5.4 + seedUnit(world.seed, 90 + i) * 3.2;
    const organism: Organism = {
      id: world.nextId++,
      species: 'lucent',
      ...point,
      vx: Math.cos(heading) * 24,
      vy: Math.sin(heading) * 24,
      energy: 0.72 + seedUnit(world.seed, 100 + i) * 0.5,
      age: 0,
      hue: hues[i],
      size,
      phase: seedUnit(world.seed, 110 + i) * TAU,
      trail: [],
      pigmentCredit: 0,
      traits: baselineTraits(),
    };
    for (let j = 5; j >= 0; j--) {
      const wake = { x: point.x - Math.cos(heading) * j * 3, y: point.y - Math.sin(heading) * j * 3 };
      if (inSea(wake.x, wake.y)) organism.trail.push(wake);
    }
    world.organisms.push(organism);
  }
  let seaGrains = 0;
  for (const grain of world.sediment) if (inSea(grain.x, grain.y)) seaGrains++;
  for (let i = 0; i < SEA_GRAINS && world.sediment.length < LIMITS.sediment && seaGrains < SEA_SEDIMENT_CAP; i++) {
    const point = seaPoint(world.seed, 200 + i * 5, 12);
    if (!inSea(point.x, point.y)) continue;
    seaGrains++;
    world.sediment.push({
      id: world.nextId++,
      ...point,
      radius: 3.4 + seedUnit(world.seed, 240 + i) * 4.2,
      hue: hues[i % hues.length],
      strength: 0.14 + seedUnit(world.seed, 260 + i) * 0.1,
      age: 0,
    });
  }
}

function carriedPigment(body: Point & { species?: string }): number {
  const record = body as unknown as Record<string, unknown>;
  let total = 0;
  if (typeof record.pigmentCredit === 'number') total += record.pigmentCredit;
  if (typeof record.body === 'number') total += record.body;
  if (typeof record.reserve === 'number') total += record.reserve;
  if (typeof record.cargo === 'number') total += record.cargo;
  if (typeof record.pigment === 'number') total += record.pigment;
  if (typeof record.strength === 'number') total += record.strength;
  return total;
}

function mobileBodies(world: World): MobileBody[] {
  const bodies: MobileBody[] = [
    ...world.organisms,
    ...world.grazers,
    ...world.skimmers,
    ...world.siltstitchers,
    ...world.marlgrubs,
  ];
  for (const mite of world.cargoMites) if (mite.mode === 'seeking') bodies.push(mite);
  return bodies;
}

function allLocated(world: World): Point[] {
  return [
    ...world.organisms,
    ...world.grazers,
    ...world.skimmers,
    ...world.siltstitchers,
    ...world.reedwells,
    ...world.rainbells,
    ...world.glassLimpets,
    ...world.cargoMites,
    ...world.marlgrubs,
    ...world.sediment,
    ...world.remains,
    ...world.fossils,
    ...world.nests,
  ];
}

function livingBodies(world: World): Point[] {
  return [
    ...world.organisms,
    ...world.grazers,
    ...world.skimmers,
    ...world.siltstitchers,
    ...world.reedwells,
    ...world.rainbells,
    ...world.glassLimpets,
    ...world.cargoMites,
    ...world.marlgrubs,
  ];
}

export function seaBodyCount(world: World): number {
  let count = 0;
  for (const body of livingBodies(world)) {
    if (inSea(body.x, body.y)) count++;
  }
  return count;
}

export function pocketBodyCount(world: World): number {
  let count = 0;
  for (const body of livingBodies(world)) {
    if (inPocket(body.x, body.y)) count++;
  }
  return count;
}

export function seaLucentCount(world: World): number {
  let count = 0;
  for (const body of world.organisms) {
    if (inSea(body.x, body.y)) count++;
  }
  return count;
}

export function pocketLucentCount(world: World): number {
  let count = 0;
  for (const body of world.organisms) {
    if (inPocket(body.x, body.y)) count++;
  }
  return count;
}

export function seaGrainCount(world: World): number {
  let count = 0;
  for (const grain of world.sediment) {
    if (inSea(grain.x, grain.y)) count++;
  }
  return count;
}

function pigmentInRegion(world: World, inRegion: (x: number, y: number) => boolean): number {
  let total = 0;
  for (const grain of world.sediment) if (inRegion(grain.x, grain.y)) total += grain.strength;
  for (const remain of world.remains) if (inRegion(remain.x, remain.y)) total += remain.pigment;
  for (const fossil of world.fossils) if (inRegion(fossil.x, fossil.y)) total += fossil.pigment;
  for (const nest of world.nests) if (inRegion(nest.x, nest.y)) total += nest.pigment;
  for (const body of livingBodies(world)) {
    if (inRegion(body.x, body.y)) total += carriedPigment(body);
  }
  return total;
}

export function pigmentInSea(world: World): number {
  return pigmentInRegion(world, inSea);
}

export function pigmentInPocket(world: World): number {
  return pigmentInRegion(world, inPocket);
}

export function pigmentOnShore(world: World): number {
  return pigmentInRegion(world, (x, y) => !inSea(x, y) && !inPocket(x, y));
}

function shoreSide(region: TideRegion, flow: number): boolean {
  if (flow < 0) return region === 'sea' || region === 'mouth';
  return region === 'pool' || region === 'mouth';
}

function pocketShoreSide(region: TideRegion, flow: number): boolean {
  if (flow < 0) return region === 'sea' || region === 'pocketMouth';
  return region === 'pocket' || region === 'pocketMouth';
}

function inLinkReach(
  body: Point,
  link: { ax: number; ay: number; bx: number; by: number },
  width: number,
  influence: number,
): boolean {
  const reach = width / 2 + influence;
  const abx = link.bx - link.ax;
  const aby = link.by - link.ay;
  const span = abx * abx + aby * aby;
  const t = span === 0 ? 0 : Math.min(1, Math.max(0, ((body.x - link.ax) * abx + (body.y - link.ay) * aby) / span));
  return Math.hypot(body.x - (link.ax + t * abx), body.y - (link.ay + t * aby)) <= reach;
}

function inMouthReach(body: Point): boolean {
  return inLinkReach(body, mouthSegment(), TIDE_MOUTH_WIDTH, TIDE_INFLUENCE);
}

function inPocketMouthReach(body: Point): boolean {
  return inLinkReach(body, pocketMouthSegment(), TIDE_POCKET_MOUTH_WIDTH, TIDE_POCKET_INFLUENCE);
}

function snapshotRegions(world: World): Map<number, TideRegion> {
  const regions = new Map<number, TideRegion>();
  for (const body of allLocated(world)) {
    const id = (body as { id?: number }).id;
    if (typeof id !== 'number') continue;
    regions.set(id, tideRegion(body.x, body.y));
  }
  return regions;
}

function accountCrossings(world: World, before: Map<number, TideRegion>): void {
  for (const body of allLocated(world)) {
    const id = (body as { id?: number }).id;
    if (typeof id !== 'number') continue;
    const previous = before.get(id);
    const next = tideRegion(body.x, body.y);
    if (!previous || previous === next) continue;
    const fromSea = previous === 'sea' && (next === 'pool' || next === 'mouth');
    const toSea = next === 'sea' && (previous === 'pool' || previous === 'mouth');
    const intoPocket = previous === 'sea' && (next === 'pocket' || next === 'pocketMouth');
    const outOfPocket = next === 'sea' && (previous === 'pocket' || previous === 'pocketMouth');
    const pigment = carriedPigment(body);
    const isBody = 'species' in body && body.species !== 'remain' && body.species !== 'fossil';
    const mobile =
      isBody &&
      (body.species === 'lucent' ||
        body.species === 'grazer' ||
        body.species === 'skimmer' ||
        body.species === 'siltstitcher' ||
        body.species === 'cargoMite' ||
        body.species === 'marlgrub');
    if (fromSea) {
      world.ecologyLedger.tidePigmentIn += pigment;
      if (mobile) world.ecologyLedger.tideArrivals += 1;
    } else if (toSea) {
      world.ecologyLedger.tidePigmentOut += pigment;
      if (mobile) world.ecologyLedger.tideDepartures += 1;
    }
    if (intoPocket) {
      world.ecologyLedger.pocketPigmentIn += pigment;
      if (mobile) world.ecologyLedger.pocketArrivals += 1;
    } else if (outOfPocket) {
      world.ecologyLedger.pocketPigmentOut += pigment;
      if (mobile) world.ecologyLedger.pocketDepartures += 1;
    }
  }
}

function washCandidate(world: World): MobileBody | null {
  const flow = tideFlowAt(world.elapsed);
  if (flow === 0) return null;
  const seaCount = seaBodyCount(world);
  const candidates: MobileBody[] = [];
  for (const body of mobileBodies(world)) {
    if (!inMouthReach(body)) continue;
    if (!shoreSide(tideRegion(body.x, body.y), flow)) continue;
    if (flow > 0 && !inSea(body.x, body.y) && seaCount >= SEA_BODY_CAP) continue;
    candidates.push(body);
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(world.tick / 6) % candidates.length];
}

function pocketWashCandidate(world: World): MobileBody | null {
  const flow = pocketFlowAt(world.elapsed);
  if (flow === 0) return null;
  const seaCount = seaBodyCount(world);
  const pocketCount = pocketBodyCount(world);
  const seaLucents = seaLucentCount(world);
  const pocketLucents = pocketLucentCount(world);
  const candidates: MobileBody[] = [];
  for (const body of mobileBodies(world)) {
    if (!inPocketMouthReach(body)) continue;
    if (!pocketShoreSide(tideRegion(body.x, body.y), flow)) continue;
    if (flow > 0 && !inSea(body.x, body.y) && seaCount >= SEA_BODY_CAP) continue;
    if (flow < 0 && !inPocket(body.x, body.y) && pocketCount >= POCKET_BODY_CAP) continue;
    if (flow < 0 && inSea(body.x, body.y)) {
      if (body.species === 'grazer') continue;
      if (body.species === 'lucent' && (seaLucents <= SEA_LUCENTS || pocketLucents >= POCKET_LUCENT_CAP)) continue;
    }
    candidates.push(body);
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(world.tick / 6) % candidates.length];
}

function shoveAlongLink(
  body: Point,
  link: { ux: number; uy: number },
  flow: number,
  margin: number,
  distance = WASH_DISTANCE,
  minSpeed = TIDE_FLOW * 0.45,
): void {
  const dir = flow >= 0 ? 1 : -1;
  const speed = Math.max(Math.abs(flow), minSpeed);
  body.x += link.ux * dir * distance * (speed / TIDE_FLOW);
  body.y += link.uy * dir * distance * (speed / TIDE_FLOW);
  confinePosition(body, margin);
}

function shoveAlongTide(body: Point, elapsed: number, margin: number): void {
  shoveAlongLink(body, mouthSegment(), tideFlowAt(elapsed), margin);
}

function washOnce(world: World): void {
  if (world.tick % 6 !== 3) return;
  if (!tideConnectedAt(world.elapsed)) return;
  const body = washCandidate(world);
  if (!body) return;
  if (nextRandom(world) >= WASH_CHANCE) return;
  const margin = 'size' in body && typeof body.size === 'number' ? body.size + 3 : 11;
  shoveAlongTide(body, world.elapsed, margin);
}

function washPocketOnce(world: World): void {
  if (!pocketConnectedAt(world.elapsed)) return;
  const ebb = pocketEbbAt(world.elapsed);
  const tick = ebb ? POCKET_EBB_WASH_TICK : POCKET_WASH_TICK;
  if (world.tick % tick !== 4) return;
  const body = pocketWashCandidate(world);
  if (!body) return;
  const margin = 'size' in body && typeof body.size === 'number' ? body.size + 3 : 11;
  const flow = pocketFlowAt(world.elapsed);
  shoveAlongLink(
    body,
    pocketMouthSegment(),
    flow,
    margin,
    ebb ? POCKET_EBB_WASH_DISTANCE : POCKET_WASH_DISTANCE,
    ebb ? 0 : TIDE_FLOW * 0.45,
  );
}

export function applyTide(world: World, before: Map<number, TideRegion>): void {
  syncTide(world.elapsed);
  washOnce(world);
  washPocketOnce(world);
  if (before.size > 0) accountCrossings(world, before);
}

export function beginTideStep(world: World): Map<number, TideRegion> {
  syncTide(world.elapsed);
  if (!tideConnectedAt(world.elapsed) && !pocketConnectedAt(world.elapsed)) return new Map();
  return snapshotRegions(world);
}

export const TIDE = {
  period: TIDE_PERIOD,
  connect: TIDE_CONNECT,
  flow: TIDE_FLOW,
  washChance: WASH_CHANCE,
} as const;
