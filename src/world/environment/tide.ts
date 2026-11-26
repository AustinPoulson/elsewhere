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
  pocketMouthSegment,
  pocketShoreSegment,
  syncTide,
  tideConnectedAt,
  tideFlowAt,
  tideHeightAt,
  tideRegion,
  type TideRegion,
} from '../habitat';
import { inStrandline } from './strandline';
import { confinePosition } from '../geometry';
import { blendHue, MIN_SEDIMENT_GRAIN } from '../species/resources';
import { baselineTraits } from '../traits';
import {
  LIMITS,
  POCKET_BODY_CAP,
  POCKET_SEDIMENT_CAP,
  SEA_BODY_CAP,
  SEA_SEDIMENT_CAP,
  type CargoMite,
  type GlassLimpet,
  type Grazer,
  type Marlgrub,
  type Organism,
  type Point,
  type Sediment,
  type Siltstitcher,
  type Skimmer,
  type World,
} from '../types';

export { pocketConnectedAt, tideConnectedAt, tideFlowAt, tideHeightAt, tideRegion };

const TAU = Math.PI * 2;
const WASH_CHANCE = 0.16;
const WASH_DISTANCE = 40;
export const SEA_LUCENTS = 4;
export const SEA_GRAINS = 8;

export type TideName = 'low' | 'rising' | 'high' | 'falling';

type MobileBody = Organism | Grazer | Skimmer | Siltstitcher | CargoMite | Marlgrub | GlassLimpet;

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
  while (inStrandline(point.x, point.y)) {
    point.x = SEA_POOL.x + (point.x - SEA_POOL.x) * 0.62;
    point.y = SEA_POOL.y + (point.y - SEA_POOL.y) * 0.62;
    confinePosition(point, margin);
    if (Math.hypot(point.x - SEA_POOL.x, point.y - SEA_POOL.y) < 8) break;
  }
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
    if (!inSea(point.x, point.y) || inStrandline(point.x, point.y)) continue;
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

function pocketVisitorBodies(world: World): MobileBody[] {
  const bodies: MobileBody[] = [...world.skimmers, ...world.siltstitchers, ...world.marlgrubs, ...world.glassLimpets];
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

export function seaBodyCount(world: World): number {
  let count = 0;
  for (const body of [
    ...world.organisms,
    ...world.grazers,
    ...world.skimmers,
    ...world.siltstitchers,
    ...world.reedwells,
    ...world.rainbells,
    ...world.glassLimpets,
    ...world.cargoMites,
    ...world.marlgrubs,
  ]) {
    if (inSea(body.x, body.y)) count++;
  }
  return count;
}

export function pigmentInSea(world: World): number {
  let total = 0;
  for (const grain of world.sediment) if (inSea(grain.x, grain.y)) total += grain.strength;
  for (const remain of world.remains) if (inSea(remain.x, remain.y)) total += remain.pigment;
  for (const fossil of world.fossils) if (inSea(fossil.x, fossil.y)) total += fossil.pigment;
  for (const nest of world.nests) if (inSea(nest.x, nest.y)) total += nest.pigment;
  for (const body of [
    ...world.organisms,
    ...world.grazers,
    ...world.skimmers,
    ...world.siltstitchers,
    ...world.reedwells,
    ...world.rainbells,
    ...world.glassLimpets,
    ...world.cargoMites,
    ...world.marlgrubs,
  ]) {
    if (inSea(body.x, body.y)) total += carriedPigment(body);
  }
  return total;
}

export function pigmentOnShore(world: World): number {
  let total = 0;
  for (const grain of world.sediment)
    if (!inSea(grain.x, grain.y) && !inPocket(grain.x, grain.y)) total += grain.strength;
  for (const remain of world.remains)
    if (!inSea(remain.x, remain.y) && !inPocket(remain.x, remain.y)) total += remain.pigment;
  for (const fossil of world.fossils)
    if (!inSea(fossil.x, fossil.y) && !inPocket(fossil.x, fossil.y)) total += fossil.pigment;
  for (const nest of world.nests) if (!inSea(nest.x, nest.y) && !inPocket(nest.x, nest.y)) total += nest.pigment;
  for (const body of [
    ...world.organisms,
    ...world.grazers,
    ...world.skimmers,
    ...world.siltstitchers,
    ...world.reedwells,
    ...world.rainbells,
    ...world.glassLimpets,
    ...world.cargoMites,
    ...world.marlgrubs,
  ]) {
    if (!inSea(body.x, body.y) && !inPocket(body.x, body.y)) total += carriedPigment(body);
  }
  return total;
}

export function pocketNote(elapsed: number): string {
  return pocketConnectedAt(elapsed)
    ? 'A high rock pool is open to the sea at the top of the tide.'
    : 'A high rock pool sits cut off above the tide.';
}

export function pocketBodyCount(world: World): number {
  let count = 0;
  for (const body of [
    ...world.organisms,
    ...world.grazers,
    ...world.skimmers,
    ...world.siltstitchers,
    ...world.reedwells,
    ...world.rainbells,
    ...world.glassLimpets,
    ...world.cargoMites,
    ...world.marlgrubs,
  ]) {
    if (inPocket(body.x, body.y)) count++;
  }
  return count;
}

export function pigmentInPocket(world: World): number {
  let total = 0;
  for (const grain of world.sediment) if (inPocket(grain.x, grain.y)) total += grain.strength;
  for (const remain of world.remains) if (inPocket(remain.x, remain.y)) total += remain.pigment;
  for (const fossil of world.fossils) if (inPocket(fossil.x, fossil.y)) total += fossil.pigment;
  for (const nest of world.nests) if (inPocket(nest.x, nest.y)) total += nest.pigment;
  for (const body of [
    ...world.organisms,
    ...world.grazers,
    ...world.skimmers,
    ...world.siltstitchers,
    ...world.reedwells,
    ...world.rainbells,
    ...world.glassLimpets,
    ...world.cargoMites,
    ...world.marlgrubs,
  ]) {
    if (inPocket(body.x, body.y)) total += carriedPigment(body);
  }
  return total;
}

function shoreSide(region: TideRegion, flow: number): boolean {
  if (flow < 0) return region === 'sea' || region === 'mouth';
  return region === 'pool' || region === 'mouth';
}

function inMouthReach(body: Point): boolean {
  const link = mouthSegment();
  const reach = TIDE_MOUTH_WIDTH / 2 + TIDE_INFLUENCE;
  const abx = link.bx - link.ax;
  const aby = link.by - link.ay;
  const span = abx * abx + aby * aby;
  const t = span === 0 ? 0 : Math.min(1, Math.max(0, ((body.x - link.ax) * abx + (body.y - link.ay) * aby) / span));
  return Math.hypot(body.x - (link.ax + t * abx), body.y - (link.ay + t * aby)) <= reach;
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
    const pocketSide = next === 'pocket' || next === 'pocketMouth';
    const wasPocket = previous === 'pocket' || previous === 'pocketMouth';
    const intoPocket = !wasPocket && pocketSide && previous !== 'land';
    const outOfPocket = wasPocket && !pocketSide && next !== 'land';
    const pigment = carriedPigment(body);
    const species = 'species' in body ? (body as { species?: string }).species : undefined;
    const isBody = species !== undefined && species !== 'remain' && species !== 'fossil';
    const mobile =
      isBody &&
      (species === 'lucent' ||
        species === 'grazer' ||
        species === 'skimmer' ||
        species === 'siltstitcher' ||
        species === 'cargoMite' ||
        species === 'marlgrub');
    const pocketMobile = mobile || species === 'glassLimpet';
    if (fromSea) {
      world.ecologyLedger.tidePigmentIn += pigment;
      if (mobile) world.ecologyLedger.tideArrivals += 1;
    } else if (toSea) {
      world.ecologyLedger.tidePigmentOut += pigment;
      if (mobile) world.ecologyLedger.tideDepartures += 1;
    }
    if (intoPocket) {
      world.ecologyLedger.pocketPigmentIn += pigment;
      if (pocketMobile) world.ecologyLedger.pocketArrivals += 1;
    } else if (outOfPocket) {
      world.ecologyLedger.pocketPigmentOut += pigment;
      if (pocketMobile) world.ecologyLedger.pocketDepartures += 1;
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

function shoveAlongTide(body: Point, elapsed: number, margin: number): void {
  const link = mouthSegment();
  const flow = tideFlowAt(elapsed);
  const dir = flow >= 0 ? 1 : -1;
  const speed = Math.max(Math.abs(flow), TIDE_FLOW * 0.45);
  body.x += link.ux * dir * WASH_DISTANCE * (speed / TIDE_FLOW);
  body.y += link.uy * dir * WASH_DISTANCE * (speed / TIDE_FLOW);
  confinePosition(body, margin);
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

function pocketShoreSide(region: TideRegion): boolean {
  return region === 'sea' || region === 'pool' || region === 'mouth' || region === 'pocketMouth';
}

function alongReach(body: Point, link: { ax: number; ay: number; bx: number; by: number }): boolean {
  const reach = TIDE_POCKET_MOUTH_WIDTH / 2 + TIDE_POCKET_INFLUENCE;
  const abx = link.bx - link.ax;
  const aby = link.by - link.ay;
  const span = abx * abx + aby * aby;
  const t = span === 0 ? 0 : Math.min(1, Math.max(0, ((body.x - link.ax) * abx + (body.y - link.ay) * aby) / span));
  return Math.hypot(body.x - (link.ax + t * abx), body.y - (link.ay + t * aby)) <= reach;
}

function inPocketMouthReach(body: Point): boolean {
  return alongReach(body, pocketMouthSegment()) || alongReach(body, pocketShoreSegment());
}

function pocketWashCandidate(world: World): MobileBody | null {
  const pocketCount = pocketBodyCount(world);
  if (pocketCount >= POCKET_BODY_CAP) return null;
  const candidates: MobileBody[] = [];
  for (const body of pocketVisitorBodies(world)) {
    if (inPocket(body.x, body.y)) continue;
    if (!inPocketMouthReach(body)) continue;
    if (!pocketShoreSide(tideRegion(body.x, body.y))) continue;
    candidates.push(body);
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(world.tick / 6) % candidates.length];
}

function shoveAlongPocket(body: Point, margin: number): void {
  const sea = pocketMouthSegment();
  const shore = pocketShoreSegment();
  const link = alongReach(body, shore) ? shore : sea;
  body.x -= link.ux * WASH_DISTANCE * 0.85;
  body.y -= link.uy * WASH_DISTANCE * 0.85;
  confinePosition(body, margin);
}

function washPocketOnce(world: World): void {
  if (world.tick % 6 !== 4) return;
  if (!pocketConnectedAt(world.elapsed)) return;
  const body = pocketWashCandidate(world);
  if (!body) return;
  const margin = 'size' in body && typeof body.size === 'number' ? body.size + 3 : 11;
  shoveAlongPocket(body, margin);
}

function compactPocketSediment(world: World): void {
  if (world.tick % 6 !== 5) return;
  const grains: Sediment[] = [];
  for (const grain of world.sediment) {
    if (grain.strength > 0 && inPocket(grain.x, grain.y)) grains.push(grain);
  }
  if (grains.length <= POCKET_SEDIMENT_CAP) return;
  let weakest = grains[0];
  for (const grain of grains) {
    if (grain.strength < weakest.strength || (grain.strength === weakest.strength && grain.id < weakest.id)) {
      weakest = grain;
    }
  }
  let dest: Sediment | undefined;
  for (const grain of grains) {
    if (grain.id === weakest.id || grain.strength >= 1) continue;
    if (!dest || grain.strength > dest.strength || (grain.strength === dest.strength && grain.id < dest.id)) {
      dest = grain;
    }
  }
  if (!dest) return;
  const moved = Math.min(weakest.strength, 1 - dest.strength);
  if (!(moved > 0)) return;
  dest.hue = blendHue(dest.hue, weakest.hue, dest.strength, moved);
  dest.strength += moved;
  weakest.strength -= moved;
  if (weakest.strength > 0 && weakest.strength < MIN_SEDIMENT_GRAIN && dest.strength < 1) {
    const rest = Math.min(weakest.strength, 1 - dest.strength);
    dest.hue = blendHue(dest.hue, weakest.hue, dest.strength, rest);
    dest.strength += rest;
    weakest.strength -= rest;
  }
}

export function applyTide(world: World, before: Map<number, TideRegion>): void {
  syncTide(world.elapsed);
  washOnce(world);
  washPocketOnce(world);
  compactPocketSediment(world);
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
