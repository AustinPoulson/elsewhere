import { describe, expect, it } from 'vitest';
import { applyCurrentDrift } from '../src/world/currents';
import {
  CHANNEL_INFLUENCE,
  INLET_POOL,
  OPENING_POOL,
  channelFlowAt,
  channelSegment,
  channelVelocity,
  containingPool,
  inInletPool,
  inOpeningPool,
  isInPool,
  linkedHabitat,
  poolCoastPoint,
  waterSdf,
} from '../src/world/habitat';
import { confinePosition } from '../src/world/geometry';
import { createWorld, stepWorld } from '../src/world/simulation';
import { SCHEMA_REVISION, WORLD_HEIGHT, WORLD_WIDTH, poolRadius, type Point } from '../src/world/types';

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

  it('matches waterSdf containment across both pools, coasts, and the channel seam', () => {
    let maxRadius = 0;
    for (let i = 0; i <= 360_000; i++) maxRadius = Math.max(maxRadius, poolRadius((i / 360_000) * Math.PI * 2));
    expect(maxRadius).toBeGreaterThan(1.08);
    expect(maxRadius).toBeLessThan(1.11);

    let mismatches = 0;
    for (const margin of [0, 11, 18]) {
      for (let y = 0; y <= WORLD_HEIGHT; y += 4) {
        for (let x = 0; x <= WORLD_WIDTH; x += 4) {
          const inside = waterSdf(x, y, margin) <= 0;
          if (isInPool(x, y, margin) !== inside) mismatches++;
          const pool = containingPool(x, y, margin);
          const opening = inOpeningPool(x, y, margin);
          const inlet = inInletPool(x, y, margin);
          if (opening && pool !== OPENING_POOL) mismatches++;
          if (!opening && inlet && pool !== INLET_POOL) mismatches++;
          if (!opening && !inlet && pool !== null) mismatches++;
        }
      }
    }
    const link = channelSegment();
    for (const margin of [0, 11, 18]) {
      for (let i = 0; i <= 720; i++) {
        const angle = (i / 720) * Math.PI * 2;
        for (const scale of [0.94, 0.999, 1, 1.001, 1.06]) {
          for (const pool of [OPENING_POOL, INLET_POOL]) {
            const point = poolCoastPoint(pool, angle, scale);
            if (isInPool(point.x, point.y, margin) !== waterSdf(point.x, point.y, margin) <= 0) mismatches++;
          }
        }
      }
      for (let i = 0; i <= 400; i++) {
        const t = i / 400;
        const x = link.ax + (link.bx - link.ax) * t;
        const y = link.ay + (link.by - link.ay) * t;
        for (const offset of [-80, -36, -20, 0, 20, 36, 64, 80]) {
          const px = x - link.uy * offset;
          const py = y + link.ux * offset;
          if (isInPool(px, py, margin) !== waterSdf(px, py, margin) <= 0) mismatches++;
        }
      }
    }
    expect(mismatches).toBe(0);
  });

  it('writes the same channel velocity into an out point as the allocating form', () => {
    function reference(body: Point, elapsed: number, scale: number): Point {
      const link = channelSegment();
      const abx = link.bx - link.ax;
      const aby = link.by - link.ay;
      const span = abx * abx + aby * aby;
      const t = span === 0 ? 0 : Math.min(1, Math.max(0, ((body.x - link.ax) * abx + (body.y - link.ay) * aby) / span));
      const sdf = Math.hypot(body.x - (link.ax + t * abx), body.y - (link.ay + t * aby)) - link.width / 2;
      if (sdf > CHANNEL_INFLUENCE) return { x: 0, y: 0 };
      const strength = sdf <= 0 ? 1 : 1 - sdf / CHANNEL_INFLUENCE;
      const flow = channelFlowAt(elapsed) * strength * scale;
      return { x: link.ux * flow, y: link.uy * flow };
    }
    const link = channelSegment();
    const samples: Point[] = [
      { x: OPENING_POOL.x, y: OPENING_POOL.y },
      { x: INLET_POOL.x, y: INLET_POOL.y },
      { x: (link.ax + link.bx) / 2, y: (link.ay + link.by) / 2 },
      { x: link.ax, y: link.ay },
      { x: link.bx, y: link.by },
      { x: 200, y: 200 },
      { x: 400, y: 1000 },
    ];
    const out = { x: 1, y: 1 };
    for (const elapsed of [0, 45, 90, 135]) {
      for (const body of samples) {
        const allocated = channelVelocity(body, elapsed, 1);
        const written = channelVelocity(body, elapsed, 1, out);
        const expected = reference(body, elapsed, 1);
        expect(allocated).toEqual(expected);
        expect(written).toBe(out);
        expect(out).toEqual(expected);
      }
    }
  });

  it('keeps paired current-drift trajectories identical across both pools and the channel', () => {
    const world = createWorld(29);
    expect(world.schemaRevision).toBe(SCHEMA_REVISION);
    world.elapsed = 45;
    const link = channelSegment();
    const grain = world.sediment[0];
    world.sediment = [
      { ...grain, x: OPENING_POOL.x, y: OPENING_POOL.y },
      { ...grain, id: world.nextId++, x: INLET_POOL.x, y: INLET_POOL.y },
      { ...grain, id: world.nextId++, x: (link.ax + link.bx) / 2, y: (link.ay + link.by) / 2 },
      { ...grain, id: world.nextId++, x: link.ax, y: link.ay },
      { ...grain, id: world.nextId++, x: 240, y: 180 },
    ];
    Object.assign(world.organisms[0], { x: link.ax, y: link.ay, vx: 0, vy: 0 });
    const clone = structuredClone(world);
    for (let step = 0; step < 240; step++) {
      applyCurrentDrift(world, 1 / 30);
      applyCurrentDrift(clone, 1 / 30);
    }
    expect(clone).toEqual(world);
    expect(world.schemaRevision).toBe(SCHEMA_REVISION);
  });
});
