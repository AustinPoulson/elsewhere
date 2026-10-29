import { describe, expect, it } from 'vitest';
import { CarryController } from '../src/app/carry';
import { moveLight, nearestLiveLight } from '../src/world/actions/light';
import { addLight, createWorld, stepWorld } from '../src/world/simulation';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { createShowerStudy } from '../src/app/study';

describe('carry a living light', () => {
  it('selects live sources within 30 units by distance, then stable ID including the boundary', () => {
    const world = createWorld();
    world.lights = [
      { ...world.lights[0], id: 9, x: 730, y: 500 },
      { ...world.lights[0], id: 2, x: 710, y: 500 },
      { ...world.lights[0], id: 1, x: 720, y: 500, energy: 0.01 },
    ];
    expect(nearestLiveLight(world, 720, 500)?.id).toBe(2);
    world.lights.reverse();
    expect(nearestLiveLight(world, 720, 500)?.id).toBe(2);
    expect(nearestLiveLight(world, 760, 500)?.id).toBe(9);
    expect(nearestLiveLight(world, 760.001, 500)).toBeUndefined();
    expect(nearestLiveLight(world, NaN, 500)).toBeUndefined();
    expect(nearestLiveLight(world, 720, 500, Infinity)).toBeUndefined();
  });

  it('changes coordinates only, preserving every resource, entity, clock and random state', () => {
    const world = createShowerStudy();
    // The historical rainy study has spent its lights; invite one in this disposable copy.
    addLight(world, 700, 520);
    const before = structuredClone(world);
    const light = world.lights[0];
    expect(moveLight(world, light.id, 720, 500)).toBe(true);
    before.lights[0].x = 720;
    before.lights[0].y = 500;
    expect(world).toEqual(before);
    expect(restoreWorld(serializeWorld(world))).toEqual(world);
  });

  it('carries a migrated v1 light without changing its legacy ecological history', () => {
    const original = createWorld(23);
    const legacy = { ...original, version: 1, grazers: undefined, nests: undefined, weatherCall: undefined, schemaRevision: undefined, currents: undefined,
      skimmers: undefined, skimmerAdmissionAt: undefined, skimmerCandidateAfterId: undefined, ecologyLedger: undefined, reedwells: undefined, reedwellAdmissionAt: undefined, reedwellCandidateAfterId: undefined, rainbells: undefined, rainbellAdmissionAt: undefined, rainbellCandidateAfterId: undefined, siltstitchers: undefined, siltstitcherAdmissionAt: undefined, siltstitcherCandidateAfterId: undefined,
      glassLimpets: undefined, glassLimpetAdmissionAt: undefined, glassLimpetCandidateAfterId: undefined,
      cargoMites: undefined, cargoMiteAdmissionAt: undefined, cargoMiteCandidateAfterId: undefined,
      nextFoundingTick: undefined, foundingTypeCursor: undefined,
      organisms: original.organisms.map(({ pigmentCredit: _credit, ...entry }) => entry) };
    const world = restoreWorld(JSON.stringify(legacy))!;
    expect(world).not.toBeNull();
    const before = structuredClone(world);
    expect(moveLight(world, world.lights[0].id, 720, 500)).toBe(true);
    before.lights[0].x = 720;
    before.lights[0].y = 500;
    expect(world).toEqual(before);
    expect(restoreWorld(serializeWorld(world))).toEqual(world);
  });
  it('rejects invalid destinations and missing or expired sources atomically', () => {
    const world = createWorld();
    for (const [x, y] of [[0, 0], [NaN, 500], [720, Infinity], [Infinity, 500]]) {
      const before = serializeWorld(world);
      expect(moveLight(world, world.lights[0].id, x, y)).toBe(false);
      expect(serializeWorld(world)).toBe(before);
    }
    for (const id of [-1, Number.NaN, 99999]) {
      const before = serializeWorld(world);
      expect(moveLight(world, id, 720, 500)).toBe(false);
      expect(serializeWorld(world)).toBe(before);
    }
    world.lights[0].energy = 0.01;
    const before = serializeWorld(world);
    expect(moveLight(world, world.lights[0].id, 720, 500)).toBe(false);
    expect(serializeWorld(world)).toBe(before);
  });

  it('keeps pointer and keyboard previews out of saves and cancels without mutation', () => {
    const world = createWorld();
    const controller = new CarryController();
    const before = serializeWorld(world);
    expect(controller.begin(world, world.lights[0].x, world.lights[0].y)).toBe(true);
    controller.update(720, 500);
    expect(controller.state?.x).toBe(720);
    expect(serializeWorld(world)).toBe(before);
    controller.cancel();
    expect(controller.state).toBeNull();
    expect(controller.commit(world)).toBe(false);
    expect(controller.begin(world, world.lights[0].x, world.lights[0].y, 'keyboard')).toBe(true);
    controller.nudge(20, -10);
    const view = controller.state!;
    view.x = 0;
    expect(controller.state?.x).not.toBe(0);
    expect(controller.state?.input).toBe('keyboard');
    expect(serializeWorld(world)).toBe(before);
    controller.cancel();
    expect(serializeWorld(world)).toBe(before);
  });

  it('commits once while paused and prevents stale gestures after replacement or expiry', () => {
    const world = createWorld();
    const controller = new CarryController();
    const light = world.lights[0];
    expect(controller.begin(world, light.x, light.y, 'keyboard')).toBe(true);
    controller.update(760, 540);
    expect(controller.commit(world)).toBe(true);
    expect(light).toMatchObject({ x: 760, y: 540 });
    expect(world.tick).toBe(0);
    expect(controller.commit(world)).toBe(false);
    controller.begin(world, light.x, light.y);
    controller.update(720, 500);
    const replacement = restoreWorld(serializeWorld(world))!;
    const beforeReplacement = serializeWorld(replacement);
    expect(controller.commit(replacement)).toBe(false);
    expect(serializeWorld(replacement)).toBe(beforeReplacement);
    controller.begin(world, light.x, light.y);
    controller.update(720, 500);
    light.energy = 0.01;
    const beforeExpiry = serializeWorld(world);
    expect(controller.commit(world)).toBe(false);
    expect(serializeWorld(world)).toBe(beforeExpiry);
  });

  it('cancels an invalid drop and a missed new selection without touching the world', () => {
    const world = createWorld();
    const controller = new CarryController();
    const light = world.lights[0];
    const before = serializeWorld(world);
    controller.begin(world, light.x, light.y);
    controller.update(0, 0);
    expect(controller.commit(world)).toBe(false);
    expect(controller.state).toBeNull();
    controller.begin(world, light.x, light.y);
    expect(controller.begin(world, 0, 0)).toBe(false);
    expect(controller.state).toBeNull();
    expect(serializeWorld(world)).toBe(before);
  });

  it('redirects two lucents toward a moved source within ten simulation seconds', () => {
    const world = createWorld(7);
    world.organisms = world.organisms.slice(0, 2);
    world.grazers = [];
    world.nests = [];
    world.sediment = [];
    world.lights = [world.lights[0]];
    Object.assign(world.lights[0], { x: 520, y: 500 });
    world.organisms.forEach((creature, index) => {
      Object.assign(creature, { x: 650, y: 450 + index * 100, vx: -30, vy: 0, energy: 0.7, trail: [] });
    });
    const unchanged = structuredClone(world);
    expect(moveLight(world, world.lights[0].id, 950, 500)).toBe(true);
    for (let tick = 0; tick < 30 * 10; tick++) {
      stepWorld(world);
      stepWorld(unchanged);
    }
    for (let index = 0; index < 2; index++) {
      const creature = world.organisms[index];
      expect(creature.x).toBeGreaterThan(unchanged.organisms[index].x + 200);
      expect(Math.hypot(creature.x - 950, creature.y - 500)).toBeLessThan(100);
    }
    expect(world.consumed).toBeGreaterThan(0);
  });
});
