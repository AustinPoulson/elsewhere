import { isInPool, poolRadius, WORLD_HEIGHT, WORLD_WIDTH, type Point } from './types';

// Project a moving body's position against the shared scalloped coast, without
// changing its own swimming velocity or allocating a point on every drift tick.
export function confinePosition(point: Point, margin: number): void {
  if (isInPool(point.x, point.y, margin)) return;
  const nx = (point.x - WORLD_WIDTH / 2) / (610 - margin);
  const ny = (point.y - WORLD_HEIGHT / 2) / (400 - margin);
  const scale = (poolRadius(Math.atan2(ny, nx)) * 0.998) / Math.hypot(nx, ny);
  point.x = WORLD_WIDTH / 2 + nx * scale * (610 - margin);
  point.y = WORLD_HEIGHT / 2 + ny * scale * (400 - margin);
}
