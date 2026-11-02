export function nextRandom(world: { randomState: number }): number {
  world.randomState = (world.randomState + 0x6d2b79f5) >>> 0;
  let value = world.randomState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}
