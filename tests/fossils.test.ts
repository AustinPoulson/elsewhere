import { describe, expect, it } from 'vitest';
import { composeJournal } from '../src/world/catchup';
import { MINERAL_SEAM } from '../src/world/environment/mineral-seam';
import { createWorld, stepWorld } from '../src/world/simulation';
import { FOSSIL_CAPACITY, LIMITS, type World } from '../src/world/types';
import { depositFossil, heldFossilPigment } from '../src/world/species/fossils';
import {
  DEATH_SEDIMENT_FRACTION,
  depositRemain,
  heldRemainPigment,
  settleDeath,
  updateRemains,
} from '../src/world/species/remains';
import { updateSkimmers } from '../src/world/species/skimmer';

function empty(): World {
  const world = createWorld(11);
  world.organisms = [];
  world.grazers = [];
  world.nests = [];
  world.lights = [];
  world.sediment = [];
  world.skimmers = [];
  world.fossils = [];
  world.seamAccrued = 0;
  world.ecologyLedger.seamDissolved = MINERAL_SEAM.capacity;
  return world;
}

function balanced(world: World): void {
  expect(world.ecologyLedger.remainsCreated).toBeCloseTo(
    heldRemainPigment(world) + world.ecologyLedger.remainsConsumed + world.ecologyLedger.remainsDecayed,
    10,
  );
  expect(world.ecologyLedger.fossilsFormed).toBeCloseTo(heldFossilPigment(world), 10);
}

describe('fossil burial', () => {
  it('turns extinct-type remains into durable fossils without inventing pigment', () => {
    const world = empty();
    world.nests = [{ id: world.nextId++, x: 720, y: 500, hue: 180, pigment: 0.6, age: 0 }];
    world.skimmerAdmissionAt = 0;
    world.tick = 6;
    updateSkimmers(world, 1 / 30);
    expect(world.skimmers).toHaveLength(1);
    const skimmer = world.skimmers[0];
    skimmer.reserve = 0.4;
    skimmer.age = 480;
    updateSkimmers(world, 1 / 30);
    expect(world.skimmers).toHaveLength(0);
    expect(world.remains).toHaveLength(1);
    expect(world.fossils).toHaveLength(0);
    const remainShare = (skimmer.body + 0.4) * (1 - DEATH_SEDIMENT_FRACTION);
    expect(world.remains[0].pigment).toBeCloseTo(remainShare, 12);
    updateRemains(world, 1 / 30, 0);
    expect(world.remains).toHaveLength(0);
    expect(world.fossils).toHaveLength(1);
    expect(world.fossils[0]).toMatchObject({ species: 'fossil', source: 'skimmer', x: skimmer.x, y: skimmer.y });
    expect(world.fossils[0].pigment).toBeCloseTo(remainShare, 12);
    expect(world.ecologyLedger.fossilsFormed).toBeCloseTo(remainShare, 12);
    expect(world.ecologyLedger.remainsDecayed).toBeCloseTo(remainShare, 12);
    balanced(world);
  });

  it('leaves living-type remains as remains and unknown remains unfossilized', () => {
    const world = empty();
    world.nests = [{ id: world.nextId++, x: 720, y: 500, hue: 180, pigment: 0.6, age: 0 }];
    world.skimmerAdmissionAt = 0;
    world.tick = 6;
    updateSkimmers(world, 1 / 30);
    depositRemain(world, { x: 700, y: 500 }, 40, 0.4, 'skimmer');
    depositRemain(world, { x: 740, y: 500 }, 80, 0.3, 'unknown');
    updateRemains(world, 1 / 30, 0);
    expect(world.fossils).toEqual([]);
    expect(world.remains).toHaveLength(2);
    expect(world.ecologyLedger.fossilsFormed).toBe(0);
    balanced(world);
  });

  it('keeps fossil pigment while ordinary sediment fades', () => {
    const world = empty();
    settleDeath(world, { x: 720, y: 500 }, 180, 0.6, 'skimmer');
    updateRemains(world, 1 / 30, 0);
    expect(world.fossils).toHaveLength(1);
    const held = world.fossils[0].pigment;
    const sediment = world.sediment.reduce((sum, grain) => sum + grain.strength, 0);
    for (let i = 0; i < 18_000; i++) stepWorld(world);
    expect(world.fossils[0].pigment).toBeCloseTo(held, 8);
    expect(world.sediment.reduce((sum, grain) => sum + grain.strength, 0)).toBeLessThan(sediment);
    expect(world.fossils.length).toBeLessThanOrEqual(LIMITS.fossils);
    balanced(world);
  }, 20_000);

  it('merges nearby same-type fossils and overflows leftover into ordinary pigment', () => {
    const world = empty();
    depositFossil(world, { x: 720, y: 500 }, 40, FOSSIL_CAPACITY, 'rainbell');
    const created = world.ecologyLedger.fossilsFormed;
    const mineralized = world.ecologyLedger.mineralizedPigment;
    const sediment = world.sediment.reduce((sum, grain) => sum + grain.strength, 0);
    depositFossil(world, { x: 722, y: 500 }, 80, 0.4, 'rainbell');
    expect(world.fossils).toHaveLength(1);
    expect(world.fossils[0].pigment).toBeCloseTo(FOSSIL_CAPACITY, 12);
    expect(world.ecologyLedger.fossilsFormed).toBeCloseTo(created, 12);
    expect(
      world.sediment.reduce((sum, grain) => sum + grain.strength, 0) +
        (world.ecologyLedger.mineralizedPigment - mineralized),
    ).toBeCloseTo(sediment + 0.4, 10);
    balanced(world);
  });

  it('caps fossil count and does not evict existing impressions', () => {
    const world = empty();
    for (let i = 0; i < LIMITS.fossils; i++) {
      depositFossil(world, { x: 500 + (i % 8) * 40, y: 400 + Math.floor(i / 8) * 50 }, 30 + i, 0.2, 'reedwell');
    }
    expect(world.fossils).toHaveLength(LIMITS.fossils);
    const first = world.fossils[0];
    const formed = world.ecologyLedger.fossilsFormed;
    depositFossil(world, { x: 900, y: 620 }, 200, 0.25, 'glassLimpet');
    expect(world.fossils).toHaveLength(LIMITS.fossils);
    expect(world.fossils.some((entry) => entry.id === first.id)).toBe(true);
    expect(world.ecologyLedger.fossilsFormed).toBeCloseTo(formed, 12);
    expect(world.sediment.some((grain) => grain.strength > 0)).toBe(true);
    balanced(world);
  });

  it('names a new impression in the field journal', () => {
    const journal = composeJournal(
      { reason: 'ready', awaySeconds: 3600, simulateSeconds: 3600, sleptSeconds: 0 },
      {
        lucents: { births: 0, deaths: 0, extinctAt: null },
        grazers: { births: 0, deaths: 0, extinctAt: null },
        skimmers: { births: 0, deaths: 0, extinctAt: null },
        reedwells: { births: 0, deaths: 0, extinctAt: null },
        rainbells: { births: 0, deaths: 0, extinctAt: null },
        siltstitchers: { births: 0, deaths: 0, extinctAt: null },
        glassLimpets: { births: 0, deaths: 1, extinctAt: 20 },
        cargoMites: { births: 0, deaths: 0, extinctAt: null },
        marlgrubs: { births: 0, deaths: 0, extinctAt: null },
      },
      {
        loosePigment: 1,
        nestedPigment: 1,
        remainPigment: 0,
        fossilPigment: 0,
        fossils: 0,
        seamRemaining: 24,
        seamDissolved: 0,
        deepPigment: 0,
      },
      {
        loosePigment: 1,
        nestedPigment: 1,
        remainPigment: 0,
        fossilPigment: 0.2,
        fossils: 1,
        seamRemaining: 24,
        seamDissolved: 0,
        deepPigment: 0,
      },
      80,
    );
    expect(journal.lines).toContain('The last glass limpet died about a minute ago.');
    expect(journal.lines).toContain('Old sediment kept an impression of a lineage that ended.');
  });
});

describe('opening worlds', () => {
  it('starts with no fossils and no gifted fossil pigment', () => {
    const world = createWorld(4);
    expect(world.fossils).toEqual([]);
    expect(world.ecologyLedger.fossilsFormed).toBe(0);
    expect(world.schemaRevision).toBe(15);
  });
});
