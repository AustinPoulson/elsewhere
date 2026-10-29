import { describe, expect, it } from 'vitest';
import { createWorld, stepWorld } from '../src/world/simulation';
import { admitCargoMite, syncAttachedCargoMites, updateCargoMites } from '../src/world/species/cargo-mite';
import { activeNewTypePopulation, SPECIES_CATALOG } from '../src/world/species/catalog';
import { LIMITS, type Grazer, type World } from '../src/world/types';

function habitat(): { world: World; host: Grazer } {
  const world = createWorld(28);
  world.elapsed = 40;
  world.tick = 1200;
  world.organisms = []; world.lights = []; world.sediment = [];
  world.skimmers = []; world.reedwells = []; world.rainbells = [];
  world.siltstitchers = []; world.glassLimpets = []; world.cargoMites = [];
  world.grazers = []; world.nests = [];
  const nest = { id: world.nextId++, x: 720, y: 500, pigment: 0, hue: 140, age: 0 };
  const host: Grazer = { id: world.nextId++, species: 'grazer', x: 750, y: 500,
    vx: 0, vy: 0, size: 8, age: 10, phase: 0, hue: 140, cargo: .5,
    nestId: nest.id, returning: true };
  world.nests.push(nest); world.grazers.push(host);
  return { world, host };
}

function pigment(world: World): number {
  return world.grazers.reduce((sum, host) => sum + host.cargo, 0)
    + world.nests.reduce((sum, nest) => sum + nest.pigment, 0)
    + world.sediment.reduce((sum, grain) => sum + grain.strength, 0)
    + world.cargoMites.reduce((sum, mite) => sum + mite.body + mite.reserve, 0);
}

describe('cargo mite funded host and offspring lifecycle', () => {
  it('starts absent and debits a loaded host exactly for a bounded founder', () => {
    const { world, host } = habitat();
    expect(world.cargoMites).toEqual([]);
    expect(SPECIES_CATALOG.cargoMite.cap).toBe(4);
    const before = pigment(world), nextId = world.nextId, random = world.randomState;
    expect(admitCargoMite(world)).toBe(true);
    expect(host.cargo).toBe(0);
    expect(host.returning).toBe(false);
    expect(world.cargoMites[0]).toMatchObject({ id: nextId, body: .1, reserve: .4,
      mode: 'attached', hostId: host.id, parentId: null, nextBirthAt: 70 });
    expect(pigment(world)).toBeCloseTo(before, 12);
    expect(world.nextId).toBe(nextId + 1);
    expect(world.randomState).toBe(random);
    expect(activeNewTypePopulation(world)).toBe(1);
    expect(admitCargoMite(world)).toBe(false);
  });

  it('rotates one host-ID candidate and refuses underfunded or crowded sites without payment', () => {
    const { world, host } = habitat();
    host.cargo = .5 - Number.EPSILON;
    const other: Grazer = { ...host, id: world.nextId++, x: 850, cargo: .5 };
    world.grazers.push(other);
    const before = pigment(world), random = world.randomState;
    expect(admitCargoMite(world)).toBe(true);
    expect(world.cargoMites[0].hostId).toBe(other.id);
    expect(host.cargo).toBe(.5 - Number.EPSILON);
    expect(pigment(world)).toBeCloseTo(before, 12);
    world.cargoMiteAdmissionAt = 0;
    host.cargo = .5;
    host.x = 850 + 47.99;
    const saved = structuredClone(world);
    expect(admitCargoMite(world)).toBe(false);
    expect(world.nextId).toBe(saved.nextId);
    expect(world.randomState).toBe(random);
    expect(host.cargo).toBe(.5);
  });

  it('feeds from real cargo, pays maintenance, and creates a child only from parent reserve', () => {
    const { world, host } = habitat();
    admitCargoMite(world);
    const parent = world.cargoMites[0];
    host.cargo = 1.2; host.returning = true;
    parent.age = 29.9;
    world.elapsed = 70;
    world.tick = 1201;
    const before = pigment(world), nextId = world.nextId;
    updateCargoMites(world, .1);
    expect(world.cargoMites).toHaveLength(2);
    const child = world.cargoMites[1];
    expect(child).toMatchObject({ id: nextId, parentId: parent.id, hostId: host.id,
      mode: 'attached', age: 0, body: .1, reserve: .1, nextBirthAt: 100 });
    expect(parent.nextBirthAt).toBe(130);
    expect(parent.reserve).toBeCloseTo(.20075, 12);
    expect(host.cargo).toBeCloseTo(1.1992, 12);
    expect(world.ecologyLedger.cargoMiteIntake).toBeCloseTo(.0008, 12);
    expect(world.ecologyLedger.cargoMiteMaintenancePigment).toBeCloseTo(.00005, 12);
    expect(pigment(world)).toBeCloseTo(before - .00005, 12);
    expect(world.nextFoundingTick).toBe(1207);
    // Refusal under the shared birth slot changes no material, ID or deadline.
    parent.reserve = .5; parent.nextBirthAt = world.elapsed;
    const after = pigment(world), afterId = world.nextId, deadline = parent.nextBirthAt;
    updateCargoMites(world, .1);
    expect(world.cargoMites).toHaveLength(2);
    expect(world.nextId).toBe(afterId);
    expect(parent.nextBirthAt).toBe(deadline);
    expect(pigment(world)).toBeCloseTo(after - .0001, 9);
  });

  it('does not teleport after host loss and returns finite material once on a full floor', () => {
    const { world, host } = habitat(); admitCargoMite(world);
    const mite = world.cargoMites[0];
    world.grazers = [];
    const where = { x: mite.x, y: mite.y };
    updateCargoMites(world, .1);
    expect(mite.mode).toBe('seeking'); expect(mite.hostId).toBeNull();
    expect({ x: mite.x, y: mite.y }).toEqual(where);
    world.grazers = [{ ...host, x: 820, y: 500, cargo: .8 }];
    world.tick = (6 - mite.id % 6) % 6;
    updateCargoMites(world, .1);
    expect(mite.mode).toBe('seeking');
    expect(Math.hypot(mite.x - where.x, mite.y - where.y)).toBeLessThanOrEqual(.8 + 1e-9);
    mite.age = 239.99;
    world.sediment = Array.from({ length: LIMITS.sediment }, (_, index) => ({
      id: world.nextId++, x: index === 0 ? mite.x : 200, y: index === 0 ? mite.y : 200,
      radius: 6, hue: 140, strength: index === 0 ? .2 : 1, age: 0,
    }));
    const id = world.nextId;
    updateCargoMites(world, .02);
    expect(world.cargoMites).toHaveLength(0);
    expect(world.sediment[0].strength).toBeCloseTo(.7 - .0001, 4);
    expect(world.nextId).toBe(id);
    const mineralized = world.ecologyLedger.mineralizedPigment;
    updateCargoMites(world, .02);
    expect(world.ecologyLedger.mineralizedPigment).toBe(mineralized);
  });

  it('syncs attached coordinates only after host displacement, without double drift', () => {
    const { world, host } = habitat(); admitCargoMite(world);
    const mite = world.cargoMites[0];
    host.x += 12; host.y += 3;
    syncAttachedCargoMites(world);
    expect([mite.x, mite.y]).toEqual([host.x, host.y]);
    syncAttachedCargoMites(world);
    expect([mite.x, mite.y]).toEqual([host.x, host.y]);
  });

  it('naturally founds, feeds and raises a juvenile on retained host cargo at normal rates', () => {
    const { world, host } = habitat();
    host.cargo = 1.2;
    world.nests[0].pigment = 12;
    for (let i = 0; i < 5; i++) world.sediment.push({ id: world.nextId++, x: 736 + i * 3,
      y: 500, radius: 6, hue: 140, strength: 1, age: 0 });
    world.foundingTypeCursor = 5;
    world.skimmerAdmissionAt = 200;
    world.siltstitcherAdmissionAt = 200;
    const control = structuredClone(world);
    control.cargoMiteAdmissionAt = 200;
    for (let i = 0; i < 30 * 85; i++) { stepWorld(world); stepWorld(control); }
    expect(world.cargoMites.length).toBeGreaterThanOrEqual(2);
    const child = world.cargoMites.find(mite => mite.parentId !== null);
    expect(child).toBeDefined();
    expect(child!.age).toBeGreaterThan(30);
    expect(child!.reserve).toBeGreaterThanOrEqual(.4);
    expect(world.ecologyLedger.cargoMiteIntake).toBeGreaterThan(.2);
    expect(world.grazers[0].cargo).toBeLessThan(control.grazers[0].cargo);
  });

  it('reduces ordinary nest delivery against the same loaded grazer without mites', () => {
    const { world, host } = habitat();
    host.cargo = 1.2;
    world.foundingTypeCursor = 5;
    world.skimmerAdmissionAt = 200;
    world.siltstitcherAdmissionAt = 200;
    const control = structuredClone(world);
    control.cargoMiteAdmissionAt = 100;
    for (let i = 0; i < 30 * 15; i++) { stepWorld(world); stepWorld(control); }
    expect(world.cargoMites).toHaveLength(1);
    expect(world.nests[0].pigment).toBeGreaterThan(.5);
    expect(control.nests[0].pigment).toBeGreaterThan(world.nests[0].pigment + .45);
    expect(world.ecologyLedger.cargoMiteIntake).toBeGreaterThan(0);
  });
});
