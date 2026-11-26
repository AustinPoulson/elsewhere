import { describe, expect, it } from 'vitest';
import {
  inSea,
  inStrandline,
  mouthSegment,
  strandlinePoint,
  syncTide,
  tideConnectedAt,
  tideFlowAt,
} from '../src/world/habitat';
import { pigmentInSea, pigmentOnShore, pigmentOnStrandline, strandNote } from '../src/world/environment/tide';
import { createWorld, getStats, stepWorld } from '../src/world/simulation';
import { STRANDLINE_GRAIN_CAP, STRANDLINE_REMAIN_CAP } from '../src/world/types';

function locatedPigment(world: ReturnType<typeof createWorld>): number {
  return pigmentInSea(world) + pigmentOnShore(world);
}

describe('sea strandline', () => {
  it('opens with no wrack and names an empty strandline', () => {
    const world = createWorld(7);
    expect(world.sediment.filter((entry) => inStrandline(entry.x, entry.y))).toHaveLength(0);
    expect(world.ecologyLedger.strandPigmentIn).toBe(0);
    expect(world.ecologyLedger.strandPigmentOut).toBe(0);
    expect(getStats(world).strandPigment).toBe(0);
    expect(getStats(world).strandBodies).toBe(0);
    expect(strandNote(world)).toMatch(/strandline/i);
    expect(STRANDLINE_GRAIN_CAP).toBe(16);
    expect(STRANDLINE_REMAIN_CAP).toBe(8);
  });

  it('places wrack on the sea shore near the mouth from tick phase', () => {
    const link = mouthSegment();
    const point = strandlinePoint(12, 9);
    expect(inSea(point.x, point.y)).toBe(true);
    expect(inStrandline(point.x, point.y)).toBe(true);
    expect(Math.hypot(point.x - link.bx, point.y - link.by)).toBeLessThan(110);
    expect(strandlinePoint(12, 9)).toEqual(point);
  });

  it('settles ebb-crossing remains on the wrack without drawing the pool PRNG', () => {
    const world = createWorld(1);
    const link = mouthSegment();
    world.remains.push({
      id: world.nextId++,
      species: 'remain',
      source: 'unknown',
      x: link.ax + (link.bx - link.ax) * 0.82,
      y: link.ay + (link.by - link.ay) * 0.82,
      pigment: 0.42,
      hue: 196,
      age: 0,
      radius: 6,
    });
    world.elapsed = 110;
    world.tick = 2;
    syncTide(world.elapsed);
    expect(tideConnectedAt(world.elapsed)).toBe(true);
    expect(tideFlowAt(world.elapsed)).toBeGreaterThan(0);
    let settled = false;
    for (let step = 0; step < 1800; step++) {
      stepWorld(world);
      if (world.ecologyLedger.strandPigmentIn > 0) {
        settled = true;
        break;
      }
    }
    expect(settled).toBe(true);
    expect(world.remains.some((remain) => inStrandline(remain.x, remain.y) && remain.pigment > 0)).toBe(true);
    expect(pigmentOnStrandline(world)).toBeGreaterThan(0);
  });

  it('leaches wrack color into ordinary sea pigment without a PRNG draw', () => {
    const world = createWorld(3);
    const point = strandlinePoint(4, 11);
    const wrack = {
      id: world.nextId++,
      x: point.x,
      y: point.y,
      radius: 5,
      hue: 168,
      strength: 0.4,
      age: 0,
    };
    world.sediment.push(wrack);
    world.ecologyLedger.strandPigmentIn = 0.4;
    const seaGrain = world.sediment.find((grain) => inSea(grain.x, grain.y) && !inStrandline(grain.x, grain.y));
    expect(seaGrain).toBeDefined();
    const randomBefore = world.randomState;
    const held = locatedPigment(world);
    world.elapsed = 4;
    world.tick = 0;
    for (let step = 0; step < 12; step++) stepWorld(world);
    expect(world.ecologyLedger.strandPigmentOut).toBeGreaterThan(0);
    expect(world.randomState).toBe(randomBefore);
    expect(Math.abs(locatedPigment(world) - held)).toBeLessThan(0.02);
  });
});
