import { LIMITS, type Point, type Sediment, type World } from '../types';

export function safeId(world: World): boolean {
  return Number.isSafeInteger(world.nextId) && world.nextId > 0 && world.nextId < Number.MAX_SAFE_INTEGER;
}

export function blendHue(a: number, b: number, amountA: number, amountB: number): number {
  if (amountA <= 0) return b;
  const radians = Math.PI / 180;
  const x = Math.cos(a * radians) * amountA + Math.cos(b * radians) * amountB;
  const y = Math.sin(a * radians) * amountA + Math.sin(b * radians) * amountB;
  return Math.hypot(x, y) < 1e-9 ? b : (Math.atan2(y, x) / radians + 360) % 360;
}

// A death never evicts existing pigment. At most one grain is created or topped
// up; the named mineralization sink accounts for every unplaced remainder.
export function returnPigment(world: World, point: Point, hue: number, pigment: number): void {
  let amount = pigment;
  if (amount > 0 && world.sediment.length < LIMITS.sediment && safeId(world)) {
    const returned = Math.min(1, amount);
    world.sediment.push({ id: world.nextId++, x: point.x, y: point.y, radius: 6, hue, strength: returned, age: 0 });
    amount -= returned;
  } else if (amount > 0) {
    let nearest: Sediment | undefined;
    let distance = Infinity;
    for (const grain of world.sediment) {
      if (grain.strength >= 1) continue;
      const candidate = Math.hypot(grain.x - point.x, grain.y - point.y);
      if (candidate < distance || (candidate === distance && (!nearest || grain.id < nearest.id))) {
        nearest = grain;
        distance = candidate;
      }
    }
    if (nearest) {
      const returned = Math.min(amount, 1 - nearest.strength);
      nearest.hue = blendHue(nearest.hue, hue, nearest.strength, returned);
      nearest.strength += returned;
      amount -= returned;
    }
  }
  world.ecologyLedger.mineralizedPigment += amount;
}
