import { describe, expect, it } from 'vitest';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { createWorld, stepWorld } from '../src/world/simulation';
import { depositFossil } from '../src/world/species/fossils';
import { depositRemain } from '../src/world/species/remains';
import type { World } from '../src/world/types';

function previousRevision(world: World): Record<string, unknown> {
  const previous = structuredClone(world) as unknown as Record<string, any>;
  previous.schemaRevision = 11;
  delete previous.fossils;
  delete previous.pools;
  delete previous.channel;
  delete previous.ecologyLedger.fossilsFormed;
  for (const remain of previous.remains ?? []) delete remain.source;
  return previous;
}

function fossilized(): World {
  const world = createWorld(51);
  world.elapsed = 80;
  world.tick = 2400;
  depositFossil(world, { x: 720, y: 500 }, 42, 0.35, 'glassLimpet');
  return world;
}

describe('fossil snapshot revision', () => {
  it('migrates revision 11 with empty fossils, unknown remain sources, and no gifted populations', () => {
    const before = createWorld(51);
    before.elapsed = 80;
    before.tick = 2400;
    depositRemain(before, { x: 720, y: 500 }, 42, 0.4, 'unknown');
    const old = previousRevision(before);
    const source = JSON.stringify(old);
    const migrated = restoreWorld(source)!;
    expect(migrated).not.toBeNull();
    expect(migrated).toMatchObject({
      schemaRevision: 13,
      lastSeenAt: null,
      fossils: [],
      nextId: old.nextId,
      tick: old.tick,
      elapsed: old.elapsed,
      randomState: old.randomState,
      sediment: old.sediment,
      organisms: old.organisms,
    });
    expect(migrated.ecologyLedger.fossilsFormed).toBe(0);
    expect(migrated.remains.every((remain) => remain.source === 'unknown')).toBe(true);
    expect(migrated.skimmers).toEqual([]);
    expect(JSON.stringify(old)).toBe(source);
    expect(restoreWorld(serializeWorld(migrated))).toEqual(migrated);
  });

  it('round-trips fossils and continues identically', () => {
    const world = fossilized();
    expect(world.fossils.length).toBeGreaterThan(0);
    const resumed = restoreWorld(serializeWorld(world))!;
    expect(resumed).toEqual(world);
    for (let step = 0; step < 180; step++) {
      stepWorld(world);
      stepWorld(resumed);
    }
    expect(resumed).toEqual(world);
  });

  it('rejects hybrids, future revisions, and malformed fossils', () => {
    const edits: ((world: Record<string, any>) => void)[] = [
      (w) => {
        delete w.fossils;
      },
      (w) => {
        delete w.ecologyLedger.fossilsFormed;
      },
      (w) => {
        w.schemaRevision = 11;
      },
      (w) => {
        w.schemaRevision = 14;
      },
      (w) => {
        w.fossils[0].pigment = 1.3;
      },
      (w) => {
        w.fossils[0].source = 'lucent';
      },
      (w) => {
        w.fossils[0].species = 'remain';
      },
      (w) => {
        w.remains[0].source = 'ghost';
      },
    ];
    for (const edit of edits) {
      const world = structuredClone(fossilized()) as Record<string, any>;
      if (world.fossils.length === 0) {
        world.fossils.push({
          id: world.nextId++,
          species: 'fossil',
          source: 'skimmer',
          x: 720,
          y: 500,
          pigment: 0.2,
          hue: 40,
          age: 1,
          radius: 6,
          formedAt: 1,
        });
      }
      if (world.remains.length === 0) {
        world.remains.push({
          id: world.nextId++,
          species: 'remain',
          source: 'unknown',
          x: 700,
          y: 500,
          pigment: 0.2,
          hue: 40,
          age: 1,
          radius: 6,
        });
      }
      edit(world);
      expect(restoreWorld(JSON.stringify(world))).toBeNull();
    }
    const old = previousRevision(createWorld(4));
    old.fossils = [];
    expect(restoreWorld(JSON.stringify(old))).toBeNull();
  });
});
