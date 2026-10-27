import type { Point, Sediment } from '../types';

// A founding poll visits the sediment array once. Only the selected root's
// nearby buckets are examined for payment after that global pass.
export class AdmissionSources {
  private readonly cells = new Map<string, Sediment[]>();

  add(grain: Sediment): void {
    if (grain.strength <= 0) return;
    const key = this.key(Math.floor(grain.x / 32), Math.floor(grain.y / 32));
    const cell = this.cells.get(key);
    if (cell) cell.push(grain);
    else this.cells.set(key, [grain]);
  }

  within(point: Point, radius: number): Sediment[] {
    const found: Sediment[] = [];
    const minX = Math.floor((point.x - radius) / 32);
    const maxX = Math.floor((point.x + radius) / 32);
    const minY = Math.floor((point.y - radius) / 32);
    const maxY = Math.floor((point.y + radius) / 32);
    for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) {
      for (const grain of this.cells.get(this.key(x, y)) ?? []) {
        if (Math.hypot(grain.x - point.x, grain.y - point.y) <= radius) found.push(grain);
      }
    }
    return found;
  }

  private key(x: number, y: number): string { return `${x}:${y}`; }
}
