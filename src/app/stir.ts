import { applyCurrent } from '../world/actions/current';
import { isInPool } from '../world/types';
import type { Point, World } from '../world/types';

export interface StirState { start: Point; end: Point; input: 'pointer' | 'keyboard' }

/** A stroke owns no ecological state until committed in its original world. */
export class StirController {
  private origin: World | null = null;
  private gesture: StirState | null = null;
  get state(): StirState | null { return this.gesture; }
  begin(world: World, point: Point, input: StirState['input']): boolean {
    this.cancel();
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !isInPool(point.x, point.y)) return false;
    this.origin = world;
    this.gesture = { start: { ...point }, end: { ...point }, input };
    return true;
  }
  update(point: Point): void {
    if (this.gesture && Number.isFinite(point.x) && Number.isFinite(point.y)) {
      this.gesture.end.x = point.x; this.gesture.end.y = point.y;
    }
  }
  commit(world: World): ReturnType<typeof applyCurrent> {
    const gesture = this.gesture, origin = this.origin;
    this.cancel();
    return gesture && origin === world ? applyCurrent(world, gesture.start, gesture.end) : { status: 'invalid' };
  }
  cancel(): void { this.origin = null; this.gesture = null; }
}
