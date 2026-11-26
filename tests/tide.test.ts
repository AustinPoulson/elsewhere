import { describe, expect, it } from 'vitest';
import {
  TIDE_CONNECT,
  TIDE_FLOW,
  TIDE_INFLUENCE,
  TIDE_PERIOD,
  inSea,
  isInPool,
  mouthSegment,
  syncTide,
  tideConnectedAt,
  tideFlowAt,
  tideHeightAt,
  tideRegion,
  tideVelocity,
} from '../src/world/habitat';
import {
  pigmentInPocket,
  pigmentInSea,
  pigmentOnShore,
  seaBodyCount,
  tideNameAt,
  tideNote,
} from '../src/world/environment/tide';
import { createWorld, getStats, stepWorld } from '../src/world/simulation';
import { SEA_BODY_CAP, type Point } from '../src/world/types';

function locatedPigment(world: ReturnType<typeof createWorld>): number {
  return pigmentInSea(world) + pigmentOnShore(world) + pigmentInPocket(world);
}

describe('tide and sea', () => {
  it('derives a deterministic day-long tide from elapsed time', () => {
    expect(TIDE_PERIOD).toBe(360);
    expect(tideHeightAt(0)).toBeCloseTo(0, 10);
    expect(tideConnectedAt(0)).toBe(false);
    expect(tideFlowAt(0)).toBe(0);
    expect(tideNameAt(0)).toBe('rising');
    expect(tideHeightAt(90)).toBeCloseTo(1, 10);
    expect(tideConnectedAt(90)).toBe(true);
    expect(tideFlowAt(90)).toBeCloseTo(0, 10);
    expect(tideNameAt(90)).toBe('high');
    expect(tideHeightAt(180)).toBeCloseTo(0, 10);
    expect(tideConnectedAt(180)).toBe(false);
    expect(tideNameAt(180)).toBe('falling');
    expect(tideHeightAt(270)).toBeCloseTo(-1, 10);
    expect(tideNameAt(270)).toBe('low');
    expect(tideConnectedAt(40)).toBe(tideHeightAt(40) >= TIDE_CONNECT);
    expect(tideFlowAt(40)).toBeCloseTo(-Math.cos((40 / TIDE_PERIOD) * Math.PI * 2) * TIDE_FLOW, 10);
    expect(tideNote(90)).toMatch(/High tide/);
    expect(tideNote(270)).toMatch(/Low tide/);
  });

  it('opens with a paid sea that does not draw the pool PRNG', () => {
    const world = createWorld(7);
    const poolLucents = world.organisms.filter((entry) => !inSea(entry.x, entry.y));
    const seaLucents = world.organisms.filter((entry) => inSea(entry.x, entry.y));
    expect(poolLucents).toHaveLength(24);
    expect(seaLucents).toHaveLength(4);
    expect(world.sediment.filter((entry) => inSea(entry.x, entry.y))).toHaveLength(8);
    expect(seaBodyCount(world)).toBe(4);
    expect(pigmentInSea(world)).toBeGreaterThan(0);
    expect(world.ecologyLedger.tideArrivals).toBe(0);
    expect(world.ecologyLedger.tideDepartures).toBe(0);
    const copy = createWorld(7);
    expect(copy.randomState).toBe(world.randomState);
    expect(copy.organisms.map((entry) => entry.id)).toEqual(world.organisms.map((entry) => entry.id));
  });

  it('writes the same tide velocity into an out point as the allocating form', () => {
    function reference(body: Point, elapsed: number, scale: number): Point {
      const link = mouthSegment();
      const flow = tideFlowAt(elapsed);
      if (flow === 0) return { x: 0, y: 0 };
      const abx = link.bx - link.ax;
      const aby = link.by - link.ay;
      const span = abx * abx + aby * aby;
      const t = span === 0 ? 0 : Math.min(1, Math.max(0, ((body.x - link.ax) * abx + (body.y - link.ay) * aby) / span));
      const sdf = Math.hypot(body.x - (link.ax + t * abx), body.y - (link.ay + t * aby)) - link.width / 2;
      if (sdf > TIDE_INFLUENCE) return { x: 0, y: 0 };
      const strength = sdf <= 0 ? 1 : 1 - sdf / TIDE_INFLUENCE;
      return { x: link.ux * flow * strength * scale, y: link.uy * flow * strength * scale };
    }
    const link = mouthSegment();
    const samples: Point[] = [
      { x: link.ax, y: link.ay },
      { x: (link.ax + link.bx) / 2, y: (link.ay + link.by) / 2 },
      { x: link.bx, y: link.by },
      { x: 720, y: 500 },
      { x: 200, y: 200 },
    ];
    const out = { x: 1, y: 1 };
    for (const elapsed of [0, 40, 90, 140, 270]) {
      for (const body of samples) {
        const allocated = tideVelocity(body, elapsed, 1);
        const written = tideVelocity(body, elapsed, 1, out);
        expect(allocated).toEqual(reference(body, elapsed, 1));
        expect(written).toBe(out);
        expect(out).toEqual(allocated);
      }
    }
  });

  it('lets a body carry its own reserves through the mouth and conserves pigment', () => {
    const world = createWorld(1);
    const body = world.organisms.find((entry) => inSea(entry.x, entry.y))!;
    const link = mouthSegment();
    Object.assign(body, { x: link.bx, y: link.by, vx: 0, vy: 0, pigmentCredit: 0.35 });
    world.elapsed = 40;
    world.tick = 2;
    syncTide(world.elapsed);
    const credit = body.pigmentCredit;
    let arrived = false;
    for (let step = 0; step < 480; step++) {
      const before = tideRegion(body.x, body.y);
      const held = locatedPigment(world);
      const pigmentIn = world.ecologyLedger.tidePigmentIn;
      stepWorld(world);
      const next = tideRegion(body.x, body.y);
      if (before === 'sea' && (next === 'pool' || next === 'mouth')) {
        arrived = true;
        expect(body.pigmentCredit).toBeCloseTo(credit, 3);
        expect(world.ecologyLedger.tideArrivals).toBeGreaterThanOrEqual(1);
        expect(world.ecologyLedger.tidePigmentIn).toBeGreaterThanOrEqual(pigmentIn);
        expect(Math.abs(locatedPigment(world) - held)).toBeLessThan(0.02);
        break;
      }
    }
    expect(arrived).toBe(true);
    expect(getStats(world).tideConnected).toBe(true);
  });

  it('cuts the pool off at low tide so bodies cannot wash across', () => {
    const world = createWorld(11);
    const seaBody = world.organisms.find((entry) => inSea(entry.x, entry.y))!;
    const poolBody = world.organisms.find((entry) => !inSea(entry.x, entry.y))!;
    const link = mouthSegment();
    Object.assign(seaBody, { x: link.bx, y: link.by, vx: 0, vy: 0 });
    Object.assign(poolBody, { x: link.ax, y: link.ay, vx: 0, vy: 0 });
    world.elapsed = 270;
    world.tick = 2;
    syncTide(world.elapsed);
    expect(tideConnectedAt(world.elapsed)).toBe(false);
    expect(isInPool((link.ax + link.bx) / 2, (link.ay + link.by) / 2)).toBe(false);
    const seaBefore = inSea(seaBody.x, seaBody.y);
    const poolBefore = inSea(poolBody.x, poolBody.y);
    for (let step = 0; step < 90; step++) stepWorld(world);
    expect(inSea(seaBody.x, seaBody.y)).toBe(seaBefore);
    expect(inSea(poolBody.x, poolBody.y)).toBe(poolBefore);
    expect(world.ecologyLedger.tideArrivals).toBe(0);
    expect(world.ecologyLedger.tideDepartures).toBe(0);
  });

  it('keeps the sea population bounded', () => {
    const world = createWorld(5);
    expect(seaBodyCount(world)).toBeLessThanOrEqual(SEA_BODY_CAP);
    for (let step = 0; step < 3240; step++) stepWorld(world);
    expect(seaBodyCount(world)).toBeLessThanOrEqual(SEA_BODY_CAP + 4);
    expect(world.organisms.length).toBeLessThanOrEqual(42);
  });
});
