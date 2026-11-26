import { SEA_POOL, inSea, inTideMouth, mouthSegment, poolCoastPoint, tideFlowAt } from '../habitat';
import { remainRadius } from '../species/remains';
import { blendHue, MIN_SEDIMENT_GRAIN } from '../species/resources';
import {
  REMAIN_CAPACITY,
  STRANDLINE_GRAIN_CAP,
  STRANDLINE_REMAIN_CAP,
  type Point,
  type Remain,
  type Sediment,
  type World,
} from '../types';

export const STRANDLINE = {
  targetRho: 0.78,
  rx: 72,
  ry: 12,
  settle: 0.8,
  leachAmount: 0.00018,
  compactReach: 24,
  compactAmount: 0.08,
  grainCap: STRANDLINE_GRAIN_CAP,
  remainCap: STRANDLINE_REMAIN_CAP,
} as const;

function signed(value: number): number {
  return value === 0 ? 0 : value;
}

function strandlineCenter(): Point {
  return poolCoastPoint(SEA_POOL, Math.PI / 2, STRANDLINE.targetRho);
}

export function strandlineAnchor(): Point {
  return strandlineCenter();
}

export function inStrandline(x: number, y: number): boolean {
  if (!inSea(x, y) || inTideMouth(x, y)) return false;
  const center = strandlineCenter();
  const nx = (x - center.x) / STRANDLINE.rx;
  const ny = (y - center.y) / STRANDLINE.ry;
  return nx * nx + ny * ny <= 1;
}

export function strandlineInSea(): boolean {
  const center = strandlineCenter();
  const left = { x: center.x - STRANDLINE.rx * 0.92, y: center.y };
  const right = { x: center.x + STRANDLINE.rx * 0.92, y: center.y };
  const north = { x: center.x, y: center.y - STRANDLINE.ry * 0.92 };
  const south = { x: center.x, y: center.y + STRANDLINE.ry * 0.92 };
  return (
    inSea(center.x, center.y) &&
    inSea(left.x, left.y) &&
    inSea(right.x, right.y) &&
    inSea(north.x, north.y) &&
    inSea(south.x, south.y)
  );
}

function nearMouth(point: Point): boolean {
  const link = mouthSegment();
  const reach = link.width / 2 + 18;
  const abx = link.bx - link.ax;
  const aby = link.by - link.ay;
  const span = abx * abx + aby * aby;
  const t = span === 0 ? 0 : Math.min(1, Math.max(0, ((point.x - link.ax) * abx + (point.y - link.ay) * aby) / span));
  return Math.hypot(point.x - (link.ax + t * abx), point.y - (link.ay + t * aby)) <= reach;
}

export function wrackPigment(body: Point): number {
  const record = body as unknown as Record<string, unknown>;
  if (typeof record.strength === 'number') return record.strength;
  if (typeof record.pigment === 'number') return record.pigment;
  return 0;
}

export function shouldSettleWrack(point: Point, elapsed: number): boolean {
  const flow = tideFlowAt(elapsed);
  if (flow < 0) return false;
  if (inTideMouth(point.x, point.y) || !inSea(point.x, point.y)) return false;
  if (inStrandline(point.x, point.y)) return true;
  if (!(flow > 0)) return false;
  return nearMouth(point);
}

export function strandlineSettleVelocity(point: Point, elapsed: number, out?: Point): Point {
  const result = out ?? { x: 0, y: 0 };
  if (!shouldSettleWrack(point, elapsed)) {
    result.x = 0;
    result.y = 0;
    return result;
  }
  const center = strandlineCenter();
  const dx = center.x - point.x;
  const dy = center.y - point.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) {
    result.x = 0;
    result.y = 0;
    return result;
  }
  const error = dist / Math.max(STRANDLINE.rx, STRANDLINE.ry);
  const speed = STRANDLINE.settle * Math.min(1, error);
  result.x = signed((dx / dist) * speed);
  result.y = signed((dy / dist) * speed);
  return result;
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

export function pigmentOnStrandline(world: World): number {
  let total = 0;
  for (const grain of world.sediment) if (inStrandline(grain.x, grain.y)) total += grain.strength;
  for (const remain of world.remains) if (inStrandline(remain.x, remain.y)) total += remain.pigment;
  for (const fossil of world.fossils) if (inStrandline(fossil.x, fossil.y)) total += fossil.pigment;
  for (const nest of world.nests) if (inStrandline(nest.x, nest.y)) total += nest.pigment;
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
    if (inStrandline(body.x, body.y)) total += carriedPigment(body);
  }
  return total;
}

export function strandlineBodyCount(world: World): number {
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
    if (inStrandline(body.x, body.y)) count++;
  }
  return count;
}

export function strandlineGrainCount(world: Pick<World, 'sediment'>): number {
  let count = 0;
  for (const grain of world.sediment) if (inStrandline(grain.x, grain.y)) count++;
  return count;
}

export function strandlineRemainCount(world: Pick<World, 'remains'>): number {
  let count = 0;
  for (const remain of world.remains) if (inStrandline(remain.x, remain.y)) count++;
  return count;
}

export function describeStrandlineChange(before: number, after: number): string | null {
  if (!Number.isFinite(before) || !Number.isFinite(after)) return null;
  if (after - before >= 0.2) return 'Wrack settled on the strandline beyond the mouth.';
  if (before - after >= 0.2) return 'Strandline wrack leached back into the sea.';
  return null;
}

export function strandlineNote(world: World): string {
  const held = pigmentOnStrandline(world);
  const bodies = strandlineBodyCount(world);
  if (held < 0.05 && bodies === 0) {
    return 'A strandline waits on the sea side of the mouth. Wrack that leaves on the ebb can settle there.';
  }
  const color = held < 0.05 ? 'little color' : `${held.toFixed(1)} pigment`;
  if (bodies === 0) return `A strandline holds ${color} on the sea side of the mouth.`;
  const lives = `${bodies} ${bodies === 1 ? 'body' : 'bodies'}`;
  return `A strandline holds ${color} and ${lives} on the sea side of the mouth.`;
}

function pourSediment(into: Sediment, from: Sediment, amount: number): number {
  const moved = Math.min(amount, from.strength, Math.max(0, 1 - into.strength));
  if (!(moved > 0)) return 0;
  into.hue = blendHue(into.hue, from.hue, into.strength, moved);
  into.strength += moved;
  from.strength -= moved;
  if (from.strength > 0 && from.strength < MIN_SEDIMENT_GRAIN && into.strength < 1) {
    const rest = Math.min(from.strength, 1 - into.strength);
    into.hue = blendHue(into.hue, from.hue, into.strength, rest);
    into.strength += rest;
    from.strength -= rest;
    return moved + rest;
  }
  return moved;
}

function pourRemain(into: Remain, from: Remain, amount: number): number {
  const moved = Math.min(amount, from.pigment, Math.max(0, REMAIN_CAPACITY - into.pigment));
  if (!(moved > 0)) return 0;
  into.hue = blendHue(into.hue, from.hue, into.pigment, moved);
  into.pigment += moved;
  into.radius = remainRadius(into.pigment);
  from.pigment -= moved;
  from.radius = remainRadius(from.pigment);
  return moved;
}

function discardEmptyGrains(world: World): void {
  let write = 0;
  for (const grain of world.sediment) {
    if (grain.strength > 0) world.sediment[write++] = grain;
  }
  world.sediment.length = write;
}

function discardEmptyRemains(world: World): void {
  let write = 0;
  for (const remain of world.remains) {
    if (remain.pigment > 0) world.remains[write++] = remain;
  }
  world.remains.length = write;
}

function nearestStrandlineGrain(world: World, grain: Sediment, reach: number): Sediment | undefined {
  let nearest: Sediment | undefined;
  let distance = reach;
  for (const other of world.sediment) {
    if (other.id === grain.id || other.strength <= 0 || !inStrandline(other.x, other.y)) continue;
    const candidate = Math.hypot(other.x - grain.x, other.y - grain.y);
    if (candidate < distance || (candidate === distance && (!nearest || other.id < nearest.id))) {
      distance = candidate;
      nearest = other;
    }
  }
  return nearest;
}

function nearestStrandlineRemain(world: World, remain: Remain, reach: number): Remain | undefined {
  let nearest: Remain | undefined;
  let distance = reach;
  for (const other of world.remains) {
    if (other.id === remain.id || other.pigment <= 0 || !inStrandline(other.x, other.y)) continue;
    const candidate = Math.hypot(other.x - remain.x, other.y - remain.y);
    if (candidate < distance || (candidate === distance && (!nearest || other.id < nearest.id))) {
      distance = candidate;
      nearest = other;
    }
  }
  return nearest;
}

function fullerGrain(a: Sediment, b: Sediment): boolean {
  return a.strength > b.strength || (a.strength === b.strength && a.id < b.id);
}

function fullerRemain(a: Remain, b: Remain): boolean {
  return a.pigment > b.pigment || (a.pigment === b.pigment && a.id < b.id);
}

function ordinarySeaGrain(world: World, from: Point): Sediment | undefined {
  let nearest: Sediment | undefined;
  let distance = Infinity;
  for (const grain of world.sediment) {
    if (!(grain.strength > 0) || grain.strength >= 1) continue;
    if (!inSea(grain.x, grain.y) || inStrandline(grain.x, grain.y)) continue;
    const candidate = Math.hypot(grain.x - from.x, grain.y - from.y);
    if (candidate < distance || (candidate === distance && (!nearest || grain.id < nearest.id))) {
      distance = candidate;
      nearest = grain;
    }
  }
  return nearest;
}

export function compactStrandline(world: World): void {
  if (world.tick % 6 !== 2) return;
  const grains = world.sediment.filter((grain) => grain.strength > 0 && inStrandline(grain.x, grain.y));
  if (grains.length >= 2) {
    const grain = grains[Math.floor(world.tick / 6) % grains.length];
    const other = nearestStrandlineGrain(world, grain, STRANDLINE.compactReach);
    if (other) {
      const into = fullerGrain(grain, other) ? grain : other;
      const from = into === grain ? other : grain;
      pourSediment(into, from, STRANDLINE.compactAmount);
    }
  }
  const remains = world.remains.filter((remain) => remain.pigment > 0 && inStrandline(remain.x, remain.y));
  if (remains.length >= 2) {
    const remain = remains[Math.floor(world.tick / 6) % remains.length];
    const other = nearestStrandlineRemain(world, remain, STRANDLINE.compactReach);
    if (other) {
      const into = fullerRemain(remain, other) ? remain : other;
      const from = into === remain ? other : remain;
      pourRemain(into, from, STRANDLINE.compactAmount);
    }
  }
  if (remains.length > STRANDLINE.remainCap) {
    let weakest = remains[0];
    let fullest = remains[0];
    for (const remain of remains) {
      if (remain.pigment < weakest.pigment || (remain.pigment === weakest.pigment && remain.id < weakest.id)) {
        weakest = remain;
      }
      if (fullerRemain(remain, fullest)) fullest = remain;
    }
    if (weakest.id !== fullest.id) pourRemain(fullest, weakest, weakest.pigment);
  }
  discardEmptyGrains(world);
  discardEmptyRemains(world);
}

function leachOneGrain(world: World, grain: Sediment, amount: number): number {
  const dest = ordinarySeaGrain(world, grain);
  if (!dest) return 0;
  const moved = pourSediment(dest, grain, amount);
  world.ecologyLedger.strandlineLeached += moved;
  return moved;
}

export function leachStrandline(world: World): void {
  if (world.tick % 6 !== 4) return;
  const grains = world.sediment.filter((grain) => grain.strength > 0 && inStrandline(grain.x, grain.y));
  if (grains.length === 0) return;
  const grain = grains[Math.floor(world.tick / 6) % grains.length];
  leachOneGrain(world, grain, STRANDLINE.leachAmount);
  if (grains.length > STRANDLINE.grainCap) {
    let weakest = grains[0];
    for (const other of grains) {
      if (other.strength < weakest.strength || (other.strength === weakest.strength && other.id < weakest.id)) {
        weakest = other;
      }
    }
    leachOneGrain(world, weakest, Math.min(weakest.strength, STRANDLINE.compactAmount));
  }
  discardEmptyGrains(world);
}
