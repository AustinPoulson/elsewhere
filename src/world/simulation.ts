import {
  FIXED_STEP, GRAZER_CAPACITY, LIMITS, NEST_CAPACITY, WORLD_HEIGHT, WORLD_WIDTH, isInPool, poolRadius,
  type Grazer, type LightSource, type Organism, type Point, type Sediment, type World, type WorldStats,
} from './types';

const TAU = Math.PI * 2;
const ENERGY_FLOOR = 0.12;
const LIGHT_ENERGY = 90;
const SPRINGS = [
  { x: 470, y: 390 }, { x: 825, y: 285 }, { x: 1040, y: 610 }, { x: 660, y: 730 },
];

// The PRNG state belongs to the world, so a saved pool resumes exactly.
function random(world: World): number {
  world.randomState = (world.randomState + 0x6d2b79f5) >>> 0;
  let value = world.randomState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function inPoolPoint(world: World, margin = 18): Point {
  const angle = random(world) * TAU;
  const radius = Math.sqrt(random(world)) * poolRadius(angle) * 0.94;
  return {
    x: WORLD_WIDTH / 2 + Math.cos(angle) * radius * (610 - margin),
    y: WORLD_HEIGHT / 2 + Math.sin(angle) * radius * (400 - margin),
  };
}

function confinePoint(point: Point, margin: number): Point {
  if (isInPool(point.x, point.y, margin)) return point;
  const nx = (point.x - WORLD_WIDTH / 2) / (610 - margin);
  const ny = (point.y - WORLD_HEIGHT / 2) / (400 - margin);
  const angle = Math.atan2(ny, nx);
  const scale = poolRadius(angle) * 0.998 / Math.hypot(nx, ny);
  return {
    x: WORLD_WIDTH / 2 + nx * scale * (610 - margin),
    y: WORLD_HEIGHT / 2 + ny * scale * (400 - margin),
  };
}

// Independent of the shared PRNG: migration leaves the existing ecology intact.
export function initializeGrazers(world: World): void {
  if (world.grazers.length > 0 || world.nests.length > 0) return;
  const seedOffset = (world.seed % 997) / 997 * 0.38;
  const nestAngles = [2.8, 4.5, -0.4, 1.2];
  for (let i = 0; i < 4; i++) {
    const spring = SPRINGS[i];
    const angle = nestAngles[i] + seedOffset;
    const size = 7.5 + ((world.seed >>> (i * 4)) & 15) / 10;
    const nest = {
      id: world.nextId++,
      ...confinePoint({ x: spring.x + Math.cos(angle) * 92, y: spring.y + Math.sin(angle) * 92 }, 18),
      hue: 38 + i * 4, pigment: 0, age: 0,
    };
    const point = confinePoint({
      x: spring.x + Math.cos(angle + Math.PI / 2) * 24,
      y: spring.y + Math.sin(angle + Math.PI / 2) * 24,
    }, size + 3);
    world.nests.push(nest);
    world.grazers.push({
      id: world.nextId++, species: 'grazer', ...point,
      vx: Math.cos(angle) * 9, vy: Math.sin(angle) * 9,
      size, age: 0, phase: (angle + TAU) % TAU,
      hue: nest.hue, cargo: 0, nestId: nest.id, returning: false,
    });
  }
}

function appendSediment(world: World, point: Point, hue: number, strength: number, radius: number): void {
  if (!isInPool(point.x, point.y)) return;
  if (world.sediment.length >= LIMITS.sediment) world.sediment.shift();
  world.sediment.push({ id: world.nextId++, ...point, radius, hue, strength, age: 0 });
}

export function addLight(world: World, x: number, y: number): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !isInPool(x, y)) return false;
  if (world.lights.length >= LIMITS.lights) return false;
  world.lights.push({ id: world.nextId++, x, y, energy: LIGHT_ENERGY, initialEnergy: LIGHT_ENERGY, age: 0 });
  return true;
}

export function createWorld(seed = 20261006): World {
  if (!Number.isFinite(seed)) throw new RangeError('World seed must be finite.');
  const normalizedSeed = Math.trunc(seed) >>> 0;
  const world: World = {
    version: 2, seed: normalizedSeed, randomState: normalizedSeed, elapsed: 0, tick: 0,
    nextId: 1, organisms: [], lights: [], sediment: [], grazers: [], nests: [], consumed: 0,
  };
  const springs = SPRINGS;
  for (const spring of springs) addLight(world, spring.x, spring.y);

  const hues = [172, 188, 214, 284, 328, 42];
  for (let i = 0; i < 24; i++) {
    const spring = springs[i % springs.length];
    const angle = random(world) * TAU;
    const radius = 50 + random(world) * 140;
    let point = { x: spring.x + Math.cos(angle) * radius, y: spring.y + Math.sin(angle) * radius };
    if (i >= 16 || !isInPool(point.x, point.y, 24)) point = inPoolPoint(world, 24);
    const heading = random(world) * TAU;
    const size = 5 + random(world) * 4;
    const organism: Organism = {
      id: world.nextId++, species: 'lucent', ...point,
      vx: Math.cos(heading) * 27, vy: Math.sin(heading) * 27,
      energy: 0.7 + random(world) * 0.7, age: 0, hue: hues[i % hues.length], size,
      phase: random(world) * TAU, trail: [],
    };
    // A short initial wake makes the first frame feel inhabited.
    for (let j = 6; j >= 0; j--) {
      const wake = { x: point.x - Math.cos(heading) * j * 3, y: point.y - Math.sin(heading) * j * 3 };
      if (isInPool(wake.x, wake.y)) organism.trail.push(wake);
    }
    world.organisms.push(organism);
  }

  // Sparse pigment around the springs gives the new pool an existing history.
  for (let i = 0; i < 48; i++) {
    const spring = springs[i % springs.length];
    const angle = random(world) * TAU;
    const radius = 26 + Math.sqrt(random(world)) * 100;
    appendSediment(world, {
      x: spring.x + Math.cos(angle) * radius,
      y: spring.y + Math.sin(angle) * radius * 0.58,
    }, hues[i % hues.length], 0.12 + random(world) * 0.18, 3 + random(world) * 5);
  }
  initializeGrazers(world);
  return world;
}

function targetLight(organism: Organism, lights: LightSource[]): LightSource | undefined {
  let target: LightSource | undefined;
  let best = 0;
  for (const light of lights) {
    if (light.energy <= 0) continue;
    const distance = Math.hypot(light.x - organism.x, light.y - organism.y);
    if (distance > 440) continue;
    // Nearby light dominates, while a nearly spent source loses its attraction.
    const score = Math.sqrt(light.energy / light.initialEnergy) / (35 + distance);
    if (score > best) { best = score; target = light; }
  }
  return target;
}

function boundaryValue(x: number, y: number, margin: number): number {
  const nx = (x - WORLD_WIDTH / 2) / (610 - margin);
  const ny = (y - WORLD_HEIGHT / 2) / (400 - margin);
  return Math.hypot(nx, ny) - poolRadius(Math.atan2(ny, nx));
}

function moveInPool(organism: Organism | Grazer, dt: number): void {
  const margin = organism.size + 3;
  const nextX = organism.x + organism.vx * dt;
  const nextY = organism.y + organism.vy * dt;
  if (isInPool(nextX, nextY, margin)) {
    organism.x = nextX;
    organism.y = nextY;
    return;
  }

  // Project against the same scalloped coast used by rendering and hit testing.
  const point = confinePoint({ x: nextX, y: nextY }, margin);
  organism.x = point.x;
  organism.y = point.y;

  const epsilon = 0.2;
  const normalX = boundaryValue(organism.x + epsilon, organism.y, margin) - boundaryValue(organism.x - epsilon, organism.y, margin);
  const normalY = boundaryValue(organism.x, organism.y + epsilon, margin) - boundaryValue(organism.x, organism.y - epsilon, margin);
  const length = Math.hypot(normalX, normalY);
  const ux = normalX / length;
  const uy = normalY / length;
  const outward = organism.vx * ux + organism.vy * uy;
  if (outward > 0) {
    organism.vx -= 2 * outward * ux;
    organism.vy -= 2 * outward * uy;
  }
}

function updateLucent(world: World, organism: Organism, dt: number): void {
  organism.age += dt;
  organism.phase = (organism.phase + dt * 0.42) % TAU;
  organism.energy = Math.max(ENERGY_FLOOR, organism.energy - dt * 0.008);
  const target = targetLight(organism, world.lights);
  const speed = 18 + organism.energy * 15;
  let desiredX: number;
  let desiredY: number;
  if (target) {
    const dx = target.x - organism.x;
    const dy = target.y - organism.y;
    const distance = Math.hypot(dx, dy);
    const ux = distance > 0.001 ? dx / distance : Math.cos(organism.phase);
    const uy = distance > 0.001 ? dy / distance : Math.sin(organism.phase);
    const orbit = distance < 75 ? 0.8 : 0.12;
    const approach = distance < 75 ? clamp((distance - 42) / 42, -0.6, 1) : 1;
    desiredX = (ux * approach - uy * orbit) * speed;
    desiredY = (uy * approach + ux * orbit) * speed;

    if (distance < 64) {
      const eaten = Math.min(target.energy, dt * (0.7 + Math.max(0, 1.2 - organism.energy) * 0.45));
      target.energy -= eaten;
      world.consumed += eaten;
      organism.energy = Math.min(2, organism.energy + eaten * 0.065);
      if (eaten > 0 && (world.tick + organism.id) % 36 === 0) {
        appendSediment(world, {
          x: organism.x + (random(world) - 0.5) * 7,
          y: organism.y + (random(world) - 0.5) * 7,
        }, organism.hue, 0.28 + random(world) * 0.28, 3 + random(world) * 5);
      }
    }
  } else {
    const heading = Math.atan2(organism.vy, organism.vx) + Math.sin(organism.phase) * dt * 0.9;
    desiredX = Math.cos(heading) * speed;
    desiredY = Math.sin(heading) * speed;
  }
  const turn = 1 - Math.exp(-dt * (target ? 2.3 : 0.8));
  organism.vx += (desiredX - organism.vx) * turn;
  organism.vy += (desiredY - organism.vy) * turn;
  moveInPool(organism, dt);
  if (world.tick % 3 === 0) {
    if (organism.trail.length >= LIMITS.trail) organism.trail.shift();
    organism.trail.push({ x: organism.x, y: organism.y });
  }
}

function blendHue(a: number, b: number, amountA: number, amountB: number): number {
  if (amountA <= 0) return b;
  const radians = Math.PI / 180;
  const x = Math.cos(a * radians) * amountA + Math.cos(b * radians) * amountB;
  const y = Math.sin(a * radians) * amountA + Math.sin(b * radians) * amountB;
  if (Math.hypot(x, y) < 1e-9) return b;
  return (Math.atan2(y, x) / radians + 360) % 360;
}

function targetSediment(grazer: Grazer, deposits: Sediment[]): Sediment | undefined {
  let target: Sediment | undefined;
  let best = 0;
  for (const deposit of deposits) {
    if (deposit.strength <= 0.025) continue;
    const distance = Math.hypot(deposit.x - grazer.x, deposit.y - grazer.y);
    if (distance > 260) continue;
    const score = Math.sqrt(deposit.strength) / (18 + distance);
    if (score > best) { best = score; target = deposit; }
  }
  return target;
}

function updateGrazer(world: World, grazer: Grazer, dt: number): void {
  grazer.age += dt;
  grazer.phase = (grazer.phase + dt * 2.1) % TAU;
  const nest = world.nests.find((entry) => entry.id === grazer.nestId);
  if (!nest) throw new Error(`Grazer ${grazer.id} has no nest.`);
  const food = grazer.returning ? undefined : targetSediment(grazer, world.sediment);
  if (grazer.cargo >= GRAZER_CAPACITY - 1e-9 || (!food && grazer.cargo > 0)) grazer.returning = true;

  let target: Point;
  let speed: number;
  if (grazer.returning) {
    target = nest;
    speed = 16;
    if (Math.hypot(nest.x - grazer.x, nest.y - grazer.y) < 18) {
      // A full nest keeps the remaining cargo; pigment is never conjured or dropped.
      const delivered = Math.min(grazer.cargo, Math.max(0, NEST_CAPACITY - nest.pigment));
      if (delivered > 0) {
        nest.hue = blendHue(nest.hue, grazer.hue, nest.pigment, delivered);
        nest.pigment = Math.min(NEST_CAPACITY, nest.pigment + delivered);
        grazer.cargo = Math.max(0, grazer.cargo - delivered);
      }
      if (grazer.cargo <= 1e-9) { grazer.cargo = 0; grazer.returning = false; }
      speed = 0;
    }
  } else if (food) {
    target = food;
    speed = 12.5;
    if (Math.hypot(food.x - grazer.x, food.y - grazer.y) < grazer.size + food.radius + 5) {
      const gathered = Math.min(food.strength, GRAZER_CAPACITY - grazer.cargo, dt * 0.38);
      if (gathered > 0) {
        grazer.hue = blendHue(grazer.hue, food.hue, grazer.cargo, gathered);
        grazer.cargo = Math.min(GRAZER_CAPACITY, grazer.cargo + gathered);
        food.strength = Math.max(0, food.strength - gathered);
      }
      if (grazer.cargo >= GRAZER_CAPACITY - 1e-9) grazer.returning = true;
    }
  } else {
    // Without food, slowly patrol the nest instead of vanishing or freezing.
    target = confinePoint({ x: nest.x + Math.cos(grazer.phase) * 34, y: nest.y + Math.sin(grazer.phase) * 24 }, grazer.size + 3);
    speed = 8;
  }

  const dx = target.x - grazer.x;
  const dy = target.y - grazer.y;
  const distance = Math.hypot(dx, dy);
  const approach = Math.min(1, distance / 18);
  const desiredX = distance > 0.001 ? dx / distance * speed * approach : 0;
  const desiredY = distance > 0.001 ? dy / distance * speed * approach : 0;
  const turn = 1 - Math.exp(-dt * 4);
  grazer.vx += (desiredX - grazer.vx) * turn;
  grazer.vy += (desiredY - grazer.vy) * turn;
  moveInPool(grazer, dt);
}

export function stepWorld(world: World, dt = FIXED_STEP): void {
  if (!Number.isFinite(dt) || dt <= 0 || dt > 0.25) {
    throw new RangeError('Simulation step must be finite, positive, and at most 0.25 seconds.');
  }
  world.elapsed += dt;
  world.tick++;
  for (const organism of world.organisms) updateLucent(world, organism, dt);
  for (const grazer of world.grazers) updateGrazer(world, grazer, dt);
  for (const light of world.lights) {
    light.age += dt;
    light.energy = Math.max(0, light.energy - dt * 0.045);
  }
  world.lights = world.lights.filter((light) => light.energy > 0.01);
  const fade = Math.exp(-dt * 0.0013);
  for (const sediment of world.sediment) {
    sediment.age += dt;
    sediment.strength *= fade;
  }
  world.sediment = world.sediment.filter((sediment) => sediment.strength > 0.025);
  const nestFade = Math.exp(-dt * 0.00045);
  for (const nest of world.nests) {
    nest.age += dt;
    nest.pigment *= nestFade;
  }
}

export function getStats(world: World): WorldStats {
  return {
    population: world.organisms.length,
    light: world.lights.reduce((total, light) => total + light.energy, 0),
    pigment: world.sediment.reduce((total, sediment) => total + sediment.strength, 0),
    elapsed: world.elapsed,
    consumed: world.consumed,
    grazers: world.grazers.length,
    nestPigment: world.nests.reduce((total, nest) => total + nest.pigment, 0),
  };
}
