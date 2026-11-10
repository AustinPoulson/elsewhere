import { CURRENT_SPEED, MAX_CURRENT_SPEED, SEDIMENT_DRIFT, currentStrength } from './actions/current';
import { depthAt, settleVelocity, stillScale } from './environment/depth';
import { confinePosition } from './geometry';
import { channelVelocity } from './habitat';
import type { Point, World } from './types';

const driftVelocity: Point = { x: 0, y: 0 };
const settleScratch: Point = { x: 0, y: 0 };

function currentVelocity(world: World, body: Point, scale: number, out: Point, settle = false): Point {
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
  return currentVelocity(world, grain, SEDIMENT_DRIFT, { x: 0, y: 0 }, true);
}

function drift(world: World, body: Point, dt: number, scale: number, margin: number, settle = false): void {
  const velocity = currentVelocity(world, body, scale, driftVelocity, settle);
  if (velocity.x === 0 && velocity.y === 0) return;
  body.x += velocity.x * dt;
  body.y += velocity.y * dt;
  confinePosition(body, margin);
}

export function applyCurrentDrift(world: World, dt: number): void {
  let write = 0;
  for (const current of world.currents)
    if (currentStrength(current, world.elapsed) > 0) world.currents[write++] = current;
  world.currents.length = write;
  for (const body of world.organisms) drift(world, body, dt, 1, body.size + 3);
  for (const body of world.grazers) drift(world, body, dt, 1, body.size + 3);
  for (const body of world.skimmers) drift(world, body, dt, 1, body.size + 3);
  for (const body of world.siltstitchers) drift(world, body, dt, 1, 11);
  for (const body of world.cargoMites) if (body.mode === 'seeking') drift(world, body, dt, 1, 11);
  for (const body of world.marlgrubs) drift(world, body, dt, 1, 11);
  for (const body of world.sediment) drift(world, body, dt, SEDIMENT_DRIFT, 0, true);
  if (world.remains.length > 0) for (const body of world.remains) drift(world, body, dt, SEDIMENT_DRIFT, 0, true);
  if (world.fossils.length > 0) for (const body of world.fossils) drift(world, body, dt, SEDIMENT_DRIFT, 0, true);
}
