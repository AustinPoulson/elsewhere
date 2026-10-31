import { describe, expect, it } from 'vitest';
import historicalStudy from '../src/app/shower-study.json';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { createWorld, stepWorld } from '../src/world/simulation';
import type { World } from '../src/world/types';

const limpetLedgerKeys = ['glassLimpetIntake', 'glassLimpetMaintenancePigment'] as const;

function revision6(world: World): Record<string, any> {
  const old = structuredClone(world) as Record<string, any>;
  old.schemaRevision = 6;
  for (const key of [
    'glassLimpets',
    'glassLimpetAdmissionAt',
    'glassLimpetCandidateAfterId',
    'skimmerCandidateAfterId',
    'nextFoundingTick',
    'foundingTypeCursor',
    'cargoMites',
    'cargoMiteAdmissionAt',
    'cargoMiteCandidateAfterId',
  ])
    delete old[key];
  for (const key of limpetLedgerKeys) delete old.ecologyLedger[key];
  for (const key of ['cargoMiteIntake', 'cargoMiteMaintenancePigment']) delete old.ecologyLedger[key];
  return old;
}

function inhabited(): World {
  const world = createWorld(42);
  world.tick = 3607;
  world.elapsed = 120.25;
  world.sediment.push({ id: world.nextId++, x: 1180, y: 500, radius: 9, hue: 189, strength: 0.4, age: 1 });
  const grain = world.sediment[world.sediment.length - 1];
  world.glassLimpets.push({
    id: world.nextId++,
    species: 'glassLimpet',
    x: 1180,
    y: 500,
    body: 0.2,
    reserve: 0.13,
    cargo: 0.28,
    age: 19,
    hue: 189,
    starvedFor: 0,
    targetSedimentId: grain.id,
  });
  world.glassLimpetAdmissionAt = 170;
  world.glassLimpetCandidateAfterId = 4;
  world.nextFoundingTick = 3610;
  world.foundingTypeCursor = 3;
  world.ecologyLedger.glassLimpetIntake = 0.28;
  world.ecologyLedger.glassLimpetMaintenancePigment = 0.019;
  return world;
}

describe('glass limpet snapshot revision', () => {
  it('migrates revision6 and the immutable historical study without a free shell or resources', () => {
    const oldWorld = createWorld(42);
    oldWorld.tick = 3607;
    oldWorld.elapsed = 120.25;
    oldWorld.sediment.push({ id: oldWorld.nextId++, x: 1180, y: 500, radius: 9, hue: 189, strength: 0.4, age: 1 });
    const source = revision6(oldWorld);
    const serialized = JSON.stringify(source);
    const migrated = restoreWorld(serialized)!;
    expect(migrated).not.toBeNull();
    expect(migrated).toMatchObject({
      schemaRevision: 8,
      glassLimpets: [],
      cargoMites: [],
      glassLimpetAdmissionAt: source.elapsed,
      glassLimpetCandidateAfterId: 0,
      nextFoundingTick: source.tick,
      foundingTypeCursor: 0,
      nextId: source.nextId,
      tick: source.tick,
      elapsed: source.elapsed,
      randomState: source.randomState,
      sediment: source.sediment,
      organisms: source.organisms,
      nests: source.nests,
      grazers: source.grazers,
    });
    for (const key of limpetLedgerKeys) expect(migrated.ecologyLedger[key]).toBe(0);
    expect(JSON.stringify(source)).toBe(serialized);
    expect(restoreWorld(serializeWorld(migrated))).toEqual(migrated);

    const studyJson = JSON.stringify(historicalStudy);
    const study = restoreWorld(studyJson)!;
    expect(study).toMatchObject({
      glassLimpets: [],
      nextId: historicalStudy.nextId,
      randomState: historicalStudy.randomState,
      tick: historicalStudy.tick,
      elapsed: historicalStudy.elapsed,
      lights: historicalStudy.lights,
      sediment: historicalStudy.sediment,
      grazers: historicalStudy.grazers,
      nests: historicalStudy.nests,
    });
    expect(JSON.stringify(historicalStudy)).toBe(studyJson);
  });

  it('continues paid stored pigment and founding schedule exactly from arbitrary phases', () => {
    for (const offset of [0, 1, 4, 17]) {
      const world = inhabited();
      for (let step = 0; step < offset; step++) stepWorld(world);
      const resumed = restoreWorld(serializeWorld(world))!;
      expect(resumed).toEqual(world);
      for (let step = 0; step < 240; step++) {
        stepWorld(world);
        stepWorld(resumed);
      }
      expect(resumed).toEqual(world);
    }
  });

  it('retains a vanished grain target without inventing food, while rejecting a reused live ID', () => {
    const world = inhabited();
    const vanishedId = world.glassLimpets[0].targetSedimentId!;
    world.sediment = world.sediment.filter((grain) => grain.id !== vanishedId);
    expect(vanishedId).toBeLessThan(world.nextId);
    const beforeIntake = world.ecologyLedger.glassLimpetIntake;
    const resumed = restoreWorld(serializeWorld(world))!;
    expect(resumed.glassLimpets[0].targetSedimentId).toBe(vanishedId);
    for (let step = 0; step < 120; step++) {
      stepWorld(world);
      stepWorld(resumed);
    }
    expect(resumed).toEqual(world);
    expect(world.ecologyLedger.glassLimpetIntake).toBe(beforeIntake);

    const malformed = inhabited();
    malformed.glassLimpets[0].targetSedimentId = malformed.organisms[0].id;
    expect(restoreWorld(serializeWorld(malformed))).toBeNull();
  });

  it('rejects malformed shells, hybrid schema, references, and shared budget metadata', () => {
    const changes: ((world: Record<string, any>) => void)[] = [
      (w) => {
        delete w.glassLimpets;
      },
      (w) => {
        w.glassLimpets = null;
      },
      (w) => {
        w.glassLimpets[0].id = w.organisms[0].id;
      },
      (w) => {
        w.glassLimpets[0].id = w.nextId;
      },
      (w) => {
        w.glassLimpets[0].x = 720;
      },
      (w) => {
        w.glassLimpets[0].x = 1350;
      },
      (w) => {
        w.glassLimpets[0].reserve = 0.21;
      },
      (w) => {
        w.glassLimpets[0].cargo = 0.81;
      },
      (w) => {
        w.glassLimpets[0].targetSedimentId = w.organisms[0].id;
      },
      (w) => {
        w.glassLimpets[0].starvedFor = 61;
      },
      (w) => {
        w.glassLimpets[0].age = 481;
      },
      (w) => {
        delete w.glassLimpetAdmissionAt;
      },
      (w) => {
        w.glassLimpetAdmissionAt = w.elapsed + 61;
      },
      (w) => {
        w.glassLimpetCandidateAfterId = w.nextId;
      },
      (w) => {
        w.nextFoundingTick = w.tick + 7;
      },
      (w) => {
        w.foundingTypeCursor = 6;
      },
      (w) => {
        delete w.ecologyLedger.glassLimpetIntake;
      },
      (w) => {
        w.ecologyLedger.glassLimpetMaintenancePigment = -1;
      },
      (w) => {
        w.glassLimpets.push(...Array.from({ length: 4 }, () => ({ ...w.glassLimpets[0], id: w.nextId++ })));
      },
      (w) => {
        w.glassLimpets.push({ ...w.glassLimpets[0], id: w.nextId++, x: w.glassLimpets[0].x + 20 });
      },
      (w) => {
        w.schemaRevision = 6;
      },
    ];
    for (const mutate of changes) {
      const world = inhabited() as unknown as Record<string, any>;
      mutate(world);
      expect(restoreWorld(JSON.stringify(world))).toBeNull();
    }
    const old = revision6(inhabited());
    old.nextFoundingTick = 0;
    expect(restoreWorld(JSON.stringify(old))).toBeNull();
    delete old.nextFoundingTick;
    old.ecologyLedger.glassLimpetIntake = 0;
    expect(restoreWorld(JSON.stringify(old))).toBeNull();
  });
});
