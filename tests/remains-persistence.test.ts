import { describe, expect, it } from 'vitest';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { createWorld, stepWorld } from '../src/world/simulation';
import { depositRemain } from '../src/world/species/remains';
import { admitMarlgrub, marlgrubReserveCapacity } from '../src/world/species/marlgrub';
import { SPECIES_CATALOG } from '../src/world/species/catalog';
import { baselineTraits } from '../src/world/traits';
import { SCHEMA_REVISION, type World } from '../src/world/types';

const remainsLedgerKeys = [
  'remainsCreated',
  'remainsConsumed',
  'remainsDecayed',
  'marlgrubIntake',
  'marlgrubMaintenancePigment',
  'fossilsFormed',
  'seamDissolved',
  'tidePigmentIn',
  'tidePigmentOut',
  'tideArrivals',
  'tideDepartures',
  'strandlineSettled',
  'strandlineLeached',
  'precipitatedPigment',
] as const;

function previousRevision(world: World): Record<string, any> {
  const previous = structuredClone(world) as Record<string, any>;
  previous.schemaRevision = 9;
  delete previous.remains;
  delete previous.marlgrubs;
  delete previous.marlgrubAdmissionAt;
  delete previous.marlgrubCandidateAfterId;
  delete previous.lastSeenAt;
  delete previous.fossils;
  delete previous.pools;
  delete previous.seamAccrued;
  delete previous.awayTraces;
  delete previous.shoreMemory;
  delete previous.channel;
  for (const key of remainsLedgerKeys) delete previous.ecologyLedger[key];
  return previous;
}

function inhabited(): World {
  const world = createWorld(51);
  world.elapsed = 80;
  world.tick = 2400;
  depositRemain(world, { x: 720, y: 500 }, 42, 0.7, 'skimmer');
  admitMarlgrub(world);
  world.marlgrubs[0].traits = { drive: 1.04, bulk: 0.96 };
  world.marlgrubAdmissionAt = 140;
  world.marlgrubCandidateAfterId = world.remains[0]?.id ?? 0;
  world.foundingTypeCursor = 5;
  return world;
}

describe('remains snapshot revision', () => {
  it('migrates revision 9 with no remains, no marlgrubs, and unchanged paid ecology', () => {
    const before = createWorld(51);
    before.elapsed = 80;
    before.tick = 2400;
    const old = previousRevision(before);
    const source = JSON.stringify(old);
    const migrated = restoreWorld(source)!;
    expect(migrated).not.toBeNull();
    expect(migrated).toMatchObject({
      schemaRevision: SCHEMA_REVISION,
      lastSeenAt: null,
      remains: [],
      marlgrubs: [],
      marlgrubAdmissionAt: old.elapsed,
      marlgrubCandidateAfterId: 0,
      nextId: old.nextId,
      tick: old.tick,
      elapsed: old.elapsed,
      randomState: old.randomState,
      sediment: old.sediment,
      cargoMites: old.cargoMites,
    });
    for (const key of remainsLedgerKeys) expect(migrated.ecologyLedger[key]).toBe(0);
    expect(JSON.stringify(old)).toBe(source);
    expect(restoreWorld(serializeWorld(migrated))).toEqual(migrated);
  });

  it('round-trips an occupied remain and grub and continues identically', () => {
    const world = inhabited();
    const resumed = restoreWorld(serializeWorld(world))!;
    expect(resumed).toEqual(world);
    expect(resumed.marlgrubs[0].traits).toEqual({ drive: 1.04, bulk: 0.96 });
    for (let step = 0; step < 180; step++) {
      stepWorld(world);
      stepWorld(resumed);
    }
    expect(resumed).toEqual(world);
  });

  it('rejects hybrids, future revisions, overfull remains and unpaid consumers', () => {
    const edits: ((world: Record<string, any>) => void)[] = [
      (w) => {
        delete w.remains;
      },
      (w) => {
        delete w.marlgrubs;
      },
      (w) => {
        w.schemaRevision = 9;
      },
      (w) => {
        w.schemaRevision = 23;
      },
      (w) => {
        w.remains[0].pigment = 2.1;
      },
      (w) => {
        w.marlgrubs[0].body = 0.2;
      },
      (w) => {
        w.marlgrubs[0].targetRemainId = w.grazers[0].id;
      },
      (w) => {
        w.foundingTypeCursor = 6;
      },
      (w) => {
        delete w.ecologyLedger.remainsCreated;
      },
      (w) => {
        delete w.marlgrubs[0].parentId;
      },
      (w) => {
        w.marlgrubs[0].parentId = w.grazers[0].id;
      },
      (w) => {
        w.marlgrubs[0].parentId = w.marlgrubs[0].id;
      },
      (w) => {
        w.marlgrubs[0].nextBirthAt = w.elapsed;
      },
      (w) => {
        w.marlgrubs[0].nextBirthAt = w.elapsed + 61;
      },
    ];
    for (const edit of edits) {
      const world = structuredClone(inhabited()) as Record<string, any>;
      if (world.remains.length === 0) {
        world.remains.push({
          id: world.nextId++,
          species: 'remain',
          source: 'unknown',
          x: 720,
          y: 500,
          pigment: 0.4,
          hue: 40,
          age: 1,
          radius: 6,
        });
      }
      if (world.marlgrubs.length === 0) {
        world.marlgrubs.push({
          id: world.nextId++,
          species: 'marlgrub',
          x: 720,
          y: 500,
          vx: 0,
          vy: 0,
          body: 0.1,
          reserve: 0.1,
          age: 1,
          hue: 40,
          starvedFor: 0,
          targetRemainId: null,
          parentId: null,
          nextBirthAt: world.elapsed + SPECIES_CATALOG.marlgrub.maturityAge,
          traits: baselineTraits(),
        });
      }
      edit(world);
      expect(restoreWorld(JSON.stringify(world))).toBeNull();
    }
  });

  it('migrates revision 17 marlgrubs with lineage fields and no gifted resources', () => {
    const world = inhabited();
    const held =
      world.sediment.reduce((sum, grain) => sum + grain.strength, 0) +
      world.remains.reduce((sum, remain) => sum + remain.pigment, 0) +
      world.fossils.reduce((sum, fossil) => sum + fossil.pigment, 0) +
      world.marlgrubs.reduce((sum, grub) => sum + grub.body + grub.reserve, 0);
    const previous = structuredClone(world) as Record<string, any>;
    previous.schemaRevision = 17;
    delete previous.ecologyLedger.tidePigmentIn;
    delete previous.ecologyLedger.tidePigmentOut;
    delete previous.ecologyLedger.tideArrivals;
    delete previous.ecologyLedger.tideDepartures;
    delete previous.ecologyLedger.strandlineSettled;
    delete previous.ecologyLedger.strandlineLeached;
    delete previous.ecologyLedger.precipitatedPigment;
    previous.marlgrubs = previous.marlgrubs.map(
      ({ parentId: _parentId, nextBirthAt: _nextBirthAt, ...rest }: Record<string, unknown>) => rest,
    );
    const source = JSON.stringify(previous);
    const restored = restoreWorld(source)!;
    expect(restored).not.toBeNull();
    expect(restored.schemaRevision).toBe(SCHEMA_REVISION);
    expect(restored.marlgrubs).toHaveLength(1);
    expect(restored.marlgrubs[0].parentId).toBeNull();
    expect(restored.marlgrubs[0].nextBirthAt).toBe(
      world.elapsed - world.marlgrubs[0].age + SPECIES_CATALOG.marlgrub.maturityAge,
    );
    expect(restored.marlgrubs[0].traits).toEqual({ drive: 1.04, bulk: 0.96 });
    expect(restored.marlgrubs[0].reserve).toBe(world.marlgrubs[0].reserve);
    expect(restored.randomState).toBe(world.randomState);
    expect(restored.nextId).toBe(world.nextId);
    expect(restored.sediment).toEqual(world.sediment);
    expect(restored.remains).toEqual(world.remains);
    expect(
      restored.sediment.reduce((sum, grain) => sum + grain.strength, 0) +
        restored.remains.reduce((sum, remain) => sum + remain.pigment, 0) +
        restored.fossils.reduce((sum, fossil) => sum + fossil.pigment, 0) +
        restored.marlgrubs.reduce((sum, grub) => sum + grub.body + grub.reserve, 0),
    ).toBeCloseTo(held, 12);
    expect(JSON.stringify(previous)).toBe(source);
    expect(restoreWorld(serializeWorld(restored))).toEqual(restored);
  });

  it('keeps living marlgrub traits through a round trip and continues the lineage', () => {
    const world = inhabited();
    world.marlgrubs[0].traits = { drive: 1.12, bulk: 0.88 };
    const resumed = restoreWorld(serializeWorld(world))!;
    expect(resumed).toEqual(world);
    expect(resumed.marlgrubs[0].traits).toEqual({ drive: 1.12, bulk: 0.88 });
    for (let tick = 0; tick < 60; tick++) {
      stepWorld(world);
      stepWorld(resumed);
    }
    expect(resumed).toEqual(world);
  });

  it('keeps a stout marlgrub larger paid reserve and rejects overflow on a slighter frame', () => {
    const world = inhabited();
    world.marlgrubs[0].traits = { drive: 1, bulk: 1.3 };
    world.marlgrubs[0].reserve = 0.9;
    expect(marlgrubReserveCapacity(world.marlgrubs[0].traits)).toBeCloseTo(1.04, 12);
    expect(restoreWorld(serializeWorld(world))).toEqual(world);
    const overfull = structuredClone(world) as Record<string, any>;
    overfull.marlgrubs[0].traits = { drive: 1, bulk: 0.7 };
    expect(restoreWorld(JSON.stringify(overfull))).toBeNull();
  });

  it('rejects lineage fields left on a revision-17 marlgrub rather than filling them', () => {
    const previous = structuredClone(inhabited()) as Record<string, any>;
    previous.schemaRevision = 17;
    expect(restoreWorld(JSON.stringify(previous))).toBeNull();
  });

  it('allows a parent-paid child to serialize beside its parent', () => {
    const world = inhabited();
    const parent = world.marlgrubs[0];
    world.marlgrubs.push({
      ...structuredClone(parent),
      id: world.nextId++,
      parentId: parent.id,
      nextBirthAt: world.elapsed + SPECIES_CATALOG.marlgrub.maturityAge,
      age: 0,
      vx: 0,
      vy: 0,
      x: parent.x + 16,
      y: parent.y,
    });
    expect(restoreWorld(serializeWorld(world))).toEqual(world);
  });
});
