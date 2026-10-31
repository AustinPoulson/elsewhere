import { describe, expect, it } from 'vitest';
import { accrueFeedingPigment, depositFeedingPigment, PIGMENT_PER_LIGHT } from '../src/world/feeding';
import { createWorld, stepWorld } from '../src/world/simulation';
import { LIMITS } from '../src/world/types';

describe('paid feeding deposits', () => {
  it('credits only actual intake and cannot amplify tiny light remnants', () => {
    const world = createWorld(7);
    const creature = world.organisms[0];
    world.organisms = [creature];
    world.grazers = [];
    world.nests = [];
    world.sediment = [];
    world.lights = [{ id: world.nextId++, x: 720, y: 500, energy: 0.00001, initialEnergy: 1.35, age: 0 }];
    Object.assign(creature, { x: 720, y: 500, vx: 0, vy: 0, pigmentCredit: 0 });
    world.tick = 35 - (creature.id % 36);
    stepWorld(world);
    expect(world.consumed).toBeCloseTo(0.00001, 12);
    expect(creature.pigmentCredit).toBeCloseTo(world.consumed * PIGMENT_PER_LIGHT, 12);
    expect(world.sediment).toHaveLength(0);
    expect(depositFeedingPigment(world, creature)).toBe(false);
  });

  it('transfers bounded credit into food and preserves full-floor grains on refusal', () => {
    const world = createWorld();
    const creature = world.organisms[0];
    world.sediment = [];
    accrueFeedingPigment(world, creature, 20);
    expect(creature.pigmentCredit).toBe(0.4);
    expect(depositFeedingPigment(world, creature)).toBe(true);
    expect(world.sediment[0].strength).toBe(0.3);
    expect(creature.pigmentCredit).toBeCloseTo(0.1, 12);
    const grain = world.sediment[0];
    world.sediment = Array.from({ length: LIMITS.sediment }, (_, i) => ({ ...grain, id: world.nextId + i }));
    world.nextId += LIMITS.sediment;
    const before = structuredClone(world);
    expect(depositFeedingPigment(world, creature)).toBe(false);
    expect(world).toEqual(before);
    accrueFeedingPigment(world, creature, 100);
    expect(creature.pigmentCredit).toBe(1);
    expect(world.ecologyLedger.feedingCreditLost).toBeCloseTo(1.1, 12);
  });

  it('refuses unsafe IDs without payment, random draws, eviction or allocation', () => {
    const world = createWorld();
    const creature = world.organisms[0];
    creature.pigmentCredit = 0.3;
    world.nextId = Number.MAX_SAFE_INTEGER;
    const before = structuredClone(world);
    expect(depositFeedingPigment(world, creature)).toBe(false);
    expect(world).toEqual(before);
  });
});
