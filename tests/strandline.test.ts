import { describe, expect, it } from 'vitest';
import { applyCurrentDrift } from '../src/world/currents';
import {
  STRANDLINE,
  compactStrandline,
  inStrandline,
  leachStrandline,
  pigmentOnStrandline,
  shouldSettleWrack,
  strandlineAnchor,
  strandlineBodyCount,
  strandlineInSea,
  strandlineNote,
  strandlineSettleVelocity,
} from '../src/world/environment/strandline';
import { inSea, mouthSegment, syncTide, tideFlowAt, tideRegion } from '../src/world/habitat';
import { pigmentInSea, pigmentOnShore } from '../src/world/environment/tide';
import { createWorld, getStats, stepWorld } from '../src/world/simulation';
import { SCHEMA_REVISION, STRANDLINE_GRAIN_CAP, STRANDLINE_REMAIN_CAP } from '../src/world/types';
import { runHarness } from '../scripts/harness';

function locatedPigment(world: ReturnType<typeof createWorld>): number {
  return pigmentInSea(world) + pigmentOnShore(world);
}

describe('strandline wrack', () => {
  it('sits on the sea side of the north mouth, not in the pool', () => {
    expect(strandlineInSea()).toBe(true);
    const center = strandlineAnchor();
    expect(inSea(center.x, center.y)).toBe(true);
    expect(inStrandline(center.x, center.y)).toBe(true);
    expect(inStrandline(720, 500)).toBe(false);
    expect(STRANDLINE.grainCap).toBe(STRANDLINE_GRAIN_CAP);
    expect(STRANDLINE.remainCap).toBe(STRANDLINE_REMAIN_CAP);
  });

  it('opens empty: no gifted wrack, and opening sea lives miss the band', () => {
    const world = createWorld(7);
    expect(world.schemaRevision).toBe(SCHEMA_REVISION);
    expect(pigmentOnStrandline(world)).toBe(0);
    expect(strandlineBodyCount(world)).toBe(0);
    expect(world.sediment.filter((grain) => inStrandline(grain.x, grain.y))).toHaveLength(0);
    expect(world.organisms.filter((body) => inStrandline(body.x, body.y))).toHaveLength(0);
    expect(world.ecologyLedger.strandlineSettled).toBe(0);
    expect(world.ecologyLedger.strandlineLeached).toBe(0);
    expect(getStats(world).strandlinePigment).toBe(0);
    expect(strandlineNote(world)).toMatch(/strandline/i);
  });

  it('pulls ebbing sea-side grains toward the wrack without drawing the PRNG', () => {
    const world = createWorld(1);
    world.elapsed = 140;
    world.tick = 2;
    syncTide(world.elapsed);
    expect(tideFlowAt(world.elapsed)).toBeGreaterThan(0);
    const wrack = strandlineAnchor();
    const grain = world.sediment[0];
    Object.assign(grain, { x: wrack.x + 28, y: wrack.y, strength: 0.28 });
    expect(inSea(grain.x, grain.y)).toBe(true);
    expect(inStrandline(grain.x, grain.y)).toBe(true);
    expect(shouldSettleWrack(grain, world.elapsed)).toBe(true);
    const before = { x: grain.x, y: grain.y };
    const held = locatedPigment(world);
    const rng = world.randomState;
    const velocity = strandlineSettleVelocity(grain, world.elapsed);
    expect(Math.hypot(velocity.x, velocity.y)).toBeGreaterThan(0);
    applyCurrentDrift(world, 1 / 30);
    expect(world.randomState).toBe(rng);
    expect(Math.hypot(grain.x - wrack.x, grain.y - wrack.y)).toBeLessThan(
      Math.hypot(before.x - wrack.x, before.y - wrack.y),
    );
    expect(locatedPigment(world)).toBeCloseTo(held, 6);
  });

  it('leaves the open mouth as a corridor', () => {
    const world = createWorld(1);
    const link = mouthSegment();
    world.elapsed = 140;
    world.tick = 2;
    syncTide(world.elapsed);
    expect(tideFlowAt(world.elapsed)).toBeGreaterThan(0);
    const grain = world.sediment[0];
    Object.assign(grain, { x: (link.ax + link.bx) / 2, y: (link.ay + link.by) / 2, strength: 0.28 });
    expect(inStrandline(grain.x, grain.y)).toBe(false);
    expect(shouldSettleWrack(grain, world.elapsed)).toBe(false);
    expect(
      Math.hypot(strandlineSettleVelocity(grain, world.elapsed).x, strandlineSettleVelocity(grain, world.elapsed).y),
    ).toBe(0);
  });

  it('lets a flood carry wrack back into the pool', () => {
    const world = createWorld(11);
    const link = mouthSegment();
    const grain = world.sediment[0];
    Object.assign(grain, { x: link.bx, y: link.by, strength: 0.22 });
    world.elapsed = 40;
    world.tick = 2;
    syncTide(world.elapsed);
    expect(tideFlowAt(world.elapsed)).toBeLessThan(0);
    expect(shouldSettleWrack(grain, world.elapsed)).toBe(false);
    let returned = false;
    for (let step = 0; step < 3600; step++) {
      const before = tideRegion(grain.x, grain.y);
      stepWorld(world);
      const next = tideRegion(grain.x, grain.y);
      if (before === 'sea' && (next === 'pool' || next === 'mouth')) {
        returned = true;
        break;
      }
    }
    expect(returned).toBe(true);
    expect(world.ecologyLedger.tidePigmentIn).toBeGreaterThan(0);
  });

  it('compacts and leaches already-paid color without granting pigment', () => {
    const world = createWorld(3);
    const wrack = strandlineAnchor();
    world.tick = 8;
    world.sediment = [
      { id: 1, x: wrack.x - 4, y: wrack.y, radius: 6, hue: 40, strength: 0.09, age: 0 },
      { id: 2, x: wrack.x + 4, y: wrack.y, radius: 6, hue: 80, strength: 0.09, age: 0 },
      { id: 3, x: 720, y: -120, radius: 6, hue: 168, strength: 0.2, age: 0 },
    ];
    const held = locatedPigment(world);
    const rng = world.randomState;
    compactStrandline(world);
    expect(world.randomState).toBe(rng);
    expect(locatedPigment(world)).toBeCloseTo(held, 9);
    const onBand = world.sediment.filter((grain) => inStrandline(grain.x, grain.y));
    expect(Math.max(...onBand.map((grain) => grain.strength))).toBeGreaterThan(0.09);
    world.tick = 10;
    const settled = world.ecologyLedger.strandlineLeached;
    leachStrandline(world);
    expect(world.randomState).toBe(rng);
    expect(locatedPigment(world)).toBeCloseTo(held, 9);
    expect(world.ecologyLedger.strandlineLeached).toBeGreaterThanOrEqual(settled);
  });

  it('keeps ledgers balanced on a short harness run', () => {
    const report = runHarness({ days: 2, seed: 1, visitorLight: false });
    expect(report.conservationCheck.remainsBalanced).toBe(true);
    expect(report.conservationCheck.fossilsBalanced).toBe(true);
    expect(report.conservationCheck.seamBalanced).toBe(true);
    expect(report.conservationCheck.tidePartitioned).toBe(true);
    expect(report.conservationCheck.strandlinePartitioned).toBe(true);
    expect(report.resources.strandlinePigment).toBeLessThanOrEqual(report.resources.seaPigment + 1e-9);
  });
});
