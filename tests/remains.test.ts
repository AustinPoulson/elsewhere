import { describe, expect, it } from 'vitest';
import { createWorld, stepWorld } from '../src/world/simulation';
import { updateSkimmers } from '../src/world/species/skimmer';
import { admitMarlgrub, updateMarlgrubs } from '../src/world/species/marlgrub';
import {
  REMAIN_DECAY_RATE,
  depositRemain,
  heldRemainPigment,
  takeRemainPigment,
  updateRemains,
} from '../src/world/species/remains';
import { LIMITS, REMAIN_CAPACITY, type World } from '../src/world/types';

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
}

describe('death remains', () => {
  it('turns an exact body-plus-reserve into a located remain without touching sediment', () => {
    const world = empty();
    world.nests = [{ id: world.nextId++, x: 720, y: 500, hue: 180, pigment: 0.6, age: 0 }];
    world.skimmerAdmissionAt = 0;
    world.tick = 6;
    updateSkimmers(world, 1 / 30);
    const skimmer = world.skimmers[0];
    skimmer.reserve = 0.4;
    skimmer.age = 480;
    const sediment = world.sediment.length;
    updateSkimmers(world, 1 / 30);
    expect(world.skimmers).toHaveLength(0);
    expect(world.remains).toHaveLength(1);
    expect(world.remains[0].x).toBe(skimmer.x);
    expect(world.remains[0].y).toBe(skimmer.y);
    expect(world.remains[0].hue).toBe(skimmer.hue);
    expect(world.remains[0].pigment).toBeCloseTo(0.6, 12);
    expect(world.sediment).toHaveLength(sediment);
    expect(world.ecologyLedger.remainsCreated).toBeCloseTo(0.6, 12);
    expect(world.ecologyLedger.mineralizedPigment).toBe(0);
    balanced(world);
  });

  it('leaves remains only through consumption or decay into existing pigment pools', () => {
    const world = empty();
    depositRemain(world, { x: 720, y: 500 }, 40, 0.5);
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

  it('caps remain cells and leaches the oldest when a new death needs a slot', () => {
    const world = empty();
    for (let i = 0; i < LIMITS.remains; i++) {
      depositRemain(world, { x: 500 + (i % 12) * 30, y: 400 + Math.floor(i / 12) * 40 }, 80, 0.2);
    }
    expect(world.remains).toHaveLength(LIMITS.remains);
    const oldest = world.remains[0];
    oldest.age = 80;
    const created = world.ecologyLedger.remainsCreated;
    depositRemain(world, { x: 900, y: 500 }, 200, 0.4);
    expect(world.remains.length).toBeLessThanOrEqual(LIMITS.remains);
    expect(world.remains.some((entry) => entry.id === oldest.id)).toBe(false);
    expect(world.ecologyLedger.remainsCreated).toBeCloseTo(created + 0.4, 12);
    expect(world.ecologyLedger.remainsDecayed).toBeGreaterThan(0);
    balanced(world);
  });

  it('never stores more than the remain capacity in one cell', () => {
    const world = empty();
    depositRemain(world, { x: 720, y: 500 }, 10, REMAIN_CAPACITY);
    depositRemain(world, { x: 722, y: 500 }, 40, 0.8);
    expect(world.remains[0].pigment).toBeLessThanOrEqual(REMAIN_CAPACITY);
    balanced(world);
  });
});

describe('marlgrub consumer', () => {
  it('pays for a body from remains and is absent from opening and migrated-like empty worlds', () => {
    const world = createWorld(4);
    expect(world.marlgrubs).toEqual([]);
    expect(world.remains).toEqual([]);
    const funded = empty();
    depositRemain(funded, { x: 720, y: 500 }, 90, 0.5);
    expect(admitMarlgrub(funded)).toBe(true);
    expect(funded.marlgrubs[0]).toMatchObject({ body: 0.1, reserve: 0.1, x: 720, y: 500 });
    expect(heldRemainPigment(funded)).toBeCloseTo(0.3, 12);
    expect(funded.ecologyLedger.remainsConsumed).toBeCloseTo(0.2, 12);
    expect(funded.randomState).toBe(empty().randomState);
    balanced(funded);
  });

  it('feeds only from remains and returns its body as remains', () => {
    const world = empty();
    depositRemain(world, { x: 720, y: 500 }, 90, 0.8);
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
    expect(world.ecologyLedger.remainsCreated).toBeCloseTo(created + held, 12);
    balanced(world);
  });

  it('refuses founding when remains cannot pay and does not gift a body', () => {
    const world = empty();
    depositRemain(world, { x: 720, y: 500 }, 90, 0.19);
    const random = world.randomState;
    const id = world.nextId;
    expect(admitMarlgrub(world)).toBe(false);
    expect(world.marlgrubs).toEqual([]);
    expect(world.nextId).toBe(id);
    expect(world.randomState).toBe(random);
    expect(heldRemainPigment(world)).toBeCloseTo(0.19, 12);
  });
});

describe('long-run remain budget', () => {
  it('keeps remain cells and work bounded while deaths continue', () => {
    const world = createWorld(1);
    for (let i = 0; i < 18_000; i++) stepWorld(world);
    expect(world.remains.length).toBeLessThanOrEqual(LIMITS.remains);
    expect(world.marlgrubs.length).toBeLessThanOrEqual(4);
    balanced(world);
  }, 20_000);
});
