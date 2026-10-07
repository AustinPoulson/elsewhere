export const WORLD_WIDTH = 1440;
export const WORLD_HEIGHT = 1000;
export const FIXED_STEP = 1 / 30;
export const LIMITS = { organisms: 42, lights: 32, sediment: 600, trail: 14 } as const;

export interface Point { x: number; y: number }
export interface Organism extends Point {
  id: number;
  species: 'lucent';
  vx: number;
  vy: number;
  energy: number;
  age: number;
  hue: number;
  size: number;
  phase: number;
  trail: Point[];
}
export interface LightSource extends Point {
  id: number;
  energy: number;
  initialEnergy: number;
  age: number;
}
export interface Sediment extends Point {
  id: number;
  radius: number;
  hue: number;
  strength: number;
  age: number;
}
export interface World {
  version: 1;
  seed: number;
  randomState: number;
  elapsed: number;
  tick: number;
  nextId: number;
  organisms: Organism[];
  lights: LightSource[];
  sediment: Sediment[];
  consumed: number;
}
export type Tool = 'light' | 'observe';
export interface WorldStats {
  population: number;
  light: number;
  pigment: number;
  elapsed: number;
  consumed: number;
}

// One shared coastline for simulation, rendering, and input hit testing.
export function poolRadius(angle: number): number {
  return 1 + 0.058 * Math.sin(angle * 3 + 0.7) + 0.032 * Math.cos(angle * 5 - 0.4) + 0.018 * Math.sin(angle * 9);
}
export function isInPool(x: number, y: number, margin = 0): boolean {
  const nx = (x - WORLD_WIDTH / 2) / (610 - margin);
  const ny = (y - WORLD_HEIGHT / 2) / (400 - margin);
  return Math.hypot(nx, ny) <= poolRadius(Math.atan2(ny, nx));
}
