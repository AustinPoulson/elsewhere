import { describe, expect, it } from 'vitest';
import { applyCurrent, currentStrength } from '../src/world/actions/current';
import { applyCurrentDrift } from '../src/world/currents';
import { createWorld, stepWorld } from '../src/world/simulation';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { FIXED_STEP, isInPool, type Current, type World } from '../src/world/types';

const start = { x: 660, y: 500 };
const end = { x: 780, y: 500 };
function current(world: World): Current { expect(applyCurrent(world, start, end).status).toBe('applied'); return world.currents.at(-1)!; }
function run(world: World, steps: number) { for (let i = 0; i < steps; i++) stepWorld(world); }

describe('stir a bounded current', () => {
  it('stores one midpoint direction and consumes only an ID, even while the world is paused', () => {
    const world = createWorld(41);
    const before = structuredClone(world);
    const result = applyCurrent(world, start, end);
    expect(result).toEqual({ status: 'applied', currentId: before.nextId });
    expect(world.currents).toEqual([{ id: before.nextId, x: 720, y: 500, dx: 1, dy: 0, startedAt: 0, duration: 8, radius: 110 }]);
    expect({ ...world, nextId: before.nextId, currents: [] }).toEqual(before);
    expect(currentStrength(world.currents[0], 0)).toBe(1);
    expect(currentStrength(world.currents[0], 4)).toBe(.5);
    expect(currentStrength(world.currents[0], 8)).toBe(0);
    expect(currentStrength(world.currents[0], -1)).toBe(0);
  });

  it('rejects short, long, nonfinite and outside gestures atomically, enforces the cap and ID headroom', () => {
    const world = createWorld();
    for (const destination of [{ x: 683.99, y: 500 }, { x: 901, y: 500 }, { x: NaN, y: 500 }, { x: 720, y: Infinity }, { x: 0, y: 0 }]) {
      const before = serializeWorld(world);
      expect(applyCurrent(world, start, destination).status).toBe('invalid');
      expect(serializeWorld(world)).toBe(before);
    }
    expect(applyCurrent(world, start, { x: 684, y: 500 }).status).toBe('applied');
    expect(applyCurrent(world, start, { x: 900, y: 500 }).status).toBe('applied');
    current(world);
    const full = serializeWorld(world);
    expect(applyCurrent(world, start, end).status).toBe('full');
    expect(serializeWorld(world)).toBe(full);
    world.elapsed = 8;
    expect(applyCurrent(world, start, end).status).toBe('applied');
    expect(world.currents).toHaveLength(1);
    world.currents = []; world.nextId = Number.MAX_SAFE_INTEGER;
    const exhausted = serializeWorld(world);
    expect(applyCurrent(world, start, end).status).toBe('exhausted');
    expect(serializeWorld(world)).toBe(exhausted);
  });

  it('sums and clamps drift, carries pigment more slowly, and leaves resources, homes and swimming velocity alone', () => {
    const world = createWorld();
    Object.assign(world.organisms[0], { x: 720, y: 500 });
    Object.assign(world.grazers[0], { x: 720, y: 500 });
    Object.assign(world.sediment[0], { x: 720, y: 500 });
    for (let i = 0; i < 3; i++) current(world);
    const before = structuredClone(world);
    applyCurrentDrift(world, .25);
    expect(world.organisms[0].x - before.organisms[0].x).toBeCloseTo(4, 12);
    expect(world.grazers[0].x - before.grazers[0].x).toBeCloseTo(4, 12);
    expect(world.sediment[0].x - before.sediment[0].x).toBeCloseTo(1.4, 12);
    expect(world.lights).toEqual(before.lights); expect(world.nests).toEqual(before.nests);
    for (const key of ['organisms', 'grazers', 'sediment'] as const) {
      expect(world[key].map(({ x: _x, y: _y, ...rest }) => rest)).toEqual(before[key].map(({ x: _x, y: _y, ...rest }) => rest));
    }
    expect(world.elapsed).toBe(before.elapsed); expect(world.randomState).toBe(before.randomState);
    expect(world.nextId).toBe(before.nextId); expect(world.consumed).toBe(before.consumed);
  });

  it('confines displaced bodies at the coast and removes expired currents without ongoing motion', () => {
    const world = createWorld();
    const body = world.organisms[0];
    Object.assign(body, { x: 720, y: 500 });
    while (isInPool(body.x + 1, body.y, body.size + 3)) body.x++;
    const id = world.nextId++;
    world.currents = [{ id, x: body.x, y: body.y, dx: 1, dy: 0, startedAt: 0, duration: 8, radius: 110 }];
    const velocity = { vx: body.vx, vy: body.vy };
    applyCurrentDrift(world, .25);
    expect(isInPool(body.x, body.y, body.size + 3)).toBe(true);
    expect({ vx: body.vx, vy: body.vy }).toEqual(velocity);
    world.elapsed = 8;
    const position = { x: body.x, y: body.y };
    applyCurrentDrift(world, .25);
    expect(world.currents).toEqual([]);
    expect({ x: body.x, y: body.y }).toEqual(position);
  });

  it('keeps repeated overlapping strokes bounded and every moving collection restorable', () => {
    const world = createWorld(94);
    for (let tick = 0; tick < 3000; tick++) {
      if (tick % 30 === 0) applyCurrent(world, start, end);
      stepWorld(world);
      expect(world.currents.length).toBeLessThanOrEqual(3);
      if (tick % 300 === 0) expect(restoreWorld(serializeWorld(world))).toEqual(world);
    }
    expect(serializeWorld(world).length).toBeLessThan(1_000_000);
    run(world, 241);
    expect(world.currents).toEqual([]);
    expect(restoreWorld(serializeWorld(world))).toEqual(world);
  });

  it('redistributes a grazer toward existing food so its next ordinary feeding step transfers pigment', () => {
    const still = createWorld(83);
    still.organisms = [still.organisms[0]]; still.lights = [];
    still.grazers = [still.grazers[0]]; still.nests = [still.nests[0]];
    const grazer = still.grazers[0];
    Object.assign(grazer, { x: 720, y: 500, vx: 0, vy: 0 });
    Object.assign(still.nests[0], { x: 650, y: 500 });
    still.sediment = [{ id: still.nextId++, x: 720 + grazer.size + 5 + 5 + .25, y: 500, radius: 5, strength: .9, age: 0, hue: 210 }];
    const stirred = structuredClone(still);
    current(stirred);
    // First drift puts only the stirred grazer inside normal feeding reach.
    stepWorld(still); stepWorld(stirred);
    expect(still.grazers[0].cargo).toBe(0); expect(stirred.grazers[0].cargo).toBe(0);
    stepWorld(still); stepWorld(stirred);
    expect(still.grazers[0].cargo).toBe(0);
    expect(stirred.grazers[0].cargo).toBeGreaterThan(0);
    const gathered = stirred.grazers[0].cargo;
    expect(still.sediment[0].strength - stirred.sediment[0].strength).toBeCloseTo(gathered * Math.exp(-FIXED_STEP * .0013), 12);
    expect(stirred.lights).toEqual(still.lights);
  });
});

describe('current save revisions', () => {
  it('preserves active fields and PRNG through save/resume and normalizes valid expiration', () => {
    const world = createWorld(63); current(world); run(world, 45);
    const restored = restoreWorld(serializeWorld(world))!;
    expect(restored).toEqual(world);
    run(world, 300); run(restored, 300);
    expect(restored).toEqual(world); expect(world.currents).toEqual([]);
    current(world); world.elapsed += 8;
    const expired = restoreWorld(serializeWorld(world))!;
    expect(expired.currents).toEqual([]);
    expect(expired.nextId).toBe(world.nextId);
    expect({ ...expired, currents: world.currents }).toEqual(world);
  });

  it('migrates actual revision1 without dropping an active rain call or changing old ecology', () => {
    const world = createWorld(84);
    const { currents: _currents, skimmers: _skimmers, skimmerAdmissionAt: _admission, ecologyLedger: _ledger, reedwells: _reedwells, reedwellAdmissionAt: _reedwellAdmission, reedwellCandidateAfterId: _reedwellCandidate, organisms, ...rest } = world;
    const previous = { ...rest, organisms: organisms.map(({ pigmentCredit: _credit, ...entry }) => entry), schemaRevision: 1, elapsed: 12, weatherCall: { startedAt: 10, nextAllowedAt: 70 } };
    const snapshot = JSON.stringify(previous);
    const migrated = restoreWorld(snapshot)!;
    expect(migrated).toEqual({ ...world, elapsed: 12, schemaRevision: 4, skimmerAdmissionAt: 12, reedwellAdmissionAt: 12, weatherCall: previous.weatherCall, currents: [] });
    expect(JSON.stringify(previous)).toBe(snapshot);
    expect(restoreWorld(serializeWorld(migrated))).toEqual(migrated);
  });

  it('rejects malformed, future, hybrid and globally duplicate current records before expiration cleanup', () => {
    const mutations: ((world: Record<string, any>) => void)[] = [
      w => { delete w.currents; }, w => { w.currents = null; }, w => { w.schemaRevision = 5; },
      w => { w.currents[0].x = 0; }, w => { w.currents[0].dx = .5; }, w => { w.currents[0].dy = NaN; },
      w => { w.currents[0].radius = 111; }, w => { w.currents[0].duration = 9; },
      w => { w.currents[0].startedAt = 1; }, w => { w.currents[0].startedAt = -1; },
      w => { w.currents[0].id = w.organisms[0].id; }, w => { w.currents[0].id = w.nextId; },
      w => { w.currents.push(...Array.from({ length: 3 }, () => w.currents[0])); },
      w => { w.schemaRevision = 1; }, w => { w.version = 2; },
      w => { w.elapsed = 9; w.currents[0].dx = 5; },
      w => { w.elapsed = 9; w.currents.push({ ...w.currents[0] }); },
    ];
    for (const mutate of mutations) {
      const world = createWorld(); current(world); mutate(world);
      expect(restoreWorld(serializeWorld(world))).toBeNull();
    }
  });
});
