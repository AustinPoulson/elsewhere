import { confinePosition } from './geometry';
import { CURRENT_SPEED, MAX_CURRENT_SPEED, SEDIMENT_DRIFT, currentStrength } from './actions/current';
import type { Point, World } from './types';

function drift(world: World, body: Point, dt: number, scale: number, margin: number): void {
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
  if (magnitude === 0) return;
  const bounded = Math.min(1, MAX_CURRENT_SPEED / magnitude) * dt * scale;
  body.x += vx * bounded;
  body.y += vy * bounded;
  confinePosition(body, margin);
}

export function applyCurrentDrift(world: World, dt: number): void {
  let write = 0;
  for (const current of world.currents) if (currentStrength(current, world.elapsed) > 0) world.currents[write++] = current;
  world.currents.length = write;
  if (write === 0) return;
  for (const body of world.organisms) drift(world, body, dt, 1, body.size + 3);
  for (const body of world.grazers) drift(world, body, dt, 1, body.size + 3);
  for (const body of world.sediment) drift(world, body, dt, SEDIMENT_DRIFT, 0);
}
