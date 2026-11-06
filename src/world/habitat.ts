import { poolRadius, type HabitatChannel, type HabitatPool, type Point } from './types';

export const OPENING_POOL: HabitatPool = { id: 1, x: 720, y: 500, rx: 610, ry: 400 };
export const INLET_POOL: HabitatPool = { id: 2, x: 745, y: 1275, rx: 260, ry: 200 };
export const HABITAT_POOLS: readonly HabitatPool[] = [OPENING_POOL, INLET_POOL];
export const HABITAT_CHANNEL: HabitatChannel = { from: 1, to: 2, width: 72, flow: 4.8 };
export const CHANNEL_PERIOD = 180;
export const CHANNEL_INFLUENCE = 28;

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

function channelAxis(): { ax: number; ay: number; bx: number; by: number; ux: number; uy: number } {
  const dx = INLET_POOL.x - OPENING_POOL.x;
  const dy = INLET_POOL.y - OPENING_POOL.y;
  const length = Math.hypot(dx, dy);
  const ux = dx / length;
  const uy = dy / length;
  const start = rimPoint(OPENING_POOL, ux, uy);
  const end = rimPoint(INLET_POOL, -ux, -uy);
  return { ax: start.x, ay: start.y, bx: end.x, by: end.y, ux, uy };
}

let channelCache: ReturnType<typeof channelAxis> | null = null;
function channel(): ReturnType<typeof channelAxis> {
  if (!channelCache) channelCache = channelAxis();
  return channelCache;
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
  return { ...channel(), width: HABITAT_CHANNEL.width };
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

function distanceToSegment(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax;
  const aby = by - ay;
  const span = abx * abx + aby * aby;
  const t = span === 0 ? 0 : clamp(((x - ax) * abx + (y - ay) * aby) / span, 0, 1);
  return Math.hypot(x - (ax + t * abx), y - (ay + t * aby));
}

function channelSdf(x: number, y: number, margin: number): number {
  const half = HABITAT_CHANNEL.width / 2 - margin;
  if (half <= 0) return 1;
  const link = channel();
  return distanceToSegment(x, y, link.ax, link.ay, link.bx, link.by) - half;
}

export function waterSdf(x: number, y: number, margin = 0): number {
  return Math.min(
    ellipseSdf(x, y, OPENING_POOL, margin),
    ellipseSdf(x, y, INLET_POOL, margin),
    channelSdf(x, y, margin),
  );
}

export function isInPool(x: number, y: number, margin = 0): boolean {
  return waterSdf(x, y, margin) <= 0;
}

export function inOpeningPool(x: number, y: number, margin = 0): boolean {
  return ellipseSdf(x, y, OPENING_POOL, margin) <= 0;
}

export function inInletPool(x: number, y: number, margin = 0): boolean {
  return ellipseSdf(x, y, INLET_POOL, margin) <= 0;
}

export function containingPool(x: number, y: number, margin = 0): HabitatPool | null {
  for (const pool of HABITAT_POOLS) {
    if (ellipseSdf(x, y, pool, margin) <= 0) return pool;
  }
  return null;
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

function confineToChannel(point: Point, margin: number): void {
  const half = HABITAT_CHANNEL.width / 2 - margin;
  if (half <= 0) return;
  const link = channel();
  const abx = link.bx - link.ax;
  const aby = link.by - link.ay;
  const span = abx * abx + aby * aby;
  const t = span === 0 ? 0 : clamp(((point.x - link.ax) * abx + (point.y - link.ay) * aby) / span, 0, 1);
  const cx = link.ax + t * abx;
  const cy = link.ay + t * aby;
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
  for (const pool of HABITAT_POOLS) {
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
    bestX = channel.x;
    bestY = channel.y;
  }
  point.x = bestX;
  point.y = bestY;
}

export function channelFlowAt(elapsed: number): number {
  return Math.sin((elapsed / CHANNEL_PERIOD) * Math.PI * 2) * HABITAT_CHANNEL.flow;
}

export function channelVelocity(body: Point, elapsed: number, scale: number): Point {
  const sdf = channelSdf(body.x, body.y, 0);
  if (sdf > CHANNEL_INFLUENCE) return { x: 0, y: 0 };
  const strength = sdf <= 0 ? 1 : 1 - sdf / CHANNEL_INFLUENCE;
  const flow = channelFlowAt(elapsed) * strength * scale;
  const link = channel();
  return { x: link.ux * flow, y: link.uy * flow };
}
