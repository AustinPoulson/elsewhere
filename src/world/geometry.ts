import { confineToWater, isInPool } from './habitat';
import type { Point } from './types';

export function confinePosition(point: Point, margin: number): void {
  if (isInPool(point.x, point.y, margin)) return;
  confineToWater(point, margin);
}
