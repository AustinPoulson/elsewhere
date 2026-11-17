import { describe, expect, it } from 'vitest';
import { applyCurrent } from '../src/world/actions/current';
import { sedimentCurrentVelocity } from '../src/world/currents';
import { createWorld } from '../src/world/simulation';
import {
  admitGlassLimpet,
  glassLimpetBirthStake,
  glassLimpetFeedReach,
  glassLimpetReserveCapacity,
  glassLimpetSurvivalFloor,
  updateGlassLimpets,
} from '../src/world/species/glass-limpet';
import { activeNewTypePopulation, SPECIES_CATALOG } from '../src/world/species/catalog';
import { baselineTraits, TRAIT_MAX, TRAIT_MIN } from '../src/world/traits';
import { LIMITS, type GlassLimpet, type World } from '../src/world/types';
import { DEATH_SEDIMENT_FRACTION } from '../src/world/species/remains';

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
      parentId: null,
      nextBirthAt: 70,
      traits: baselineTraits(),
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
      parentId: null,
      nextBirthAt: full.elapsed + 30,
      traits: baselineTraits(),
    }));
    expect(admitGlassLimpet(full)).toBe(false);
    expect(food.strength).toBe(0.3);
  });

  it('uses exact sediment drift speed: flowing food is captured, dry still food is untouched once the parent is stocked', () => {
    const { world, limpet } = born();
    world.elapsed = 10;
    limpet.reserve = glassLimpetBirthStake(limpet.traits);
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
    expect(limpet.reserve).toBeCloseTo(glassLimpetBirthStake(limpet.traits) + 0.00225, 12);
    expect(limpet.cargo).toBeCloseTo(0.0075, 12);
    expect(world.ecologyLedger.glassLimpetIntake).toBeCloseTo(0.01, 12);
    expect(world.ecologyLedger.glassLimpetMaintenancePigment).toBeCloseTo(0.00025, 12);
    expect(pigment(world)).toBeCloseTo(before - 0.00025, 12);
    expect(calm.glassLimpets[0].reserve).toBeCloseTo(glassLimpetBirthStake(limpet.traits) - 0.00025, 12);
  });

  it('banks still leftover grains into reserve while stocking for a child', () => {
    const { world, limpet } = born();
    world.elapsed = 10;
    const food = grain(world, 1190, 500, 0.6, 120);
    searchPhase(world, limpet);
    updateGlassLimpets(world, 0.25);
    expect(limpet.targetSedimentId).toBe(food.id);
    expect(food.strength).toBeCloseTo(0.59, 12);
    expect(limpet.reserve).toBeCloseTo(0.10975, 12);
    expect(limpet.cargo).toBe(0);
    expect(world.ecologyLedger.glassLimpetIntake).toBeCloseTo(0.01, 12);
  });

  it('filters still grains when rain washes them past a stocked shell', () => {
    const { world, limpet } = born();
    limpet.reserve = glassLimpetBirthStake(limpet.traits);
    const food = grain(world, 1190, 500, 0.6, 120);
    searchPhase(world, limpet);
    const before = pigment(world);
    updateGlassLimpets(world, 0.25);
    expect(limpet.targetSedimentId).toBe(food.id);
    expect(food.strength).toBeCloseTo(0.59, 12);
    expect(limpet.reserve).toBeCloseTo(glassLimpetBirthStake(limpet.traits) + 0.00225, 12);
    expect(limpet.cargo).toBeCloseTo(0.0075, 12);
    expect(world.ecologyLedger.glassLimpetIntake).toBeCloseTo(0.01, 12);
    expect(pigment(world)).toBeCloseTo(before - 0.00025, 12);
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
    world.elapsed = 10;
    const food = grain(world, 1190, 500, 0.6);
    expect(applyCurrent(world, { x: 1160, y: 500 }, { x: 1220, y: 500 }).status).toBe('applied');
    searchPhase(world, limpet);
    limpet.reserve = glassLimpetBirthStake(limpet.traits);
    limpet.cargo = 0.8;
    updateGlassLimpets(world, 0.25);
    expect(food.strength).toBe(0.6);
    expect(world.ecologyLedger.glassLimpetIntake).toBe(0);
    limpet.cargo = 0;
    limpet.reserve = glassLimpetReserveCapacity(limpet.traits);
    updateGlassLimpets(world, 0.25);
    expect(food.strength).toBe(0.6);
    limpet.targetSedimentId = food.id;
    food.x = limpet.x + glassLimpetFeedReach(limpet.traits) + 0.001;
    updateGlassLimpets(world, 0.25);
    expect(limpet.targetSedimentId).toBeNull();
    expect(food.strength).toBe(0.6);
    food.x = 1190;
    food.strength = 0.025;
    limpet.targetSedimentId = food.id;
    updateGlassLimpets(world, 0.25);
    expect(limpet.targetSedimentId).toBeNull();
    expect(food.strength).toBe(0.025);
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
    expect(world.sediment[0].strength).toBeCloseTo(Math.min(1, 0.2 + 1.1 * DEATH_SEDIMENT_FRACTION), 12);
    expect(world.remains[0].pigment).toBeCloseTo(1.1 * (1 - DEATH_SEDIMENT_FRACTION), 12);
    expect(world.ecologyLedger.mineralizedPigment).toBeCloseTo(Math.max(0, 1.1 * DEATH_SEDIMENT_FRACTION - 0.8), 12);
    expect(world.nextId).toBe(beforeId + 1);
    updateGlassLimpets(world, 0.02);
    expect(world.ecologyLedger.mineralizedPigment).toBeCloseTo(Math.max(0, 1.1 * DEATH_SEDIMENT_FRACTION - 0.8), 12);
  });
});

describe('glass limpet inheritance', () => {
  it('gives founders baseline traits and spends parent reserve for a mutated child', () => {
    const { world, limpet: parent } = born();
    const random = world.randomState;
    expect(parent.traits).toEqual(baselineTraits());
    expect(parent.parentId).toBeNull();
    expect(parent.reserve).toBeLessThan(glassLimpetBirthStake(parent.traits));
    parent.age = 29.9;
    parent.reserve = 0.4;
    parent.targetSedimentId = null;
    parent.nextBirthAt = 30;
    world.elapsed = 30;
    world.tick = 1;
    const beforeReserve = parent.reserve;
    const beforePigment = pigment(world);
    updateGlassLimpets(world, 0.1);
    expect(world.glassLimpets).toHaveLength(2);
    const child = world.glassLimpets[1];
    expect(child.parentId).toBe(parent.id);
    expect(child.reserve).toBe(SPECIES_CATALOG.glassLimpet.childReserve);
    expect(child.body).toBe(SPECIES_CATALOG.glassLimpet.childBody);
    expect(child.cargo).toBe(0);
    expect(parent.reserve).toBeCloseTo(
      beforeReserve -
        SPECIES_CATALOG.glassLimpet.childCost -
        SPECIES_CATALOG.glassLimpet.maintenanceRate * 0.1 * parent.traits.drive,
      8,
    );
    expect(pigment(world)).toBeCloseTo(
      beforePigment - SPECIES_CATALOG.glassLimpet.maintenanceRate * 0.1 * parent.traits.drive,
      8,
    );
    expect(child.traits).not.toEqual(parent.traits);
    expect(child.traits.drive).toBeGreaterThanOrEqual(TRAIT_MIN);
    expect(child.traits.drive).toBeLessThanOrEqual(TRAIT_MAX);
    expect(child.traits.bulk).toBeGreaterThanOrEqual(TRAIT_MIN);
    expect(child.traits.bulk).toBeLessThanOrEqual(TRAIT_MAX);
    expect(world.randomState).not.toBe(random);
    expect(parent.nextBirthAt).toBe(world.elapsed + SPECIES_CATALOG.glassLimpet.breedingRest);
    expect(parent.reserve).toBeGreaterThanOrEqual(
      glassLimpetSurvivalFloor(parent.traits) -
        SPECIES_CATALOG.glassLimpet.maintenanceRate * 0.1 * parent.traits.drive -
        1e-9,
    );
  });

  it('does not let a founder pay a child from the shoreline starting reserve', () => {
    const { world, limpet: parent } = born();
    expect(parent.reserve).toBe(SPECIES_CATALOG.glassLimpet.initialReserve);
    expect(parent.reserve).toBeLessThan(glassLimpetBirthStake(parent.traits));
    parent.age = SPECIES_CATALOG.glassLimpet.maturityAge - 0.1;
    parent.nextBirthAt = 30;
    world.elapsed = 30;
    world.tick = 1;
    const random = world.randomState;
    updateGlassLimpets(world, 0.1);
    expect(world.glassLimpets).toHaveLength(1);
    expect(world.randomState).toBe(random);
    expect(parent.reserve).toBeLessThan(glassLimpetBirthStake(parent.traits));
  });

  it('stocks a birth from current-fed grains into parent reserve, then keeps a survival floor', () => {
    const { world, limpet: parent } = born();
    parent.age = SPECIES_CATALOG.glassLimpet.maturityAge;
    parent.nextBirthAt = 30;
    world.elapsed = 30;
    searchPhase(world, parent);
    const food = grain(world, 1190, 500, 0.8);
    expect(applyCurrent(world, { x: 1160, y: 500 }, { x: 1220, y: 500 }).status).toBe('applied');
    const foodBefore = food.strength;
    const random = world.randomState;
    updateGlassLimpets(world, 1);
    expect(world.glassLimpets).toHaveLength(1);
    expect(world.randomState).toBe(random);
    expect(food.strength).toBeLessThan(foodBefore);
    expect(parent.reserve).toBeGreaterThan(SPECIES_CATALOG.glassLimpet.initialReserve);
    expect(parent.cargo).toBe(0);
    expect(parent.reserve).toBeLessThan(glassLimpetBirthStake(parent.traits));
    parent.reserve = glassLimpetBirthStake(parent.traits);
    parent.targetSedimentId = null;
    world.elapsed += 6;
    world.tick = 1;
    const beforeReserve = parent.reserve;
    const beforePigment = pigment(world);
    updateGlassLimpets(world, 0.1);
    expect(world.glassLimpets).toHaveLength(2);
    expect(world.glassLimpets[1].parentId).toBe(parent.id);
    expect(world.glassLimpets[1].body).toBe(SPECIES_CATALOG.glassLimpet.childBody);
    expect(parent.reserve).toBeCloseTo(
      beforeReserve -
        SPECIES_CATALOG.glassLimpet.childCost -
        SPECIES_CATALOG.glassLimpet.maintenanceRate * 0.1 * parent.traits.drive,
      8,
    );
    expect(pigment(world)).toBeCloseTo(
      beforePigment - SPECIES_CATALOG.glassLimpet.maintenanceRate * 0.1 * parent.traits.drive,
      8,
    );
    expect(parent.reserve).toBeGreaterThanOrEqual(
      glassLimpetSurvivalFloor(parent.traits) -
        SPECIES_CATALOG.glassLimpet.maintenanceRate * 0.1 * parent.traits.drive -
        1e-9,
    );
  });

  it('does not found from a grain a stocking parent can still bank', () => {
    const { world, limpet: parent } = born();
    parent.reserve = SPECIES_CATALOG.glassLimpet.initialReserve;
    world.elapsed = 60;
    world.glassLimpetAdmissionAt = 60;
    world.nextFoundingTick = 0;
    world.tick = 0;
    const nearby = grain(world, parent.x + 10, parent.y, 0.3);
    const random = world.randomState;
    expect(admitGlassLimpet(world)).toBe(false);
    expect(world.glassLimpets).toHaveLength(1);
    expect(world.randomState).toBe(random);
    expect(nearby.strength).toBe(0.3);
    const far = grain(world, 1000, 750, 0.3);
    expect(admitGlassLimpet(world)).toBe(true);
    expect(world.glassLimpets).toHaveLength(2);
    expect(world.glassLimpets[1].parentId).toBeNull();
    expect(world.glassLimpets[1].traits).toEqual(baselineTraits());
    expect(far.strength).toBe(0);
  });

  it('clamps inherited traits and does not draw the PRNG on a refused birth', () => {
    const { world, limpet: parent } = born();
    parent.traits = { drive: TRAIT_MAX, bulk: TRAIT_MIN };
    parent.age = 29.9;
    parent.reserve = 0.4;
    parent.nextBirthAt = 30;
    world.elapsed = 30;
    world.tick = 1;
    updateGlassLimpets(world, 0.1);
    const child = world.glassLimpets[1];
    expect(child.traits.drive).toBeGreaterThanOrEqual(TRAIT_MIN);
    expect(child.traits.drive).toBeLessThanOrEqual(TRAIT_MAX);
    expect(child.traits.bulk).toBeGreaterThanOrEqual(TRAIT_MIN);
    expect(child.traits.bulk).toBeLessThanOrEqual(TRAIT_MAX);
    const random = world.randomState;
    const nextId = world.nextId;
    parent.reserve = 0.4;
    parent.nextBirthAt = world.elapsed;
    updateGlassLimpets(world, 0.1);
    expect(world.glassLimpets).toHaveLength(2);
    expect(world.nextId).toBe(nextId);
    expect(world.randomState).toBe(random);
    parent.reserve = 0.1;
    parent.nextBirthAt = world.elapsed;
    world.tick += 6;
    world.elapsed += 6;
    const still = world.randomState;
    updateGlassLimpets(world, 0.1);
    expect(world.glassLimpets).toHaveLength(2);
    expect(world.randomState).toBe(still);
  });

  it('keeps the same child traits for the same seed', () => {
    function childOf(): { traits: { drive: number; bulk: number }; randomState: number } {
      const { world, limpet: parent } = born();
      parent.age = 29.9;
      parent.reserve = 0.4;
      parent.nextBirthAt = 30;
      world.elapsed = 30;
      world.tick = 1;
      updateGlassLimpets(world, 0.1);
      return { traits: world.glassLimpets[1].traits, randomState: world.randomState };
    }
    expect(childOf()).toEqual(childOf());
  });

  it('makes higher drive both hungrier and costlier, so neither pole is free', () => {
    const keen = born();
    const spare = born();
    const hungry = keen.limpet;
    const thrifty = spare.limpet;
    hungry.traits = { drive: TRAIT_MAX, bulk: 1 };
    thrifty.traits = { drive: TRAIT_MIN, bulk: 1 };
    hungry.age = 10;
    thrifty.age = 10;
    const keenFood = grain(keen.world, 1190, 500, 0.8);
    const spareFood = grain(spare.world, 1190, 500, 0.8);
    expect(applyCurrent(keen.world, { x: 1160, y: 500 }, { x: 1220, y: 500 }).status).toBe('applied');
    expect(applyCurrent(spare.world, { x: 1160, y: 500 }, { x: 1220, y: 500 }).status).toBe('applied');
    keen.world.tick = (6 - (hungry.id % 6)) % 6;
    spare.world.tick = (6 - (thrifty.id % 6)) % 6;
    updateGlassLimpets(keen.world, 1);
    updateGlassLimpets(spare.world, 1);
    expect(keen.world.ecologyLedger.glassLimpetMaintenancePigment).toBeGreaterThan(
      spare.world.ecologyLedger.glassLimpetMaintenancePigment,
    );
    expect(keenFood.strength).toBeLessThan(spareFood.strength);
    expect(hungry.reserve).toBeGreaterThan(thrifty.reserve);
  });

  it('lets a stouter shell hold more reserve while reaching less far', () => {
    const stout = born();
    const slight = born();
    const heavy = stout.limpet;
    const light = slight.limpet;
    heavy.traits = { drive: 1, bulk: TRAIT_MAX };
    light.traits = { drive: 1, bulk: TRAIT_MIN };
    expect(glassLimpetFeedReach(heavy.traits)).toBeLessThan(glassLimpetFeedReach(light.traits));
    expect(glassLimpetReserveCapacity(heavy.traits)).toBeGreaterThan(glassLimpetReserveCapacity(light.traits));
    heavy.reserve = 0.05;
    light.reserve = 0.05;
    heavy.age = 29.9;
    light.age = 29.9;
    heavy.nextBirthAt = 1000;
    light.nextBirthAt = 1000;
    grain(stout.world, 1190, 500, 1);
    grain(slight.world, 1190, 500, 1);
    expect(applyCurrent(stout.world, { x: 1160, y: 500 }, { x: 1220, y: 500 }).status).toBe('applied');
    expect(applyCurrent(slight.world, { x: 1160, y: 500 }, { x: 1220, y: 500 }).status).toBe('applied');
    searchPhase(stout.world, heavy);
    searchPhase(slight.world, light);
    for (let step = 0; step < 20; step++) {
      updateGlassLimpets(stout.world, 1);
      updateGlassLimpets(slight.world, 1);
    }
    expect(heavy.reserve).toBeGreaterThan(light.reserve);
    expect(heavy.reserve).toBeGreaterThan(SPECIES_CATALOG.glassLimpet.childCost);
    expect(heavy.reserve).toBeGreaterThan(glassLimpetReserveCapacity(light.traits));
  });
});
