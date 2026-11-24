import { channelScaleAt } from './environment/seasons';
import { poolRadius, type HabitatChannel, type HabitatPool, type Point } from './types';

export const OPENING_POOL: HabitatPool = { id: 1, x: 720, y: 500, rx: 610, ry: 400 };
export const INLET_POOL: HabitatPool = { id: 2, x: 745, y: 1275, rx: 260, ry: 200 };
export const SEA_POOL: HabitatPool = { id: 3, x: 720, y: -72, rx: 250, ry: 128 };
export const HABITAT_POOLS: readonly HabitatPool[] = [OPENING_POOL, INLET_POOL];
export const WATER_BASINS: readonly HabitatPool[] = [OPENING_POOL, INLET_POOL, SEA_POOL];
export const HABITAT_CHANNEL: HabitatChannel = { from: 1, to: 2, width: 72, flow: 4.8 };
export const TIDE_MOUTH_WIDTH = 52;
export const CHANNEL_PERIOD = 180;
export const CHANNEL_INFLUENCE = 28;
export const TIDE_PERIOD = 360;
export const TIDE_CONNECT = 0.32;
export const TIDE_FLOW = 3.6;
export const TIDE_INFLUENCE = 24;
const POOL_RADIUS_EXTENT = 1.11;

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function rimPoint(pool: HabitatPool, ux: number, uy: number): Point {
  const angle = Math.atan2(uy / pool.ry, ux / pool.rx);
  const radius = poolRadius(angle);
  const span = Math.hypot(ux / pool.rx, uy / pool.ry);
  const t = radius / span;
  return { x: pool.x + ux * t, y: pool.y + uy * t };
}

function channelAxis(): {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  ux: number;
  uy: number;
  abx: number;
  aby: number;
  span: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  const dx = INLET_POOL.x - OPENING_POOL.x;
  const dy = INLET_POOL.y - OPENING_POOL.y;
  const length = Math.hypot(dx, dy);
  const ux = dx / length;
  const uy = dy / length;
  const start = rimPoint(OPENING_POOL, ux, uy);
  const end = rimPoint(INLET_POOL, -ux, -uy);
  const abx = end.x - start.x;
  const aby = end.y - start.y;
  return {
    ax: start.x,
    ay: start.y,
    bx: end.x,
    by: end.y,
    ux,
    uy,
    abx,
    aby,
    span: abx * abx + aby * aby,
    minX: Math.min(start.x, end.x),
    maxX: Math.max(start.x, end.x),
    minY: Math.min(start.y, end.y),
    maxY: Math.max(start.y, end.y),
  };
}

let channelCache: ReturnType<typeof channelAxis> | null = null;
function channel(): ReturnType<typeof channelAxis> {
  if (!channelCache) channelCache = channelAxis();
  return channelCache;
}

function mouthAxis(): {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  ux: number;
  uy: number;
  abx: number;
  aby: number;
  span: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  const dx = SEA_POOL.x - OPENING_POOL.x;
  const dy = SEA_POOL.y - OPENING_POOL.y;
  const length = Math.hypot(dx, dy);
  const ux = dx / length;
  const uy = dy / length;
  const start = rimPoint(OPENING_POOL, ux, uy);
  const end = rimPoint(SEA_POOL, -ux, -uy);
  const abx = end.x - start.x;
  const aby = end.y - start.y;
  return {
    ax: start.x,
    ay: start.y,
    bx: end.x,
    by: end.y,
    ux,
    uy,
    abx,
    aby,
    span: abx * abx + aby * aby,
    minX: Math.min(start.x, end.x),
    maxX: Math.max(start.x, end.x),
    minY: Math.min(start.y, end.y),
    maxY: Math.max(start.y, end.y),
  };
}

let mouthCache: ReturnType<typeof mouthAxis> | null = null;
function mouth(): ReturnType<typeof mouthAxis> {
  if (!mouthCache) mouthCache = mouthAxis();
  return mouthCache;
}

let tideElapsed = NaN;
let tideLevel = 0;
let tideOpen = false;

export function syncTide(elapsed: number): void {
  if (elapsed !== tideElapsed) {
    tideElapsed = elapsed;
    tideLevel = Math.sin((elapsed / TIDE_PERIOD) * Math.PI * 2);
    tideOpen = tideLevel >= TIDE_CONNECT;
  }
}

export function tideHeightAt(elapsed: number): number {
  syncTide(elapsed);
  return tideLevel;
}

export function tideConnectedAt(elapsed: number): boolean {
  syncTide(elapsed);
  return tideOpen;
}

export function tideFlowAt(elapsed: number): number {
  syncTide(elapsed);
  if (!tideOpen) return 0;
  return -Math.cos((elapsed / TIDE_PERIOD) * Math.PI * 2) * TIDE_FLOW;
}

export function linkedHabitat(): { pools: HabitatPool[]; channel: HabitatChannel } {
  return {
    pools: HABITAT_POOLS.map((pool) => ({ ...pool })),
    channel: { ...HABITAT_CHANNEL },
  };
}

export function isAuthoredHabitat(pools: unknown, channel: unknown): boolean {
  const authored = linkedHabitat();
  return JSON.stringify({ pools, channel }) === JSON.stringify(authored);
}

export function poolCoastPoint(pool: HabitatPool, angle: number, scale = 1): Point {
  const radius = poolRadius(angle) * scale;
  return {
    x: pool.x + Math.cos(angle) * pool.rx * radius,
    y: pool.y + Math.sin(angle) * pool.ry * radius,
  };
}

export function channelSegment(): {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  ux: number;
  uy: number;
  width: number;
} {
  const link = channel();
  return { ax: link.ax, ay: link.ay, bx: link.bx, by: link.by, ux: link.ux, uy: link.uy, width: HABITAT_CHANNEL.width };
}

export function mouthSegment(): {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  ux: number;
  uy: number;
  width: number;
} {
  const link = mouth();
  return { ax: link.ax, ay: link.ay, bx: link.bx, by: link.by, ux: link.ux, uy: link.uy, width: TIDE_MOUTH_WIDTH };
}

function ellipseSdf(x: number, y: number, pool: HabitatPool, margin: number): number {
  const rx = pool.rx - margin;
  const ry = pool.ry - margin;
  if (rx <= 0 || ry <= 0) return 1;
  const nx = (x - pool.x) / rx;
  const ny = (y - pool.y) / ry;
  const rho = Math.hypot(nx, ny);
  if (rho === 0) return -1;
  return rho - poolRadius(Math.atan2(ny, nx));
}

function distanceToSegment(x: number, y: number): number {
  const link = channel();
  const t = link.span === 0 ? 0 : clamp(((x - link.ax) * link.abx + (y - link.ay) * link.aby) / link.span, 0, 1);
  return Math.hypot(x - (link.ax + t * link.abx), y - (link.ay + t * link.aby));
}

function channelSdf(x: number, y: number, margin: number): number {
  const half = HABITAT_CHANNEL.width / 2 - margin;
  if (half <= 0) return 1;
  return distanceToSegment(x, y) - half;
}

function distanceToMouth(x: number, y: number): number {
  const link = mouth();
  const t = link.span === 0 ? 0 : clamp(((x - link.ax) * link.abx + (y - link.ay) * link.aby) / link.span, 0, 1);
  return Math.hypot(x - (link.ax + t * link.abx), y - (link.ay + t * link.aby));
}

function mouthSdf(x: number, y: number, margin: number): number {
  const half = TIDE_MOUTH_WIDTH / 2 - margin;
  if (half <= 0) return 1;
  return distanceToMouth(x, y) - half;
}

function inEllipse(x: number, y: number, pool: HabitatPool, margin: number): boolean {
  const rx = pool.rx - margin;
  const ry = pool.ry - margin;
  if (rx <= 0 || ry <= 0) return false;
  if (Math.abs(x - pool.x) > rx * POOL_RADIUS_EXTENT || Math.abs(y - pool.y) > ry * POOL_RADIUS_EXTENT) return false;
  return ellipseSdf(x, y, pool, margin) <= 0;
}

function inChannel(x: number, y: number, margin: number): boolean {
  const half = HABITAT_CHANNEL.width / 2 - margin;
  if (half <= 0) return false;
  const link = channel();
  if (x < link.minX - half || x > link.maxX + half || y < link.minY - half || y > link.maxY + half) return false;
  return distanceToSegment(x, y) <= half;
}

function inMouth(x: number, y: number, margin: number): boolean {
  const half = TIDE_MOUTH_WIDTH / 2 - margin;
  if (half <= 0) return false;
  const link = mouth();
  if (x < link.minX - half || x > link.maxX + half || y < link.minY - half || y > link.maxY + half) return false;
  return distanceToMouth(x, y) <= half;
}

export function waterSdf(x: number, y: number, margin = 0): number {
  const shore = Math.min(
    ellipseSdf(x, y, OPENING_POOL, margin),
    ellipseSdf(x, y, INLET_POOL, margin),
    ellipseSdf(x, y, SEA_POOL, margin),
    channelSdf(x, y, margin),
  );
  return tideOpen ? Math.min(shore, mouthSdf(x, y, margin)) : shore;
}

export function isInPool(x: number, y: number, margin = 0): boolean {
  return (
    inOpeningPool(x, y, margin) ||
    inInletPool(x, y, margin) ||
    inChannel(x, y, margin) ||
    inSea(x, y, margin) ||
    (tideOpen && inMouth(x, y, margin))
  );
}

export function inOpeningPool(x: number, y: number, margin = 0): boolean {
  return inEllipse(x, y, OPENING_POOL, margin);
}

export function inInletPool(x: number, y: number, margin = 0): boolean {
  return inEllipse(x, y, INLET_POOL, margin);
}

export function inSea(x: number, y: number, margin = 0): boolean {
  return inEllipse(x, y, SEA_POOL, margin);
}

export function inTideMouth(x: number, y: number, margin = 0): boolean {
  return tideOpen && inMouth(x, y, margin);
}

export function containingPool(x: number, y: number, margin = 0): HabitatPool | null {
  for (const pool of WATER_BASINS) {
    if (inEllipse(x, y, pool, margin)) return pool;
  }
  return null;
}

export type TideRegion = 'pool' | 'sea' | 'mouth' | 'land';

export function tideRegion(x: number, y: number, margin = 0): TideRegion {
  if (inSea(x, y, margin)) return 'sea';
  if (inOpeningPool(x, y, margin) || inInletPool(x, y, margin) || inChannel(x, y, margin)) return 'pool';
  if (tideOpen && inMouth(x, y, margin)) return 'mouth';
  return 'land';
}

export function shoreRho(x: number, y: number, pool: HabitatPool): number {
  const nx = (x - pool.x) / pool.rx;
  const ny = (y - pool.y) / pool.ry;
  const rho = Math.hypot(nx, ny);
  if (rho === 0) return 0;
  return rho / poolRadius(Math.atan2(ny, nx));
}

function confineToEllipse(point: Point, pool: HabitatPool, margin: number): void {
  const rx = pool.rx - margin;
  const ry = pool.ry - margin;
  if (rx <= 0 || ry <= 0) return;
  const nx = (point.x - pool.x) / rx;
  const ny = (point.y - pool.y) / ry;
  const rho = Math.hypot(nx, ny);
  if (rho === 0) return;
  const scale = (poolRadius(Math.atan2(ny, nx)) * 0.998) / rho;
  point.x = pool.x + nx * scale * rx;
  point.y = pool.y + ny * scale * ry;
}

function confineToMouth(point: Point, margin: number): void {
  const half = TIDE_MOUTH_WIDTH / 2 - margin;
  if (half <= 0) return;
  const link = mouth();
  const t =
    link.span === 0 ? 0 : clamp(((point.x - link.ax) * link.abx + (point.y - link.ay) * link.aby) / link.span, 0, 1);
  const cx = link.ax + t * link.abx;
  const cy = link.ay + t * link.aby;
  const dx = point.x - cx;
  const dy = point.y - cy;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) {
    point.x = cx - link.uy * half * 0.998;
    point.y = cy + link.ux * half * 0.998;
    return;
  }
  const scale = (half * 0.998) / distance;
  point.x = cx + dx * scale;
  point.y = cy + dy * scale;
}

function confineToChannel(point: Point, margin: number): void {
  const half = HABITAT_CHANNEL.width / 2 - margin;
  if (half <= 0) return;
  const link = channel();
  const t =
    link.span === 0 ? 0 : clamp(((point.x - link.ax) * link.abx + (point.y - link.ay) * link.aby) / link.span, 0, 1);
  const cx = link.ax + t * link.abx;
  const cy = link.ay + t * link.aby;
  const dx = point.x - cx;
  const dy = point.y - cy;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) {
    point.x = cx - link.uy * half * 0.998;
    point.y = cy + link.ux * half * 0.998;
    return;
  }
  const scale = (half * 0.998) / distance;
  point.x = cx + dx * scale;
  point.y = cy + dy * scale;
}

export function confineToWater(point: Point, margin: number): void {
  if (isInPool(point.x, point.y, margin)) return;
  let bestX = point.x;
  let bestY = point.y;
  let best = Infinity;
  for (const pool of WATER_BASINS) {
    const candidate = { x: point.x, y: point.y };
    confineToEllipse(candidate, pool, margin);
    const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
    if (distance < best) {
      best = distance;
      bestX = candidate.x;
      bestY = candidate.y;
    }
  }
  const channel = { x: point.x, y: point.y };
  confineToChannel(channel, margin);
  const distance = Math.hypot(channel.x - point.x, channel.y - point.y);
  if (distance < best) {
    best = distance;
    bestX = channel.x;
    bestY = channel.y;
  }
  if (tideOpen) {
    const gate = { x: point.x, y: point.y };
    confineToMouth(gate, margin);
    const mouthDistance = Math.hypot(gate.x - point.x, gate.y - point.y);
    if (mouthDistance < best) {
      bestX = gate.x;
      bestY = gate.y;
    }
  }
  point.x = bestX;
  point.y = bestY;
}

let flowElapsed = NaN;
let flowValue = 0;

export function channelFlowAt(elapsed: number): number {
  if (elapsed !== flowElapsed) {
    flowElapsed = elapsed;
    flowValue = Math.sin((elapsed / CHANNEL_PERIOD) * Math.PI * 2) * HABITAT_CHANNEL.flow * channelScaleAt(elapsed);
  }
  return flowValue;
}

export function tideVelocity(body: Point, elapsed: number, scale: number, out?: Point): Point {
  const result = out ?? { x: 0, y: 0 };
  const flow = tideFlowAt(elapsed);
  if (flow === 0) {
    result.x = 0;
    result.y = 0;
    return result;
  }
  const link = mouth();
  const reach = TIDE_MOUTH_WIDTH / 2 + TIDE_INFLUENCE;
  if (
    body.x < link.minX - reach ||
    body.x > link.maxX + reach ||
    body.y < link.minY - reach ||
    body.y > link.maxY + reach
  ) {
    result.x = 0;
    result.y = 0;
    return result;
  }
  const sdf = distanceToMouth(body.x, body.y) - TIDE_MOUTH_WIDTH / 2;
  if (sdf > TIDE_INFLUENCE) {
    result.x = 0;
    result.y = 0;
    return result;
  }
  const strength = sdf <= 0 ? 1 : 1 - sdf / TIDE_INFLUENCE;
  const speed = flow * strength * scale;
  result.x = link.ux * speed;
  result.y = link.uy * speed;
  return result;
}

export function channelVelocity(body: Point, elapsed: number, scale: number, out?: Point): Point {
  const result = out ?? { x: 0, y: 0 };
  const link = channel();
  const reach = HABITAT_CHANNEL.width / 2 + CHANNEL_INFLUENCE;
  if (
    body.x < link.minX - reach ||
    body.x > link.maxX + reach ||
    body.y < link.minY - reach ||
    body.y > link.maxY + reach
  ) {
    result.x = 0;
    result.y = 0;
    return result;
  }
  const flow = channelFlowAt(elapsed);
  if (flow === 0) {
    result.x = 0;
    result.y = 0;
    return result;
  }
  const sdf = distanceToSegment(body.x, body.y) - HABITAT_CHANNEL.width / 2;
  if (sdf > CHANNEL_INFLUENCE) {
    result.x = 0;
    result.y = 0;
    return result;
  }
  const strength = sdf <= 0 ? 1 : 1 - sdf / CHANNEL_INFLUENCE;
  const speed = flow * strength * scale;
  result.x = link.ux * speed;
  result.y = link.uy * speed;
  return result;
}
