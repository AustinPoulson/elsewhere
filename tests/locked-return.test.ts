import { describe, expect, it } from 'vitest';
import { INLET_POOL, OPENING_POOL } from '../src/world/habitat';
import { LOCKED_RETURN, lockedColorReturning, returnLockedColor } from '../src/world/environment/locked-return';
import { heldNestPigment } from '../src/world/environment/nest-slump';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { createWorld, stepWorld } from '../src/world/simulation';
import { heldFossilPigment } from '../src/world/species/fossils';
import { admitGlassLimpet } from '../src/world/species/glass-limpet';
import { remainRadius, heldRemainPigment } from '../src/world/species/remains';
import { baselineTraits } from '../src/world/traits';
import { SCHEMA_REVISION, type Marlgrub, type Remain, type Siltstitcher, type World } from '../src/world/types';
import { runHarness } from '../scripts/harness';

function pigment(world: World): number {
  return (
    world.sediment.reduce((sum, grain) => sum + grain.strength, 0) +
    heldNestPigment(world) +
    heldRemainPigment(world) +
    world.glassLimpets.reduce((sum, limpet) => sum + limpet.body + limpet.reserve + limpet.cargo, 0) +
    heldFossilPigment(world) +
    world.ecologyLedger.mineralizedPigment
  );
}

function occupant(world: World, nestId: number): Siltstitcher {
  return {
    id: world.nextId++,
    species: 'siltstitcher',
    x: OPENING_POOL.x,
    y: OPENING_POOL.y,
    vx: 0,
    vy: 0,
    body: 0.2,
    reserve: 0.1,
    cargo: 0,
    age: 40,
    hue: 40,
    homeNestId: nestId,
    starvedFor: 0,
    mode: 'home',
    destination: null,
    blockedFor: 0,
    parentId: null,
    nextBirthAt: 80,
    traits: baselineTraits(),
  };
}

function scavenger(world: World, x: number, y: number): Marlgrub {
  return {
    id: world.nextId++,
    species: 'marlgrub',
    x,
    y,
    vx: 0,
    vy: 0,
    body: 0.1,
    reserve: 0,
    age: 10,
    hue: 40,
    starvedFor: 0,
    targetRemainId: null,
    parentId: null,
    nextBirthAt: 100,
    traits: baselineTraits(),
  };
}

function stain(world: World, x: number, y: number, amount: number): Remain {
  return {
    id: world.nextId++,
    species: 'remain',
    source: 'unknown',
    x,
    y,
    pigment: amount,
    hue: 40,
    age: 1,
    radius: remainRadius(amount),
  };
}

function floorGrain(world: World, x: number, y: number, strength = 0.1): void {
  world.sediment.push({ id: world.nextId++, x, y, radius: 6, hue: 40, strength, age: 0 });
}

function occupiedNest(tick = 12): World {
  const world = createWorld(1);
  world.elapsed = 40;
  world.tick = tick;
  world.grazers = [];
  world.skimmers = [];
  world.glassLimpets = [];
  world.cargoMites = [];
  world.marlgrubs = [];
  world.sediment = [];
  world.nests = [{ id: world.nextId++, x: OPENING_POOL.x - 80, y: OPENING_POOL.y, hue: 40, pigment: 1.2, age: 1 }];
  floorGrain(world, world.nests[0].x, world.nests[0].y);
  const home = occupant(world, world.nests[0].id);
  home.x = world.nests[0].x;
  home.y = world.nests[0].y;
  world.siltstitchers = [home];
  return world;
}

function catchingShell(tick = 12): World {
  const world = createWorld(1);
  world.elapsed = 40;
  world.tick = tick;
  world.grazers = [];
  world.skimmers = [];
  world.siltstitchers = [];
  world.glassLimpets = [];
  world.cargoMites = [];
  world.marlgrubs = [];
  world.nests = [];
  world.sediment = [];
  world.glassLimpetAdmissionAt = 0;
  world.glassLimpetCandidateAfterId = 0;
  floorGrain(world, 1200, 500, 0.3);
  expect(admitGlassLimpet(world)).toBe(true);
  world.sediment = [];
  floorGrain(world, 1200, 500, 0.1);
  world.glassLimpets[0].cargo = 0.4;
  world.tick = tick;
  return world;
}

describe('locked color return', () => {
  it('returns shell catch onto a shore grain without granting pigment', () => {
    const world = catchingShell();
    const before = pigment(world);
    const rng = world.randomState;
    returnLockedColor(world);
    expect(world.randomState).toBe(rng);
    expect(pigment(world)).toBeCloseTo(before, 12);
    expect(world.glassLimpets[0].cargo).toBeCloseTo(0.4 - LOCKED_RETURN.amount, 12);
    expect(world.glassLimpets[0].reserve).toBe(0.1);
    expect(world.glassLimpets[0].body).toBe(0.2);
    expect(world.sediment[0].strength).toBeCloseTo(0.1 + LOCKED_RETURN.amount, 12);
  });

  it('packs the fuller shoreline grain rather than a still interior grain', () => {
    const world = catchingShell();
    world.sediment = [];
    floorGrain(world, OPENING_POOL.x, OPENING_POOL.y, 0.8);
    floorGrain(world, INLET_POOL.x + 180, INLET_POOL.y, 0.9);
    floorGrain(world, 1180, 500, 0.08);
    floorGrain(world, 1220, 500, 0.11);
    returnLockedColor(world);
    expect(world.sediment[0].strength).toBe(0.8);
    expect(world.sediment[1].strength).toBe(0.9);
    expect(world.sediment[2].strength).toBe(0.08);
    expect(world.sediment[3].strength).toBeCloseTo(0.11 + LOCKED_RETURN.amount, 12);
  });

  it('can pack a thin shore grain to the glass limpet coarse threshold', () => {
    const world = catchingShell();
    world.sediment = [];
    floorGrain(world, 1200, 500, 0.11);
    for (const tick of [12, 18, 24]) {
      world.tick = tick;
      returnLockedColor(world);
    }
    expect(world.sediment[0].strength).toBeCloseTo(0.11 + 3 * LOCKED_RETURN.amount, 12);
    expect(world.sediment[0].strength).toBeGreaterThanOrEqual(0.12);
  });

  it('leaves an occupied nest so unused homes can still slump toward it', () => {
    const world = occupiedNest();
    returnLockedColor(world);
    expect(world.nests[0].pigment).toBe(1.2);
    expect(world.sediment[0].strength).toBe(0.1);
  });

  it('leaves a held remain for the stocking grub', () => {
    const world = occupiedNest();
    world.siltstitchers = [];
    world.nests = [];
    world.remains = [stain(world, OPENING_POOL.x, OPENING_POOL.y, 0.35)];
    world.marlgrubs = [scavenger(world, OPENING_POOL.x, OPENING_POOL.y)];
    returnLockedColor(world);
    expect(world.remains[0].pigment).toBe(0.35);
  });

  it('waits for the six-tick phase', () => {
    const world = catchingShell(13);
    returnLockedColor(world);
    expect(world.glassLimpets[0].cargo).toBe(0.4);
    expect(world.sediment[0].strength).toBe(0.1);
  });

  it('leaves color in place when the floor cannot receive it', () => {
    const world = catchingShell();
    world.sediment = [];
    returnLockedColor(world);
    expect(world.glassLimpets[0].cargo).toBe(0.4);
    expect(world.ecologyLedger.mineralizedPigment).toBe(0);
  });

  it('does not leach fossils', () => {
    const world = catchingShell();
    world.fossils = [
      {
        id: world.nextId++,
        species: 'fossil',
        source: 'glassLimpet',
        x: 1200,
        y: 500,
        pigment: 0.4,
        hue: 40,
        age: 1,
        radius: 8,
        formedAt: 10,
      },
    ];
    const before = world.fossils[0].pigment;
    returnLockedColor(world);
    expect(world.fossils[0].pigment).toBe(before);
  });

  it('keeps inlet color in the inlet', () => {
    const world = catchingShell();
    world.glassLimpets[0].x = INLET_POOL.x + 180;
    world.glassLimpets[0].y = INLET_POOL.y;
    world.sediment[0].x = INLET_POOL.x + 180;
    world.sediment[0].y = INLET_POOL.y;
    returnLockedColor(world);
    expect(world.sediment).toHaveLength(1);
    expect(world.sediment[0].x).toBeCloseTo(INLET_POOL.x + 180, 6);
    expect(world.sediment[0].y).toBeCloseTo(INLET_POOL.y, 6);
    expect(world.sediment[0].strength).toBeCloseTo(0.1 + LOCKED_RETURN.amount, 12);
  });

  it('names the return only while a shell actually holds catch', () => {
    const world = catchingShell();
    expect(lockedColorReturning(world)).toBe(true);
    world.glassLimpets[0].cargo = 0;
    expect(lockedColorReturning(world)).toBe(false);
  });

  it('leaves schema 19 unchanged and grants nothing to a restored world', () => {
    const world = createWorld(3);
    expect(world.schemaRevision).toBe(SCHEMA_REVISION);
    expect(SCHEMA_REVISION).toBe(21);
    const restored = restoreWorld(serializeWorld(world));
    expect(restored).not.toBeNull();
    expect(restored!.schemaRevision).toBe(SCHEMA_REVISION);
    expect(heldNestPigment(restored!)).toBeCloseTo(heldNestPigment(world), 9);
    expect(restored!.siltstitchers).toEqual(world.siltstitchers);
    expect(restored!.glassLimpets).toEqual(world.glassLimpets);
    expect(restored!.marlgrubs).toEqual(world.marlgrubs);
  });

  it('keeps ledgers balanced on a short harness run', () => {
    const report = runHarness({ days: 2, seed: 1, visitorLight: false });
    expect(report.conservationCheck.remainsBalanced).toBe(true);
    expect(report.conservationCheck.fossilsBalanced).toBe(true);
    expect(report.conservationCheck.seamBalanced).toBe(true);
  });
});

describe('locked color return determinism', () => {
  it('replays the same return after serialize', () => {
    const world = catchingShell(1200);
    const restored = restoreWorld(serializeWorld(world));
    expect(restored).not.toBeNull();
    for (let i = 0; i < 90; i++) {
      stepWorld(world);
      stepWorld(restored!);
    }
    expect(restored).toEqual(world);
  });
});
