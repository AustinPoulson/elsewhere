import { describe, expect, it } from 'vitest';
import { applyCurrentDrift } from '../src/world/currents';
import {
  INLET_POOL,
  OPENING_POOL,
  channelSegment,
  inInletPool,
  inOpeningPool,
  isInPool,
  linkedHabitat,
} from '../src/world/habitat';
import { confinePosition } from '../src/world/geometry';
import { createWorld, stepWorld } from '../src/world/simulation';
import { SCHEMA_REVISION } from '../src/world/types';

const CHANNEL_QUARTER = 45;

describe('linked habitat', () => {
  it('keeps the opening tidepool and adds a southern inlet joined by a channel', () => {
    const habitat = linkedHabitat();
    expect(habitat.pools).toHaveLength(2);
    expect(habitat.channel.from).toBe(1);
    expect(habitat.channel.to).toBe(2);
    expect(isInPool(OPENING_POOL.x, OPENING_POOL.y)).toBe(true);
    expect(isInPool(INLET_POOL.x, INLET_POOL.y)).toBe(true);
    const link = channelSegment();
    expect(isInPool((link.ax + link.bx) / 2, (link.ay + link.by) / 2)).toBe(true);
    expect(isInPool(200, 1300)).toBe(false);
    expect(isInPool(400, 1000)).toBe(false);
  });

  it('opens with life and pigment only in the first pool', () => {
    const world = createWorld(7);
    expect(world.schemaRevision).toBe(SCHEMA_REVISION);
    expect(world.pools).toEqual(linkedHabitat().pools);
    expect(world.organisms.every((entry) => inOpeningPool(entry.x, entry.y, entry.size + 3))).toBe(true);
    expect(world.grazers.every((entry) => inOpeningPool(entry.x, entry.y, entry.size + 3))).toBe(true);
    expect(world.sediment.every((entry) => inOpeningPool(entry.x, entry.y))).toBe(true);
    expect(world.organisms.some((entry) => inInletPool(entry.x, entry.y))).toBe(false);
    expect(world.sediment.some((entry) => inInletPool(entry.x, entry.y))).toBe(false);
  });

  it('carries pigment through the channel instead of teleporting it', () => {
    const world = createWorld(9);
    world.elapsed = CHANNEL_QUARTER;
    const link = channelSegment();
    const grain = world.sediment[0];
    Object.assign(grain, { x: link.ax, y: link.ay, strength: 0.4 });
    const startY = grain.y;
    applyCurrentDrift(world, 0.5);
    expect(grain.y).toBeGreaterThan(startY);
    expect(grain.x).not.toBe(INLET_POOL.x);
    expect(grain.y).not.toBe(INLET_POOL.y);
    expect(isInPool(grain.x, grain.y)).toBe(true);
  });

  it('lets a drifting body follow the same current into the inlet', () => {
    const world = createWorld(11);
    world.elapsed = CHANNEL_QUARTER;
    const link = channelSegment();
    const body = world.organisms[0];
    Object.assign(body, { x: link.ax, y: link.ay, vx: 0, vy: 0 });
    for (let step = 0; step < 240; step++) applyCurrentDrift(world, 1 / 30);
    expect(body.y).toBeGreaterThan(link.ay + 20);
    expect(isInPool(body.x, body.y, body.size + 3)).toBe(true);
  });

  it('confines a point outside the inlet back into water', () => {
    const point = { x: INLET_POOL.x + 400, y: INLET_POOL.y };
    confinePosition(point, 0);
    expect(isInPool(point.x, point.y)).toBe(true);
    expect(inInletPool(point.x, point.y) || isInPool(point.x, point.y)).toBe(true);
  });

  it('does not invent organisms while the world steps with an empty inlet', () => {
    const world = createWorld(3);
    const before = world.organisms.length;
    for (let i = 0; i < 30; i++) stepWorld(world);
    expect(world.organisms.length).toBe(before);
    expect(world.sediment.some((entry) => inInletPool(entry.x, entry.y))).toBe(false);
  });
});
