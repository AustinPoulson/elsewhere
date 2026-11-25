import { CURRENT_SPEED, MAX_CURRENT_SPEED, SEDIMENT_DRIFT, currentStrength } from './actions/current';
import { depthAt, settleVelocity, stillScale } from './environment/depth';
import { washShorePoint } from './environment/shore-wash';
import { confinePosition } from './geometry';
import { channelVelocity, inSea, pocketFlowAt, pocketVelocity, tideVelocity } from './habitat';
import {
  pocketLucentCount,
  seaGrainCount,
  seaLucentCount,
  POCKET_LUCENT_CAP,
  SEA_GRAINS,
  SEA_LUCENTS,
} from './environment/tide';
import { effectiveWeather } from './weather';
import type { Point, World } from './types';

const driftVelocity: Point = { x: 0, y: 0 };
const settleScratch: Point = { x: 0, y: 0 };
const tideScratch: Point = { x: 0, y: 0 };
const pocketScratch: Point = { x: 0, y: 0 };

function holdSeaWorker(world: World, body: Point, kind: 'lucent' | 'grazer' | 'grain'): boolean {
  if (pocketFlowAt(world.elapsed) >= 0) return false;
  if (!inSea(body.x, body.y)) return false;
  if (kind === 'grazer') return true;
  if (kind === 'lucent') return seaLucentCount(world) <= SEA_LUCENTS || pocketLucentCount(world) >= POCKET_LUCENT_CAP;
  return seaGrainCount(world) <= SEA_GRAINS;
}

function currentVelocity(world: World, body: Point, scale: number, out: Point, settle = false, hold = false): Point {
  let vx = 0;
  let vy = 0;
  for (const current of world.currents) {
    const distance = Math.hypot(body.x - current.x, body.y - current.y);
    if (distance >= current.radius) continue;
    const speed = CURRENT_SPEED * currentStrength(current, world.elapsed) * (1 - distance / current.radius);
    vx += current.dx * speed;
    vy += current.dy * speed;
  }
  const magnitude = Math.hypot(vx, vy);
  if (magnitude === 0) channelVelocity(body, world.elapsed, scale, out);
  else {
    const bounded = Math.min(1, MAX_CURRENT_SPEED / magnitude) * scale;
    channelVelocity(body, world.elapsed, scale, out);
    out.x += vx * bounded;
    out.y += vy * bounded;
  }
  tideVelocity(body, world.elapsed, scale, tideScratch);
  out.x += tideScratch.x;
  out.y += tideScratch.y;
  pocketVelocity(body, world.elapsed, scale, pocketScratch);
  if (!hold) {
    out.x += pocketScratch.x;
    out.y += pocketScratch.y;
  }
  const still = stillScale(depthAt(body.x, body.y));
  out.x *= still;
  out.y *= still;
  if (settle) {
    settleVelocity(body, settleScratch);
    out.x += settleScratch.x;
    out.y += settleScratch.y;
  }
  return out;
}

export function sedimentCurrentVelocity(world: World, grain: Point): Point {
  return currentVelocity(world, grain, SEDIMENT_DRIFT, { x: 0, y: 0 }, true, holdSeaWorker(world, grain, 'grain'));
}

function drift(
  world: World,
  body: Point,
  dt: number,
  scale: number,
  margin: number,
  settle = false,
  hold = false,
): void {
  const velocity = currentVelocity(world, body, scale, driftVelocity, settle, hold);
  if (velocity.x === 0 && velocity.y === 0) return;
  body.x += velocity.x * dt;
  body.y += velocity.y * dt;
  confinePosition(body, margin);
}

function inPaidCurrent(world: World, point: Point): boolean {
  for (const current of world.currents) {
    if (currentStrength(current, world.elapsed) <= 0) continue;
    if (Math.hypot(point.x - current.x, point.y - current.y) < current.radius) return true;
  }
  return false;
}

export function applyCurrentDrift(world: World, dt: number): void {
  let write = 0;
  for (const current of world.currents)
    if (currentStrength(current, world.elapsed) > 0) world.currents[write++] = current;
  world.currents.length = write;
  for (const body of world.organisms)
    drift(world, body, dt, 1, body.size + 3, false, holdSeaWorker(world, body, 'lucent'));
  for (const body of world.grazers)
    drift(world, body, dt, 1, body.size + 3, false, holdSeaWorker(world, body, 'grazer'));
  for (const body of world.skimmers) drift(world, body, dt, 1, body.size + 3);
  for (const body of world.siltstitchers) drift(world, body, dt, 1, 11);
  for (const body of world.cargoMites) if (body.mode === 'seeking') drift(world, body, dt, 1, 11);
  for (const body of world.marlgrubs) drift(world, body, dt, 1, 11);
  for (const body of world.sediment)
    drift(world, body, dt, SEDIMENT_DRIFT, 0, true, holdSeaWorker(world, body, 'grain'));
  if (world.remains.length > 0) for (const body of world.remains) drift(world, body, dt, SEDIMENT_DRIFT, 0, true);
  if (world.fossils.length > 0) for (const body of world.fossils) drift(world, body, dt, SEDIMENT_DRIFT, 0, true);
  const rain = effectiveWeather(world).intensity;
  if (rain > 0) {
    for (const body of world.sediment) if (!inPaidCurrent(world, body)) washShorePoint(body, dt, rain);
    if (world.remains.length > 0)
      for (const body of world.remains) if (!inPaidCurrent(world, body)) washShorePoint(body, dt, rain);
  }
}
