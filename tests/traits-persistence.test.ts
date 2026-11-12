import { describe, expect, it } from 'vitest';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { createWorld, stepWorld } from '../src/world/simulation';
import { baselineTraits } from '../src/world/traits';
import { SCHEMA_REVISION, type World } from '../src/world/types';

function previousRevision(world: World): Record<string, unknown> {
  const previous = structuredClone(world) as Record<string, any>;
  previous.schemaRevision = 8;
  delete previous.lastSeenAt;
  delete previous.fossils;
  delete previous.pools;
  delete previous.seamAccrued;
  delete previous.awayTraces;
  delete previous.shoreMemory;
  delete previous.channel;
  delete previous.ecologyLedger.ambientHarvested;
  delete previous.remains;
  delete previous.marlgrubs;
  delete previous.marlgrubAdmissionAt;
  delete previous.marlgrubCandidateAfterId;
  for (const key of [
    'remainsCreated',
    'remainsConsumed',
    'remainsDecayed',
    'marlgrubIntake',
    'marlgrubMaintenancePigment',
    'fossilsFormed',
    'seamDissolved',
  ])
    delete previous.ecologyLedger[key];
  for (const collection of [
    'organisms',
    'grazers',
    'skimmers',
    'reedwells',
    'rainbells',
    'siltstitchers',
    'glassLimpets',
    'cargoMites',
  ]) {
    previous[collection] = previous[collection].map((entry: { traits?: unknown }) => {
      const { traits: _traits, ...rest } = entry;
      return rest;
    });
  }
  return previous;
}

describe('heritable trait snapshot revision', () => {
  it('migrates revision 8 with baseline traits and no free populations or resources', () => {
    const before = createWorld(743);
    before.elapsed = 50;
    before.tick = 1500;
    const old = previousRevision(before);
    const source = JSON.stringify(old);
    const migrated = restoreWorld(source)!;
    expect(migrated).not.toBeNull();
    expect(migrated.schemaRevision).toBe(SCHEMA_REVISION);
    expect(migrated.remains).toEqual([]);
    expect(migrated.marlgrubs).toEqual([]);
    expect(migrated.cargoMites).toEqual([]);
    expect(migrated.nextId).toBe(old.nextId);
    expect(migrated.tick).toBe(old.tick);
    expect(migrated.elapsed).toBe(old.elapsed);
    expect(migrated.randomState).toBe(old.randomState);
    expect(migrated.sediment).toEqual(old.sediment);
    expect(migrated.ecologyLedger.ambientHarvested).toBe(0);
    expect(migrated.organisms.every((entry) => entry.traits.drive === 1 && entry.traits.bulk === 1)).toBe(true);
    expect(migrated.grazers.every((entry) => entry.traits.drive === 1 && entry.traits.bulk === 1)).toBe(true);
    expect(JSON.stringify(old)).toBe(source);
    expect(restoreWorld(serializeWorld(migrated))).toEqual(migrated);
  });

  it('keeps living cargo mite traits through a round trip and continues the lineage', () => {
    const world = createWorld(28);
    world.elapsed = 80;
    world.tick = 2400;
    const host = world.grazers[0];
    host.cargo = 0.7;
    host.returning = true;
    world.cargoMites.push({
      id: world.nextId++,
      species: 'cargoMite',
      x: host.x,
      y: host.y,
      vx: host.vx,
      vy: host.vy,
      body: 0.1,
      reserve: 0.4,
      age: 40,
      hue: host.hue,
      starvedFor: 0,
      mode: 'attached',
      hostId: host.id,
      targetHostId: null,
      parentId: null,
      nextBirthAt: world.elapsed + 20,
      traits: { drive: 1.12, bulk: 0.88 },
    });
    const resumed = restoreWorld(serializeWorld(world))!;
    expect(resumed).toEqual(world);
    expect(resumed.cargoMites[0].traits).toEqual({ drive: 1.12, bulk: 0.88 });
    for (let step = 0; step < 60; step++) {
      stepWorld(world);
      stepWorld(resumed);
    }
    expect(resumed).toEqual(world);
  });

  it('keeps a stout mite larger paid reserve and rejects overflow on a slighter frame', () => {
    const world = createWorld(28);
    world.elapsed = 80;
    world.tick = 2400;
    const host = world.grazers[0];
    host.cargo = 0.7;
    host.returning = true;
    world.cargoMites.push({
      id: world.nextId++,
      species: 'cargoMite',
      x: host.x,
      y: host.y,
      vx: host.vx,
      vy: host.vy,
      body: 0.1,
      reserve: 0.62,
      age: 40,
      hue: host.hue,
      starvedFor: 0,
      mode: 'attached',
      hostId: host.id,
      targetHostId: null,
      parentId: null,
      nextBirthAt: world.elapsed + 20,
      traits: { drive: 1, bulk: 1.3 },
    });
    expect(restoreWorld(serializeWorld(world))).toEqual(world);
    const overfull = structuredClone(world) as Record<string, any>;
    overfull.cargoMites[0].traits = { drive: 1, bulk: 0.7 };
    expect(restoreWorld(JSON.stringify(overfull))).toBeNull();
  });

  it('rejects missing traits, out-of-range values, future revisions and hybrid ambient ledgers', () => {
    const edits: ((world: Record<string, any>) => void)[] = [
      (w) => {
        delete w.organisms[0].traits;
      },
      (w) => {
        w.organisms[0].traits = { drive: 1 };
      },
      (w) => {
        w.grazers[0].traits.drive = 0.5;
      },
      (w) => {
        w.grazers[0].traits.bulk = 1.8;
      },
      (w) => {
        delete w.ecologyLedger.ambientHarvested;
      },
      (w) => {
        w.schemaRevision = 16;
      },
      (w) => {
        w.schemaRevision = 8;
      },
    ];
    for (const edit of edits) {
      const world = createWorld(4) as unknown as Record<string, any>;
      edit(world);
      expect(restoreWorld(JSON.stringify(world))).toBeNull();
    }
  });

  it('does not invent cargo mites when assigning baseline traits to an older empty world', () => {
    const world = createWorld(9);
    const old = previousRevision(world);
    const migrated = restoreWorld(JSON.stringify(old))!;
    expect(migrated.cargoMites).toEqual([]);
    expect(migrated.skimmers).toEqual([]);
    expect(migrated.organisms[0].traits).toEqual(baselineTraits());
  });
});
