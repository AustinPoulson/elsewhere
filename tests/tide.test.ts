import { describe, expect, it } from 'vitest';
import {
  OPENING_POOL,
  POCKET_POOL,
  SEA_POOL,
  TIDE_CONNECT,
  TIDE_FLOW,
  TIDE_INFLUENCE,
  TIDE_PERIOD,
  TIDE_POCKET_CONNECT,
  TIDE_POCKET_EBB_CONNECT,
  TIDE_POCKET_INFLUENCE,
  TIDE_POCKET_MOUTH_WIDTH,
  inInletPool,
  inOpeningPool,
  inPocket,
  inSea,
  isInPool,
  mouthSegment,
  pocketConnectedAt,
  pocketEbbAt,
  pocketFlowAt,
  pocketMouthSegment,
  sharesPocketColor,
  pocketVelocity,
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
  pocketBodyCount,
  pocketNote,
  SEA_LUCENTS,
  seaBodyCount,
  seaLucentCount,
  tideNameAt,
  tideNote,
} from '../src/world/environment/tide';
import { createWorld, getStats, stepWorld } from '../src/world/simulation';
import { baselineTraits } from '../src/world/traits';
import { POCKET_BODY_CAP, SEA_BODY_CAP, type Point } from '../src/world/types';

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

  it('opens a higher rock pool on the opposite tide from the opening shore', () => {
    expect(TIDE_POCKET_CONNECT).toBeGreaterThan(TIDE_CONNECT);
    expect(pocketConnectedAt(0)).toBe(false);
    expect(pocketConnectedAt(90)).toBe(false);
    expect(tideConnectedAt(90)).toBe(true);
    expect(pocketConnectedAt(240)).toBe(true);
    expect(tideConnectedAt(240)).toBe(false);
    expect(pocketFlowAt(240)).toBeLessThan(0);
    expect(pocketConnectedAt(270)).toBe(false);
    expect(TIDE_POCKET_EBB_CONNECT).toBeGreaterThan(TIDE_POCKET_CONNECT);
    expect(pocketConnectedAt(280)).toBe(true);
    expect(pocketEbbAt(280)).toBe(true);
    expect(pocketFlowAt(280)).toBeGreaterThan(0);
    expect(pocketNote(240)).toMatch(/open to the sea/);
    expect(pocketNote(270)).toMatch(/cut off/);
    expect(pocketNote(280)).toMatch(/leaking slowly/);
    expect(pocketNote(90)).toMatch(/cut off/);
    const mouth = pocketMouthSegment();
    const mid = { x: (mouth.ax + mouth.bx) / 2, y: (mouth.ay + mouth.by) / 2 };
    syncTide(90);
    expect(isInPool(mid.x, mid.y)).toBe(false);
    syncTide(240);
    expect(isInPool(mid.x, mid.y)).toBe(true);
    syncTide(270);
    expect(isInPool(mid.x, mid.y)).toBe(false);
    syncTide(40);
    expect(isInPool(mid.x, mid.y)).toBe(false);
    expect(inPocket(POCKET_POOL.x, POCKET_POOL.y)).toBe(true);
    expect(sharesPocketColor(POCKET_POOL.x, POCKET_POOL.y, POCKET_POOL.x + 8, POCKET_POOL.y)).toBe(true);
    expect(sharesPocketColor(POCKET_POOL.x, POCKET_POOL.y, OPENING_POOL.x, OPENING_POOL.y)).toBe(false);
  });

  it('opens empty and fills only from conserved crossings', () => {
    const world = createWorld(7);
    expect(world.organisms.filter((entry) => inPocket(entry.x, entry.y))).toHaveLength(0);
    expect(world.sediment.filter((entry) => inPocket(entry.x, entry.y))).toHaveLength(0);
    expect(pigmentInPocket(world)).toBe(0);
    expect(world.ecologyLedger.pocketArrivals).toBe(0);
    expect(world.ecologyLedger.pocketDepartures).toBe(0);
    expect(inOpeningPool(POCKET_POOL.x, POCKET_POOL.y)).toBe(false);
    expect(inSea(POCKET_POOL.x, POCKET_POOL.y)).toBe(false);
    expect(inInletPool(POCKET_POOL.x, POCKET_POOL.y)).toBe(false);
  });

  it('keeps the rock pool a separate basin with an interior beyond the mouth', () => {
    const mouth = pocketMouthSegment();
    const corridor = Math.hypot(mouth.bx - mouth.ax, mouth.by - mouth.ay);
    expect(corridor).toBeGreaterThan(80);
    expect(inOpeningPool(POCKET_POOL.x, POCKET_POOL.y)).toBe(false);
    expect(inSea(POCKET_POOL.x, POCKET_POOL.y)).toBe(false);
    const reach = TIDE_POCKET_MOUTH_WIDTH / 2 + TIDE_POCKET_INFLUENCE;
    const abx = mouth.bx - mouth.ax;
    const aby = mouth.by - mouth.ay;
    const span = abx * abx + aby * aby;
    const t =
      span === 0
        ? 0
        : Math.min(1, Math.max(0, ((POCKET_POOL.x - mouth.ax) * abx + (POCKET_POOL.y - mouth.ay) * aby) / span));
    const dist = Math.hypot(POCKET_POOL.x - (mouth.ax + t * abx), POCKET_POOL.y - (mouth.ay + t * aby));
    expect(dist).toBeGreaterThan(reach);
    for (const pool of [OPENING_POOL, SEA_POOL]) {
      const dx = POCKET_POOL.x - pool.x;
      const dy = POCKET_POOL.y - pool.y;
      expect(Math.hypot(dx / (pool.rx + POCKET_POOL.rx), dy / (pool.ry + POCKET_POOL.ry))).toBeGreaterThan(0.85);
    }
  });

  it('keeps the sea opening lucents from washing into the rock pool', () => {
    const world = createWorld(1);
    expect(seaLucentCount(world)).toBe(SEA_LUCENTS);
    world.elapsed = 240;
    world.tick = 3;
    syncTide(world.elapsed);
    for (let step = 0; step < 240; step++) stepWorld(world);
    expect(seaLucentCount(world)).toBeGreaterThanOrEqual(SEA_LUCENTS);
    expect(world.organisms.filter((entry) => inPocket(entry.x, entry.y))).toHaveLength(0);
  });

  it('lets a visitor carry its own reserves through the pocket mouth', () => {
    const world = createWorld(1);
    const link = pocketMouthSegment();
    const body = {
      id: world.nextId++,
      species: 'marlgrub' as const,
      x: link.bx + link.ux * 16,
      y: link.by + link.uy * 16,
      vx: 0,
      vy: 0,
      body: 0.1 as const,
      reserve: 0.28,
      age: 10,
      hue: 40,
      starvedFor: 0,
      targetRemainId: null,
      parentId: null,
      nextBirthAt: 100,
      traits: baselineTraits(),
    };
    world.marlgrubs.push(body);
    world.elapsed = 240;
    world.tick = 3;
    syncTide(world.elapsed);
    expect(tideRegion(body.x, body.y)).toBe('sea');
    const reserve = body.reserve;
    let arrived = false;
    for (let step = 0; step < 720; step++) {
      const before = tideRegion(body.x, body.y);
      const held = locatedPigment(world);
      const pigmentIn = world.ecologyLedger.pocketPigmentIn;
      stepWorld(world);
      const next = tideRegion(body.x, body.y);
      if (before === 'sea' && (next === 'pocket' || next === 'pocketMouth')) {
        arrived = true;
        expect(body.reserve).toBeCloseTo(reserve, 3);
        expect(world.ecologyLedger.pocketArrivals).toBeGreaterThanOrEqual(1);
        expect(world.ecologyLedger.pocketPigmentIn).toBeGreaterThanOrEqual(pigmentIn);
        expect(Math.abs(locatedPigment(world) - held)).toBeLessThan(0.02);
        break;
      }
    }
    expect(arrived).toBe(true);
    expect(getStats(world).pocketConnected).toBe(true);
  });

  it('writes the same pocket velocity into an out point as the allocating form', () => {
    const link = pocketMouthSegment();
    const samples: Point[] = [
      { x: link.ax, y: link.ay },
      { x: (link.ax + link.bx) / 2, y: (link.ay + link.by) / 2 },
      { x: link.bx, y: link.by },
      { x: POCKET_POOL.x, y: POCKET_POOL.y },
      { x: 200, y: 200 },
    ];
    const out = { x: 1, y: 1 };
    for (const elapsed of [0, 40, 90, 140, 270]) {
      for (const body of samples) {
        const allocated = pocketVelocity(body, elapsed, 1);
        const written = pocketVelocity(body, elapsed, 1, out);
        expect(written).toBe(out);
        expect(out).toEqual(allocated);
        if (elapsed === 40 || elapsed === 90) expect(allocated).toEqual({ x: 0, y: 0 });
      }
    }
  });

  it('keeps the pocket population bounded', () => {
    const world = createWorld(5);
    expect(pocketBodyCount(world)).toBe(0);
    for (let step = 0; step < 3240; step++) stepWorld(world);
    expect(pocketBodyCount(world)).toBeLessThanOrEqual(POCKET_BODY_CAP + 2);
  });
});
