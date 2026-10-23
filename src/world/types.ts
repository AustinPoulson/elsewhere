export const WORLD_WIDTH = 1440;
export const WORLD_HEIGHT = 1000;
export const FIXED_STEP = 1 / 30;
export const LIMITS = { organisms: 42, lights: 32, sediment: 600, trail: 14, grazers: 8, nests: 16 } as const;
export const GRAZER_CAPACITY = 1.2;
export const NEST_CAPACITY = 12;

export interface Point { x: number; y: number }
export interface Current extends Point {
  id: number;
  dx: number;
  dy: number;
  startedAt: number;
  duration: 8;
  radius: 110;
}
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
  pigmentCredit: number;
}
export interface Skimmer extends Point {
  id: number;
  species: 'skimmer';
  size: 8;
  body: 0.2;
  vx: number;
  vy: number;
  hue: number;
  reserve: number;
  age: number;
  phase: number;
  homeNestId: number;
  targetSedimentId: number | null;
  starvedFor: number;
  emissionNextAllowedAt: number;
  lastEmissionAt: number | null;
}
export interface Reedwell extends Point {
  id: number;
  species: 'reedwell';
  body: 0.6;
  age: number;
  hue: number;
  lightStore: number;
  emissionNextAllowedAt: number;
  lastEmissionAt: number | null;
}
export interface Rainbell extends Point {
  id: number;
  species: 'rainbell';
  body: 0.2;
  age: number;
  hue: number;
  reserve: number;
  starvedFor: number;
  feedTargetSedimentId: number | null;
  pumpTargetSedimentId: number | null;
  pulseNextAllowedAt: number;
  lastPulseAt: number | null;
}
export interface Siltstitcher extends Point {
  id: number;
  species: 'siltstitcher';
  vx: number;
  vy: number;
  body: 0.2;
  reserve: number;
  cargo: number;
  age: number;
  hue: number;
  homeNestId: number;
  starvedFor: number;
  mode: 'home' | 'outbound' | 'blocked' | 'returning';
  destination: Point | null;
  blockedFor: number;
}
export interface EcologyLedger {
  mineralizedPigment: number;
  maintenancePigment: number;
  emittedLight: number;
  pigmentConverted: number;
  feedingCreditLost: number;
  daylightHarvested: number;
  daylightUnharvested: number;
  reedwellEmittedLight: number;
  reedwellDissipatedLight: number;
  rainbellIntake: number;
  rainbellPumpingPigment: number;
  rainbellMaintenancePigment: number;
  siltstitcherNestReserve: number;
  siltstitcherNestCargo: number;
  siltstitcherOutwardPigment: number;
  siltstitcherMaintenancePigment: number;
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
export interface Grazer extends Point {
  id: number;
  species: 'grazer';
  vx: number;
  vy: number;
  size: number;
  age: number;
  phase: number;
  hue: number;
  cargo: number;
  nestId: number;
  returning: boolean;
}
export interface Nest extends Point {
  id: number;
  hue: number;
  pigment: number;
  age: number;
}
export interface World {
  version: 3;
  schemaRevision: 6;
  skimmers: Skimmer[];
  skimmerAdmissionAt: number;
  reedwells: Reedwell[];
  reedwellAdmissionAt: number;
  reedwellCandidateAfterId: number;
  rainbells: Rainbell[];
  rainbellAdmissionAt: number;
  rainbellCandidateAfterId: number;
  siltstitchers: Siltstitcher[];
  siltstitcherAdmissionAt: number;
  siltstitcherCandidateAfterId: number;
  ecologyLedger: EcologyLedger;
  currents: Current[];
  weatherCall: { startedAt: number | null; nextAllowedAt: number };
  seed: number;
  randomState: number;
  elapsed: number;
  tick: number;
  nextId: number;
  organisms: Organism[];
  lights: LightSource[];
  sediment: Sediment[];
  grazers: Grazer[];
  nests: Nest[];
  consumed: number;
}
export type Tool = 'light' | 'observe' | 'carry' | 'stir';
export interface WorldStats {
  population: number;
  light: number;
  pigment: number;
  elapsed: number;
  consumed: number;
  grazers: number;
  skimmers: number;
  reedwells: number;
  rainbells: number;
  siltstitchers: number;
  nestPigment: number;
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
