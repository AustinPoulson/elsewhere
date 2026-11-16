import { describe, expect, it } from 'vitest';
import { createWorld, stepWorld } from '../src/world/simulation';
import { updateSkimmers } from '../src/world/species/skimmer';
import {
  admitMarlgrub,
  marlgrubBirthStake,
  marlgrubReserveCapacity,
  marlgrubSeekReach,
  marlgrubSurvivalFloor,
  updateMarlgrubs,
} from '../src/world/species/marlgrub';
import { SPECIES_CATALOG } from '../src/world/species/catalog';
import { NORMAL_FOUNDER_COUNT, tryEventFounding } from '../src/world/species/founding';
import { baselineTraits, traitMobility, TRAIT_MAX, TRAIT_MIN } from '../src/world/traits';
import {
  DEATH_SEDIMENT_FRACTION,
  REMAIN_DECAY_RATE,
  depositRemain,
  heldRemainPigment,
  settleDeath,
  takeRemainPigment,
  updateRemains,
} from '../src/world/species/remains';
import { LIMITS, REMAIN_CAPACITY, type Marlgrub, type World } from '../src/world/types';

function empty(): World {
  const world = createWorld(11);
  world.organisms = [];
  world.grazers = [];
  world.nests = [];
  world.lights = [];
  world.sediment = [];
  world.skimmers = [];
  return world;
}

function balanced(world: World): void {
  expect(world.ecologyLedger.remainsCreated).toBeCloseTo(
    heldRemainPigment(world) + world.ecologyLedger.remainsConsumed + world.ecologyLedger.remainsDecayed,
    10,
  );
  expect(world.ecologyLedger.fossilsFormed).toBeCloseTo(
    world.fossils.reduce((total, fossil) => total + fossil.pigment, 0),
    10,
  );
}

function remainShare(amount: number): number {
  return amount * (1 - DEATH_SEDIMENT_FRACTION);
}

describe('death remains', () => {
  it('returns a coarse grain from a starved body so shoreline founding can continue', () => {
    const world = empty();
    settleDeath(world, { x: 1200, y: 500 }, 180, 0.2, 'glassLimpet');
    expect(world.sediment[0].strength).toBeGreaterThanOrEqual(0.12);
    expect(world.remains[0].pigment).toBeCloseTo(remainShare(0.2), 12);
    balanced(world);
  });

  it('splits a death into a remain and immediate sediment without leaking pigment', () => {
    const world = empty();
    world.nests = [{ id: world.nextId++, x: 720, y: 500, hue: 180, pigment: 0.6, age: 0 }];
    world.skimmerAdmissionAt = 0;
    world.tick = 6;
    updateSkimmers(world, 1 / 30);
    const skimmer = world.skimmers[0];
    skimmer.reserve = 0.4;
    skimmer.age = 480;
    updateSkimmers(world, 1 / 30);
    expect(world.skimmers).toHaveLength(0);
    expect(world.remains).toHaveLength(1);
    expect(world.remains[0].x).toBe(skimmer.x);
    expect(world.remains[0].y).toBe(skimmer.y);
    expect(world.remains[0].hue).toBe(skimmer.hue);
    expect(world.remains[0].pigment).toBeCloseTo(remainShare(0.6), 12);
    expect(world.sediment).toHaveLength(1);
    expect(world.sediment[0].strength).toBeCloseTo(0.6 * DEATH_SEDIMENT_FRACTION, 12);
    expect(world.ecologyLedger.remainsCreated).toBeCloseTo(remainShare(0.6), 12);
    expect(world.ecologyLedger.mineralizedPigment).toBe(0);
    balanced(world);
  });

  it('leaves remains only through consumption or decay into existing pigment pools', () => {
    const world = empty();
    depositRemain(world, { x: 720, y: 500 }, 40, 0.5, 'unknown');
    expect(heldRemainPigment(world)).toBeCloseTo(0.5, 12);
    const remain = world.remains[0];
    expect(takeRemainPigment(world, remain, 0.2)).toBeCloseTo(0.2, 12);
    updateRemains(world, 10);
    expect(world.ecologyLedger.remainsConsumed).toBeCloseTo(0.2, 12);
    expect(world.ecologyLedger.remainsDecayed).toBeCloseTo(10 * REMAIN_DECAY_RATE, 12);
    expect(world.sediment.reduce((sum, grain) => sum + grain.strength, 0)).toBeCloseTo(
      world.ecologyLedger.remainsDecayed,
      12,
    );
    balanced(world);
  });

  it('merges tiny decay into nearby sediment instead of spawning dust grains', () => {
    const world = empty();
    world.sediment = [{ id: world.nextId++, x: 720, y: 500, strength: 0.1, hue: 40, radius: 6, age: 0 }];
    depositRemain(world, { x: 722, y: 500 }, 40, 0.5, 'unknown');
    const before = world.sediment[0].strength;
    updateRemains(world, 1 / 30);
    expect(world.sediment).toHaveLength(1);
    expect(world.sediment[0].strength).toBeCloseTo(before + (1 / 30) * REMAIN_DECAY_RATE, 12);
    expect(world.ecologyLedger.mineralizedPigment).toBe(0);
    balanced(world);
  });

  it('caps remain cells and leaches the oldest when a new death needs a slot', () => {
    const world = empty();
    for (let i = 0; i < LIMITS.remains; i++) {
      depositRemain(world, { x: 500 + (i % 12) * 30, y: 400 + Math.floor(i / 12) * 40 }, 80, 0.2, 'unknown');
    }
    expect(world.remains).toHaveLength(LIMITS.remains);
    const oldest = world.remains[0];
    oldest.age = 80;
    const created = world.ecologyLedger.remainsCreated;
    depositRemain(world, { x: 900, y: 500 }, 200, 0.4, 'unknown');
    expect(world.remains.length).toBeLessThanOrEqual(LIMITS.remains);
    expect(world.remains.some((entry) => entry.id === oldest.id)).toBe(false);
    expect(world.ecologyLedger.remainsCreated).toBeCloseTo(created + 0.4, 12);
    expect(world.ecologyLedger.remainsDecayed).toBeGreaterThan(0);
    balanced(world);
  });

  it('never stores more than the remain capacity in one cell', () => {
    const world = empty();
    depositRemain(world, { x: 720, y: 500 }, 10, REMAIN_CAPACITY, 'unknown');
    depositRemain(world, { x: 722, y: 500 }, 40, 0.8, 'unknown');
    expect(world.remains[0].pigment).toBeLessThanOrEqual(REMAIN_CAPACITY);
    balanced(world);
  });

  it('merges nearby remains only when they share a source', () => {
    const world = empty();
    depositRemain(world, { x: 720, y: 500 }, 40, 0.2, 'skimmer');
    depositRemain(world, { x: 722, y: 500 }, 80, 0.3, 'unknown');
    expect(world.remains).toHaveLength(2);
    expect(world.remains.map((remain) => remain.source)).toEqual(['skimmer', 'unknown']);
    expect(world.remains[0].pigment).toBeCloseTo(0.2, 12);
    expect(world.remains[1].pigment).toBeCloseTo(0.3, 12);
    depositRemain(world, { x: 721, y: 501 }, 10, 0.15, 'skimmer');
    expect(world.remains).toHaveLength(2);
    expect(world.remains.map((remain) => remain.source)).toEqual(['skimmer', 'unknown']);
    expect(world.remains[0].pigment).toBeCloseTo(0.35, 12);
    expect(world.remains[1].pigment).toBeCloseTo(0.3, 12);
    balanced(world);
  });
});

describe('marlgrub consumer', () => {
  it('pays for a body from remains and is absent from opening and migrated-like empty worlds', () => {
    const world = createWorld(4);
    expect(world.marlgrubs).toEqual([]);
    expect(world.remains).toEqual([]);
    const funded = empty();
    depositRemain(funded, { x: 720, y: 500 }, 90, 0.5, 'unknown');
    expect(admitMarlgrub(funded)).toBe(true);
    expect(funded.marlgrubs[0]).toMatchObject({
      body: 0.1,
      reserve: 0.1,
      x: 720,
      y: 500,
      parentId: null,
      traits: baselineTraits(),
    });
    expect(heldRemainPigment(funded)).toBeCloseTo(0.3, 12);
    expect(funded.ecologyLedger.remainsConsumed).toBeCloseTo(0.2, 12);
    expect(funded.randomState).toBe(empty().randomState);
    balanced(funded);
  });

  it('feeds only from remains and returns its body as remains and sediment', () => {
    const world = empty();
    depositRemain(world, { x: 720, y: 500 }, 90, 0.8, 'unknown');
    expect(admitMarlgrub(world)).toBe(true);
    const grub = world.marlgrubs[0];
    world.tick = (6 - (grub.id % 6)) % 6;
    updateMarlgrubs(world, 0.5);
    expect(world.ecologyLedger.marlgrubIntake).toBeGreaterThan(0);
    expect(grub.reserve).toBeGreaterThan(0.1);
    balanced(world);
    grub.age = 360;
    const held = grub.body + grub.reserve;
    const created = world.ecologyLedger.remainsCreated;
    updateMarlgrubs(world, 0.02);
    expect(world.marlgrubs).toHaveLength(0);
    expect(world.ecologyLedger.remainsCreated).toBeCloseTo(created + remainShare(held), 12);
    balanced(world);
  });

  it('refuses founding when remains cannot pay and does not gift a body', () => {
    const world = empty();
    depositRemain(world, { x: 720, y: 500 }, 90, 0.19, 'unknown');
    const random = world.randomState;
    const id = world.nextId;
    expect(admitMarlgrub(world)).toBe(false);
    expect(world.marlgrubs).toEqual([]);
    expect(world.nextId).toBe(id);
    expect(world.randomState).toBe(random);
    expect(heldRemainPigment(world)).toBeCloseTo(0.19, 12);
  });

  it('founds through the off-phase event offer without joining the six-type rotation', () => {
    expect(NORMAL_FOUNDER_COUNT).toBe(6);
    const world = empty();
    depositRemain(world, { x: 720, y: 500 }, 90, 0.5, 'unknown');
    world.tick = 1;
    world.nextFoundingTick = 0;
    const cursor = world.foundingTypeCursor;
    expect(tryEventFounding(world, admitMarlgrub)).toBe(true);
    expect(world.marlgrubs).toHaveLength(1);
    expect(world.foundingTypeCursor).toBe(cursor);
    expect(world.nextFoundingTick).toBe(7);
    const live = empty();
    depositRemain(live, { x: 720, y: 500 }, 90, 0.5, 'unknown');
    live.tick = 0;
    live.nextFoundingTick = 0;
    stepWorld(live);
    expect(live.marlgrubs).toHaveLength(1);
  });
});

function pigment(world: World) {
  return (
    world.sediment.reduce((sum, grain) => sum + grain.strength, 0) +
    world.remains.reduce((sum, remain) => sum + remain.pigment, 0) +
    world.fossils.reduce((sum, fossil) => sum + fossil.pigment, 0) +
    world.marlgrubs.reduce((sum, grub) => sum + grub.body + grub.reserve, 0)
  );
}

function born(): { world: World; grub: Marlgrub } {
  const world = empty();
  depositRemain(world, { x: 720, y: 500 }, 90, 0.8, 'unknown');
  expect(admitMarlgrub(world)).toBe(true);
  return { world, grub: world.marlgrubs[0] };
}

describe('marlgrub inheritance', () => {
  it('gives founders baseline traits and spends parent reserve for a mutated child', () => {
    const { world, grub: parent } = born();
    const random = world.randomState;
    expect(parent.traits).toEqual(baselineTraits());
    expect(parent.parentId).toBeNull();
    expect(parent.reserve).toBeLessThan(marlgrubBirthStake(parent.traits));
    parent.age = 29.9;
    parent.reserve = 0.4;
    parent.targetRemainId = null;
    world.elapsed = 30;
    world.tick = ((6 - (parent.id % 6)) % 6) + 1;
    const beforeReserve = parent.reserve;
    const beforePigment = pigment(world);
    updateMarlgrubs(world, 0.1);
    expect(world.marlgrubs).toHaveLength(2);
    const child = world.marlgrubs[1];
    expect(child.parentId).toBe(parent.id);
    expect(child.reserve).toBe(SPECIES_CATALOG.marlgrub.childReserve);
    expect(child.body).toBe(SPECIES_CATALOG.marlgrub.childBody);
    expect(parent.reserve).toBeCloseTo(
      beforeReserve -
        SPECIES_CATALOG.marlgrub.childCost -
        SPECIES_CATALOG.marlgrub.maintenanceRate * 0.1 * parent.traits.drive,
      8,
    );
    expect(pigment(world)).toBeCloseTo(
      beforePigment - SPECIES_CATALOG.marlgrub.maintenanceRate * 0.1 * parent.traits.drive,
      8,
    );
    expect(child.traits).not.toEqual(parent.traits);
    expect(child.traits.drive).toBeGreaterThanOrEqual(TRAIT_MIN);
    expect(child.traits.drive).toBeLessThanOrEqual(TRAIT_MAX);
    expect(child.traits.bulk).toBeGreaterThanOrEqual(TRAIT_MIN);
    expect(child.traits.bulk).toBeLessThanOrEqual(TRAIT_MAX);
    expect(world.randomState).not.toBe(random);
    expect(parent.nextBirthAt).toBe(world.elapsed + SPECIES_CATALOG.marlgrub.breedingRest);
    expect(parent.reserve).toBeGreaterThanOrEqual(
      marlgrubSurvivalFloor(parent.traits) -
        SPECIES_CATALOG.marlgrub.maintenanceRate * 0.1 * parent.traits.drive -
        1e-9,
    );
    balanced(world);
  });

  it('does not let a founder pay a child from the event-offer starting reserve', () => {
    const { world, grub: parent } = born();
    expect(parent.reserve).toBe(SPECIES_CATALOG.marlgrub.initialReserve);
    expect(parent.reserve).toBeLessThan(marlgrubBirthStake(parent.traits));
    parent.age = SPECIES_CATALOG.marlgrub.maturityAge - 0.1;
    parent.nextBirthAt = 30;
    world.elapsed = 30;
    world.tick = 1;
    const random = world.randomState;
    updateMarlgrubs(world, 0.1);
    expect(world.marlgrubs).toHaveLength(1);
    expect(world.randomState).toBe(random);
    expect(parent.reserve).toBeLessThan(SPECIES_CATALOG.marlgrub.childCost);
  });

  it('clamps inherited traits and does not draw the PRNG on a refused birth', () => {
    const { world, grub: parent } = born();
    parent.traits = { drive: TRAIT_MAX, bulk: TRAIT_MIN };
    parent.age = 29.9;
    parent.reserve = 0.4;
    world.elapsed = 30;
    world.tick = 1;
    updateMarlgrubs(world, 0.1);
    const child = world.marlgrubs[1];
    expect(child.traits.drive).toBeGreaterThanOrEqual(TRAIT_MIN);
    expect(child.traits.drive).toBeLessThanOrEqual(TRAIT_MAX);
    expect(child.traits.bulk).toBeGreaterThanOrEqual(TRAIT_MIN);
    expect(child.traits.bulk).toBeLessThanOrEqual(TRAIT_MAX);
    const random = world.randomState;
    const nextId = world.nextId;
    parent.reserve = 0.4;
    parent.nextBirthAt = world.elapsed;
    updateMarlgrubs(world, 0.1);
    expect(world.marlgrubs).toHaveLength(2);
    expect(world.nextId).toBe(nextId);
    expect(world.randomState).toBe(random);
    parent.reserve = 0.15;
    parent.nextBirthAt = world.elapsed;
    world.tick += 6;
    world.elapsed += 6;
    const still = world.randomState;
    updateMarlgrubs(world, 0.1);
    expect(world.marlgrubs).toHaveLength(2);
    expect(world.randomState).toBe(still);
  });

  it('keeps the same child traits for the same seed', () => {
    function childOf(): { traits: { drive: number; bulk: number }; randomState: number } {
      const { world, grub: parent } = born();
      parent.age = 29.9;
      parent.reserve = 0.4;
      world.elapsed = 30;
      world.tick = 1;
      updateMarlgrubs(world, 0.1);
      return { traits: world.marlgrubs[1].traits, randomState: world.randomState };
    }
    expect(childOf()).toEqual(childOf());
  });

  it('makes higher drive both hungrier and costlier, so neither pole is free', () => {
    const keen = born();
    const spare = born();
    const hungry = keen.grub;
    const thrifty = spare.grub;
    hungry.traits = { drive: TRAIT_MAX, bulk: 1 };
    thrifty.traits = { drive: TRAIT_MIN, bulk: 1 };
    hungry.age = 10;
    thrifty.age = 10;
    keen.world.tick = (6 - (hungry.id % 6)) % 6;
    spare.world.tick = (6 - (thrifty.id % 6)) % 6;
    const keenHeld = heldRemainPigment(keen.world);
    const spareHeld = heldRemainPigment(spare.world);
    updateMarlgrubs(keen.world, 1);
    updateMarlgrubs(spare.world, 1);
    expect(keen.world.ecologyLedger.marlgrubMaintenancePigment).toBeGreaterThan(
      spare.world.ecologyLedger.marlgrubMaintenancePigment,
    );
    expect(heldRemainPigment(keen.world)).toBeLessThan(keenHeld);
    expect(heldRemainPigment(spare.world)).toBeLessThan(spareHeld);
    expect(heldRemainPigment(keen.world)).toBeLessThan(heldRemainPigment(spare.world));
    expect(hungry.reserve).toBeGreaterThan(thrifty.reserve);
  });

  it('lets a stouter grub hold more remains while reaching and traveling less far', () => {
    const stout = born();
    const slight = born();
    const heavy = stout.grub;
    const light = slight.grub;
    heavy.traits = { drive: 1, bulk: TRAIT_MAX };
    light.traits = { drive: 1, bulk: TRAIT_MIN };
    expect(marlgrubSeekReach(heavy.traits)).toBeLessThan(marlgrubSeekReach(light.traits));
    expect(traitMobility(heavy.traits)).toBeLessThan(traitMobility(light.traits));
    expect(marlgrubReserveCapacity(heavy.traits)).toBeGreaterThan(marlgrubReserveCapacity(light.traits));
    heavy.reserve = 0.05;
    light.reserve = 0.05;
    heavy.age = 10;
    light.age = 10;
    stout.world.tick = (6 - (heavy.id % 6)) % 6;
    slight.world.tick = (6 - (light.id % 6)) % 6;
    for (let step = 0; step < 40; step++) {
      updateMarlgrubs(stout.world, 1);
      updateMarlgrubs(slight.world, 1);
    }
    expect(heavy.reserve).toBeGreaterThan(light.reserve);
    expect(heavy.reserve).toBeGreaterThan(SPECIES_CATALOG.marlgrub.childCost);
    expect(light.reserve).toBeCloseTo(
      marlgrubReserveCapacity(light.traits) - SPECIES_CATALOG.marlgrub.maintenanceRate,
      5,
    );
    stout.world.remains = [];
    slight.world.remains = [];
    depositRemain(stout.world, { x: 800, y: 500 }, 90, 0.8, 'unknown');
    depositRemain(slight.world, { x: 800, y: 500 }, 90, 0.8, 'unknown');
    heavy.x = 720;
    light.x = 720;
    heavy.y = 500;
    light.y = 500;
    heavy.targetRemainId = null;
    light.targetRemainId = null;
    stout.world.tick = (6 - (heavy.id % 6)) % 6;
    slight.world.tick = (6 - (light.id % 6)) % 6;
    const heavyStart = heavy.x;
    const lightStart = light.x;
    updateMarlgrubs(stout.world, 1);
    updateMarlgrubs(slight.world, 1);
    expect(heavy.x - heavyStart).toBeLessThan(light.x - lightStart);
  });
});

describe('long-run remain budget', () => {
  it('keeps remain cells and work bounded while deaths continue', () => {
    const world = createWorld(1);
    for (let i = 0; i < 18_000; i++) stepWorld(world);
    expect(world.remains.length).toBeLessThanOrEqual(LIMITS.remains);
    expect(world.fossils.length).toBeLessThanOrEqual(LIMITS.fossils);
    expect(world.marlgrubs.length).toBeLessThanOrEqual(4);
    balanced(world);
  }, 20_000);
});
