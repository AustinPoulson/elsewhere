import { describe, expect, it } from 'vitest';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { createWorld, stepWorld } from '../src/world/simulation';
import { depositRemain } from '../src/world/species/remains';
import { admitMarlgrub } from '../src/world/species/marlgrub';
import { baselineTraits } from '../src/world/traits';
import type { World } from '../src/world/types';

const remainsLedgerKeys = [
  'remainsCreated',
  'remainsConsumed',
  'remainsDecayed',
  'marlgrubIntake',
  'marlgrubMaintenancePigment',
  'fossilsFormed',
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
      schemaRevision: 13,
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
        w.schemaRevision = 14;
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
          traits: baselineTraits(),
        });
      }
      edit(world);
      expect(restoreWorld(JSON.stringify(world))).toBeNull();
    }
  });
});
