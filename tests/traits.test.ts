import { describe, expect, it } from 'vitest';
import { createWorld } from '../src/world/simulation';
import {
  admitCargoMite,
  cargoMiteReserveCapacity,
  cargoMiteSeekReach,
  updateCargoMites,
} from '../src/world/species/cargo-mite';
import { SPECIES_CATALOG } from '../src/world/species/catalog';
import { baselineTraits, clampTrait, mutateTraits, traitMobility, TRAIT_MAX, TRAIT_MIN } from '../src/world/traits';
import type { Grazer, World } from '../src/world/types';

function habitat(): { world: World; host: Grazer } {
  const world = createWorld(28);
  world.elapsed = 40;
  world.tick = 1200;
  world.organisms = [];
  world.lights = [];
  world.sediment = [];
  world.skimmers = [];
  world.reedwells = [];
  world.rainbells = [];
  world.siltstitchers = [];
  world.glassLimpets = [];
  world.cargoMites = [];
  world.grazers = [];
  world.nests = [];
  const nest = { id: world.nextId++, x: 720, y: 500, pigment: 0, hue: 140, age: 0 };
  const host: Grazer = {
    id: world.nextId++,
    species: 'grazer',
    x: 750,
    y: 500,
    vx: 0,
    vy: 0,
    size: 8,
    age: 10,
    phase: 0,
    hue: 140,
    cargo: 0.5,
    nestId: nest.id,
    returning: true,
    traits: baselineTraits(),
  };
  world.nests.push(nest);
  world.grazers.push(host);
  return { world, host };
}

describe('heritable traits', () => {
  it('clamps mutations into a bounded range and never draws on refusal', () => {
    const world = createWorld(11);
    const parent = { drive: TRAIT_MAX, bulk: TRAIT_MIN };
    for (let i = 0; i < 40; i++) {
      const next = mutateTraits(world, parent);
      expect(next.drive).toBeGreaterThanOrEqual(TRAIT_MIN);
      expect(next.drive).toBeLessThanOrEqual(TRAIT_MAX);
      expect(next.bulk).toBeGreaterThanOrEqual(TRAIT_MIN);
      expect(next.bulk).toBeLessThanOrEqual(TRAIT_MAX);
    }
    expect(clampTrait(0)).toBe(TRAIT_MIN);
    expect(clampTrait(4)).toBe(TRAIT_MAX);
  });

  it('gives founders baseline traits and spends parent reserve for a mutated child', () => {
    const { world, host } = habitat();
    const random = world.randomState;
    expect(admitCargoMite(world)).toBe(true);
    expect(world.randomState).toBe(random);
    const parent = world.cargoMites[0];
    expect(parent.traits).toEqual(baselineTraits());
    host.cargo = 1.2;
    parent.age = 29.9;
    world.elapsed = 70;
    world.tick = 1201;
    const beforeReserve = parent.reserve;
    updateCargoMites(world, 0.1);
    expect(world.cargoMites).toHaveLength(2);
    const child = world.cargoMites[1];
    expect(child.parentId).toBe(parent.id);
    expect(child.reserve).toBe(SPECIES_CATALOG.cargoMite.childReserve);
    expect(parent.reserve).toBeCloseTo(
      beforeReserve +
        world.ecologyLedger.cargoMiteIntake -
        SPECIES_CATALOG.cargoMite.childCost -
        SPECIES_CATALOG.cargoMite.maintenanceRate * 0.1 * parent.traits.drive,
      8,
    );
    expect(child.traits).not.toEqual(parent.traits);
    expect(child.traits.drive).toBeGreaterThanOrEqual(TRAIT_MIN);
    expect(child.traits.bulk).toBeLessThanOrEqual(TRAIT_MAX);
    expect(world.randomState).not.toBe(random);
  });

  it('makes higher drive both hungrier and costlier, so neither pole is free', () => {
    const keen = habitat();
    const spare = habitat();
    expect(admitCargoMite(keen.world)).toBe(true);
    expect(admitCargoMite(spare.world)).toBe(true);
    const hungry = keen.world.cargoMites[0];
    const thrifty = spare.world.cargoMites[0];
    hungry.traits = { drive: 1.3, bulk: 1 };
    thrifty.traits = { drive: 0.7, bulk: 1 };
    keen.host.cargo = 1.2;
    spare.host.cargo = 1.2;
    hungry.age = 10;
    thrifty.age = 10;
    updateCargoMites(keen.world, 1);
    updateCargoMites(spare.world, 1);
    expect(keen.world.ecologyLedger.cargoMiteIntake).toBeGreaterThan(spare.world.ecologyLedger.cargoMiteIntake);
    expect(keen.world.ecologyLedger.cargoMiteMaintenancePigment).toBeGreaterThan(
      spare.world.ecologyLedger.cargoMiteMaintenancePigment,
    );
  });

  it('lets a stouter mite hold more host pigment while reaching and traveling less far', () => {
    const stout = habitat();
    const slight = habitat();
    expect(admitCargoMite(stout.world)).toBe(true);
    expect(admitCargoMite(slight.world)).toBe(true);
    const heavy = stout.world.cargoMites[0];
    const light = slight.world.cargoMites[0];
    heavy.traits = { drive: 1, bulk: TRAIT_MAX };
    light.traits = { drive: 1, bulk: TRAIT_MIN };
    heavy.reserve = 0.1;
    light.reserve = 0.1;
    stout.host.cargo = 1.2;
    slight.host.cargo = 1.2;
    heavy.age = 10;
    light.age = 10;
    expect(cargoMiteSeekReach(heavy.traits)).toBeLessThan(cargoMiteSeekReach(light.traits));
    expect(traitMobility(heavy.traits)).toBeLessThan(traitMobility(light.traits));
    expect(cargoMiteReserveCapacity(heavy.traits)).toBeGreaterThan(cargoMiteReserveCapacity(light.traits));
    for (let step = 0; step < 80; step++) {
      updateCargoMites(stout.world, 1);
      updateCargoMites(slight.world, 1);
    }
    expect(heavy.reserve).toBeGreaterThan(light.reserve);
    expect(heavy.reserve).toBeCloseTo(
      cargoMiteReserveCapacity(heavy.traits) - SPECIES_CATALOG.cargoMite.maintenanceRate,
      8,
    );
    expect(light.reserve).toBeCloseTo(
      cargoMiteReserveCapacity(light.traits) - SPECIES_CATALOG.cargoMite.maintenanceRate,
      8,
    );
    expect(stout.world.ecologyLedger.cargoMiteIntake).toBeGreaterThan(slight.world.ecologyLedger.cargoMiteIntake);
  });

  it('keeps lucent opening traits at baseline so new worlds do not gift variation', () => {
    const world = createWorld(3);
    for (const organism of world.organisms) expect(organism.traits).toEqual(baselineTraits());
    for (const grazer of world.grazers) expect(grazer.traits).toEqual(baselineTraits());
  });
});
