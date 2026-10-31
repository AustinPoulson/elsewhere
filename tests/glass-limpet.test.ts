import { describe, expect, it } from 'vitest';
import { applyCurrent } from '../src/world/actions/current';
import { sedimentCurrentVelocity } from '../src/world/currents';
import { createWorld } from '../src/world/simulation';
import { admitGlassLimpet, updateGlassLimpets } from '../src/world/species/glass-limpet';
import { activeNewTypePopulation, SPECIES_CATALOG } from '../src/world/species/catalog';
import { LIMITS, type GlassLimpet, type World } from '../src/world/types';

function habitat(): World {
  const world = createWorld(0);
  world.elapsed = 40;
  world.tick = 1200;
  world.organisms = [];
  world.grazers = [];
  world.nests = [];
  world.lights = [];
  world.sediment = [];
  world.skimmers = [];
  world.reedwells = [];
  world.rainbells = [];
  world.siltstitchers = [];
  world.glassLimpets = [];
  world.currents = [];
  world.glassLimpetAdmissionAt = 0;
  world.glassLimpetCandidateAfterId = 0;
  return world;
}

function grain(world: World, x = 1200, y = 500, strength = 0.3, hue = 180) {
  const entry = { id: world.nextId++, x, y, strength, hue, radius: 6, age: 0 };
  world.sediment.push(entry);
  return entry;
}

function born(): { world: World; limpet: GlassLimpet } {
  const world = habitat();
  grain(world);
  expect(admitGlassLimpet(world)).toBe(true);
  world.sediment = [];
  return { world, limpet: world.glassLimpets[0] };
}

function searchPhase(world: World, limpet: GlassLimpet) {
  world.tick = (6 - (limpet.id % 6)) % 6;
}

function pigment(world: World): number {
  return (
    world.sediment.reduce((sum, entry) => sum + entry.strength, 0) +
    world.glassLimpets.reduce((sum, entry) => sum + entry.body + entry.reserve + entry.cargo, 0)
  );
}

describe('glass limpet current capture', () => {
  it('keeps the type defined but absent in opening worlds and shares the active budget', () => {
    const world = createWorld(0);
    expect(world.glassLimpets).toEqual([]);
    expect(SPECIES_CATALOG.glassLimpet.cap).toBe(4);
    expect(activeNewTypePopulation(world)).toBe(0);
    const { limpet } = born();
    world.glassLimpets = [limpet];
    expect(activeNewTypePopulation(world)).toBe(1);
  });

  it('pays exactly .3 in distance/ID order into .2 body and .1 reserve without random draw', () => {
    const world = habitat();
    const anchor = grain(world, 1200, 500, 0.12, 359);
    const near = grain(world, 1210, 500, 0.12, 1);
    const far = grain(world, 1220, 500, 0.2, 120);
    const outside = grain(world, 1232.001, 500, 1);
    const random = world.randomState;
    const id = world.nextId;
    const before = pigment(world);
    expect(admitGlassLimpet(world)).toBe(true);
    expect(world.glassLimpets[0]).toMatchObject({
      x: 1200,
      y: 500,
      body: 0.2,
      reserve: 0.1,
      cargo: 0,
      age: 0,
      starvedFor: 0,
      targetSedimentId: null,
    });
    expect(anchor.strength).toBe(0);
    expect(near.strength).toBe(0);
    expect(far.strength).toBeCloseTo(0.14, 12);
    expect(outside.strength).toBe(1);
    expect(pigment(world)).toBeCloseTo(before, 12);
    expect(world.glassLimpetAdmissionAt).toBe(100);
    expect(world.nextId).toBe(id + 1);
    expect(world.randomState).toBe(random);
  });

  it('rotates one anchor per attempt past underfunded habitat without material, ID or PRNG debit', () => {
    const world = habitat();
    const first = grain(world, 1200, 500, 0.3 - Number.EPSILON);
    const second = grain(world, 1000, 750, 0.3);
    const id = world.nextId;
    const random = world.randomState;
    expect(admitGlassLimpet(world)).toBe(false);
    expect(world.glassLimpetCandidateAfterId).toBe(first.id);
    expect(first.strength).toBe(0.3 - Number.EPSILON);
    expect(world.nextId).toBe(id);
    expect(world.randomState).toBe(random);
    // The second anchor is a separately suited shore pocket.
    expect(admitGlassLimpet(world)).toBe(true);
    expect(world.glassLimpets[0].x).toBe(1000);
    expect(world.glassLimpetCandidateAfterId).toBe(second.id);
    expect(world.randomState).toBe(random);
  });

  it('chooses the same source ID after sediment array reorder and wraps after the saved cursor', () => {
    const base = habitat();
    const low = grain(base, 1200, 500, 0.3);
    const high = grain(base, 1000, 750, 0.3);
    const reordered = structuredClone(base);
    reordered.sediment.reverse();
    expect(admitGlassLimpet(base)).toBe(true);
    expect(admitGlassLimpet(reordered)).toBe(true);
    expect(base.glassLimpets[0].x).toBe(1200);
    expect(reordered.glassLimpets[0].x).toBe(1200);
    expect(base.glassLimpetCandidateAfterId).toBe(low.id);
    expect(reordered.glassLimpetCandidateAfterId).toBe(low.id);
    base.glassLimpetAdmissionAt = 0;
    reordered.glassLimpetAdmissionAt = 0;
    expect(admitGlassLimpet(base)).toBe(true);
    expect(admitGlassLimpet(reordered)).toBe(true);
    expect(base.glassLimpetCandidateAfterId).toBe(high.id);
    expect(reordered.glassLimpetCandidateAfterId).toBe(high.id);
    expect(base.glassLimpets[1].x).toBe(1000);
    expect(reordered.glassLimpets[1].x).toBe(1000);
  });

  it('refuses center, outer coast, close neighbor and full type/shared caps before payment', () => {
    for (const x of [720, 1370]) {
      const world = habitat();
      const source = grain(world, x, 500);
      const before = structuredClone(world);
      expect(admitGlassLimpet(world)).toBe(false);
      expect(source.strength).toBe(0.3);
      expect(world.nextId).toBe(before.nextId);
    }
    const { world, limpet } = born();
    limpet.x = 1200;
    limpet.y = 500;
    const close = grain(world, 1263.999, 500);
    world.glassLimpetAdmissionAt = 0;
    expect(admitGlassLimpet(world)).toBe(false);
    expect(close.strength).toBe(0.3);
    const full = habitat();
    const food = grain(full);
    full.glassLimpets = Array.from({ length: 4 }, (_, index) => ({
      ...limpet,
      id: full.nextId++,
      x: 400 + index * 100,
    }));
    expect(admitGlassLimpet(full)).toBe(false);
    expect(food.strength).toBe(0.3);
    full.glassLimpets = [];
    full.skimmers = Array.from({ length: 24 }, (_, index) => ({
      id: full.nextId++,
      species: 'skimmer' as const,
      x: 100 + index,
      y: 100,
      size: 8 as const,
      body: 0.2 as const,
      vx: 0,
      vy: 0,
      hue: 0,
      reserve: 0.4,
      age: 0,
      phase: 0,
      homeNestId: 1,
      targetSedimentId: null,
      starvedFor: 0,
      emissionNextAllowedAt: 0,
      lastEmissionAt: null,
    }));
    expect(admitGlassLimpet(full)).toBe(false);
    expect(food.strength).toBe(0.3);
  });

  it('uses exact sediment drift speed: flowing food is captured, calm food is untouched', () => {
    const { world, limpet } = born();
    const food = grain(world, 1190, 500, 0.6, 120);
    searchPhase(world, limpet);
    const calm = structuredClone(world);
    const calmLimpet = calm.glassLimpets[0];
    const calmFood = calm.sediment[0];
    updateGlassLimpets(calm, 0.25);
    expect(calmLimpet.targetSedimentId).toBeNull();
    expect(calmFood.strength).toBe(0.6);
    expect(calmLimpet.cargo).toBe(0);
    expect(applyCurrent(world, { x: 1160, y: 500 }, { x: 1220, y: 500 }).status).toBe('applied');
    const velocity = sedimentCurrentVelocity(world, food);
    expect(Math.hypot(velocity.x, velocity.y)).toBeGreaterThan(0.5);
    const before = pigment(world);
    updateGlassLimpets(world, 0.25);
    expect(limpet.targetSedimentId).toBe(food.id);
    expect(food.strength).toBeCloseTo(0.59, 12);
    expect(limpet.reserve).toBeCloseTo(0.10225, 12);
    expect(limpet.cargo).toBeCloseTo(0.0075, 12);
    expect(world.ecologyLedger.glassLimpetIntake).toBeCloseTo(0.01, 12);
    expect(world.ecologyLedger.glassLimpetMaintenancePigment).toBeCloseTo(0.00025, 12);
    expect(pigment(world)).toBeCloseTo(before - 0.00025, 12);
    expect(calm.glassLimpets[0].reserve).toBeCloseTo(0.09975, 12);
  });

  it('uses the shared combined-force clamp for sediment drift and feeding', () => {
    const world = habitat();
    const food = grain(world, 1190, 500, 0.6);
    world.currents = Array.from({ length: 3 }, () => ({
      id: world.nextId++,
      x: 1190,
      y: 500,
      dx: 1,
      dy: 0,
      startedAt: world.elapsed,
      duration: 8 as const,
      radius: 110 as const,
    }));
    const velocity = sedimentCurrentVelocity(world, food);
    expect(velocity.x).toBeCloseTo(16 * 0.35, 12);
    expect(velocity.y).toBe(0);
  });

  it('revalidates expired flow and stale target, and clips both stores before debit', () => {
    const { world, limpet } = born();
    const food = grain(world, 1190, 500, 0.6);
    expect(applyCurrent(world, { x: 1160, y: 500 }, { x: 1220, y: 500 }).status).toBe('applied');
    searchPhase(world, limpet);
    limpet.reserve = 0.199;
    limpet.cargo = 0.8;
    updateGlassLimpets(world, 0.25);
    expect(food.strength).toBe(0.6);
    expect(world.ecologyLedger.glassLimpetIntake).toBe(0);
    limpet.cargo = 0;
    limpet.reserve = 0.2;
    updateGlassLimpets(world, 0.25);
    expect(food.strength).toBe(0.6);
    limpet.targetSedimentId = food.id;
    food.x = 1222.001;
    updateGlassLimpets(world, 0.25);
    expect(limpet.targetSedimentId).toBeNull();
    expect(food.strength).toBe(0.6);
    food.x = 1190;
    food.strength = 0.119;
    limpet.targetSedimentId = food.id;
    updateGlassLimpets(world, 0.25);
    expect(limpet.targetSedimentId).toBeNull();
    expect(food.strength).toBe(0.119);
    food.strength = 0.6;
    limpet.targetSedimentId = food.id;
    world.currents[0].startedAt = world.elapsed - 8;
    updateGlassLimpets(world, 0.25);
    expect(limpet.targetSedimentId).toBeNull();
    expect(food.strength).toBe(0.6);
  });

  it('returns once at finite exit, fills a saturated floor only within capacity, then mineralizes remainder', () => {
    const { world, limpet } = born();
    limpet.age = 479.99;
    limpet.reserve = 0.1;
    limpet.cargo = 0.8;
    world.sediment = Array.from({ length: LIMITS.sediment }, (_, index) => ({
      id: world.nextId++,
      x: index === 0 ? 1200 : 200,
      y: index === 0 ? 500 : 200,
      radius: 6,
      hue: 100,
      strength: index === 0 ? 0.2 : 1,
      age: 0,
    }));
    const beforeId = world.nextId;
    updateGlassLimpets(world, 0.02);
    expect(world.glassLimpets).toHaveLength(0);
    expect(world.sediment).toHaveLength(LIMITS.sediment);
    expect(world.sediment[0].strength).toBe(1);
    expect(world.ecologyLedger.mineralizedPigment).toBeCloseTo(0.3, 12);
    expect(world.nextId).toBe(beforeId);
    updateGlassLimpets(world, 0.02);
    expect(world.ecologyLedger.mineralizedPigment).toBeCloseTo(0.3, 12);
  });
});
