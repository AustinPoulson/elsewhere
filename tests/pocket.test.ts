import { describe, expect, it } from 'vitest';
import {
  POCKET_POOL,
  TIDE_POCKET_CONNECT,
  inPocket,
  isInPool,
  pocketConnectedAt,
  pocketFlowAt,
  pocketMouthSegment,
  pocketVelocity,
  sharesPocketColor,
  syncTide,
  tideConnectedAt,
  tideFlowAt,
  tideHeightAt,
} from '../src/world/habitat';
import { pigmentInPocket, pocketBodyCount, pocketNote } from '../src/world/environment/tide';
import { createWorld, getStats, stepWorld } from '../src/world/simulation';
import { MAX_POOLS, POCKET_BODY_CAP, POCKET_SEDIMENT_CAP, SCHEMA_REVISION, type Point } from '../src/world/types';

describe('high rock pool', () => {
  it('opens empty on the same shore and is not a third visitor pool', () => {
    expect(MAX_POOLS).toBe(2);
    expect(SCHEMA_REVISION).toBe(22);
    const world = createWorld(7);
    expect(world.schemaRevision).toBe(SCHEMA_REVISION);
    expect(world.pools).toHaveLength(2);
    expect(world.organisms.filter((entry) => inPocket(entry.x, entry.y))).toHaveLength(0);
    expect(world.sediment.filter((entry) => inPocket(entry.x, entry.y))).toHaveLength(0);
    expect(pocketBodyCount(world)).toBe(0);
    expect(pigmentInPocket(world)).toBe(0);
    expect(world.ecologyLedger.pocketArrivals).toBe(0);
    expect(world.ecologyLedger.pocketDepartures).toBe(0);
    expect(isInPool(POCKET_POOL.x, POCKET_POOL.y)).toBe(true);
    expect(getStats(world).pocketBodies).toBe(0);
    expect(getStats(world).pocketPigment).toBe(0);
  });

  it('connects at a higher tide than the opening mouth, from the same sine', () => {
    expect(pocketConnectedAt(0)).toBe(false);
    expect(tideConnectedAt(0)).toBe(false);
    expect(pocketConnectedAt(90)).toBe(true);
    expect(tideConnectedAt(90)).toBe(true);
    expect(pocketConnectedAt(40)).toBe(tideHeightAt(40) >= TIDE_POCKET_CONNECT);
    expect(tideConnectedAt(40)).toBe(true);
    expect(pocketConnectedAt(40)).toBe(false);
    expect(pocketFlowAt(90)).toBeCloseTo(tideFlowAt(90), 10);
    expect(pocketFlowAt(40)).toBe(0);
    expect(pocketNote(90)).toMatch(/open to the sea/);
    expect(pocketNote(270)).toMatch(/cut off/);
  });

  it('writes the same pocket velocity into an out point as the allocating form', () => {
    const link = pocketMouthSegment();
    const samples: Point[] = [
      { x: link.ax, y: link.ay },
      { x: (link.ax + link.bx) / 2, y: (link.ay + link.by) / 2 },
      { x: link.bx, y: link.by },
      { x: POCKET_POOL.x, y: POCKET_POOL.y },
      { x: 720, y: 500 },
    ];
    const out = { x: 1, y: 1 };
    for (const elapsed of [0, 40, 90, 140, 270]) {
      for (const body of samples) {
        const allocated = pocketVelocity(body, elapsed, 1);
        const written = pocketVelocity(body, elapsed, 1, out);
        expect(written).toBe(out);
        expect(out).toEqual(allocated);
      }
    }
  });

  it('lets existing color wash through the high mouth without a gift', () => {
    const world = createWorld(1);
    const grain = world.sediment.find((entry) => !inPocket(entry.x, entry.y))!;
    const link = pocketMouthSegment();
    Object.assign(grain, { x: link.ax + link.ux * 4, y: link.ay + link.uy * 4, strength: 0.35 });
    world.elapsed = 55;
    world.tick = 2;
    syncTide(world.elapsed);
    expect(pocketConnectedAt(world.elapsed)).toBe(true);
    expect(inPocket(grain.x, grain.y)).toBe(false);
    const held = grain.strength;
    let arrived = false;
    for (let step = 0; step < 480; step++) {
      const before = inPocket(grain.x, grain.y);
      const pigmentIn = world.ecologyLedger.pocketPigmentIn;
      stepWorld(world);
      const next = inPocket(grain.x, grain.y);
      if (!before && next) {
        arrived = true;
        expect(grain.strength).toBeGreaterThan(held * 0.9);
        expect(world.ecologyLedger.pocketPigmentIn).toBeGreaterThanOrEqual(pigmentIn);
        break;
      }
    }
    expect(arrived).toBe(true);
    expect(sharesPocketColor(POCKET_POOL.x, POCKET_POOL.y, POCKET_POOL.x + 4, POCKET_POOL.y)).toBe(true);
    expect(sharesPocketColor(POCKET_POOL.x, POCKET_POOL.y, 720, 500)).toBe(false);
  });

  it('cuts the high pool off below its sill so bodies cannot wash across', () => {
    const world = createWorld(11);
    const seaBody = world.organisms.find((entry) => !inPocket(entry.x, entry.y))!;
    const link = pocketMouthSegment();
    Object.assign(seaBody, { x: link.bx, y: link.by, vx: 0, vy: 0 });
    world.elapsed = 40;
    world.tick = 2;
    syncTide(world.elapsed);
    expect(pocketConnectedAt(world.elapsed)).toBe(false);
    expect(tideConnectedAt(world.elapsed)).toBe(true);
    const before = inPocket(seaBody.x, seaBody.y);
    for (let step = 0; step < 90; step++) stepWorld(world);
    expect(inPocket(seaBody.x, seaBody.y)).toBe(before);
    expect(world.ecologyLedger.pocketArrivals).toBe(0);
    expect(world.ecologyLedger.pocketDepartures).toBe(0);
  });

  it('keeps the pocket population bounded', () => {
    const world = createWorld(5);
    expect(pocketBodyCount(world)).toBeLessThanOrEqual(POCKET_BODY_CAP);
    for (let step = 0; step < 1080; step++) stepWorld(world);
    expect(pocketBodyCount(world)).toBeLessThanOrEqual(POCKET_BODY_CAP);
    expect(world.sediment.filter((grain) => inPocket(grain.x, grain.y)).length).toBeLessThanOrEqual(
      POCKET_SEDIMENT_CAP,
    );
  });

  it('pours overflow pocket grains onto a grain with room, without a gift', () => {
    const world = createWorld(9);
    for (let i = 0; i < POCKET_SEDIMENT_CAP + 2; i++) {
      world.sediment.push({
        id: world.nextId++,
        x: POCKET_POOL.x + (i % 5) * 2,
        y: POCKET_POOL.y,
        radius: 6,
        hue: 40,
        strength: 0.08,
        age: 0,
      });
    }
    const planted = world.sediment
      .filter((grain) => inPocket(grain.x, grain.y))
      .reduce((sum, grain) => sum + grain.strength, 0);
    expect(world.sediment.filter((grain) => inPocket(grain.x, grain.y)).length).toBeGreaterThan(POCKET_SEDIMENT_CAP);
    for (let step = 0; step < 24; step++) stepWorld(world);
    const remaining = world.sediment.filter((grain) => inPocket(grain.x, grain.y));
    expect(remaining.length).toBeLessThanOrEqual(POCKET_SEDIMENT_CAP);
    const later = remaining.reduce((sum, grain) => sum + grain.strength, 0);
    expect(later).toBeGreaterThan(planted * 0.9);
  });
});
