import { moveLight, nearestLiveLight } from '../world/actions/light';
import type { Point, World } from '../world/types';

export interface CarryState extends Point {
  sourceId: number;
  input: 'pointer' | 'keyboard';
}

/** A gesture is ephemeral: saving or cancelling never moves the source. */
export class CarryController {
  private origin: World | null = null;
  private gesture: CarryState | null = null;

  get state(): CarryState | null {
    return this.gesture ? { ...this.gesture } : null;
  }

  begin(world: World, x: number, y: number, input: CarryState['input'] = 'pointer'): boolean {
    this.cancel();
    const source = nearestLiveLight(world, x, y);
    if (!source) return false;
    this.origin = world;
    this.gesture = { sourceId: source.id, x: source.x, y: source.y, input };
    return true;
  }

  update(x: number, y: number): void {
    if (this.gesture && Number.isFinite(x) && Number.isFinite(y)) {
      this.gesture.x = x;
      this.gesture.y = y;
    }
  }

  nudge(dx: number, dy: number): void {
    if (this.gesture) this.update(this.gesture.x + dx, this.gesture.y + dy);
  }

  commit(world: World): boolean {
    const gesture = this.gesture;
    const origin = this.origin;
    this.cancel();
    return !!gesture && origin === world && moveLight(world, gesture.sourceId, gesture.x, gesture.y);
  }

  cancel(): void {
    this.origin = null;
    this.gesture = null;
  }
}
