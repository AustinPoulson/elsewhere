import { describe, expect, it } from 'vitest';
import { linkedHabitat } from '../src/world/habitat';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { createWorld, stepWorld } from '../src/world/simulation';
import { SCHEMA_REVISION, type World } from '../src/world/types';

function previousRevision(world: World): Record<string, unknown> {
  const previous = structuredClone(world) as unknown as Record<string, unknown>;
  previous.schemaRevision = 12;
  delete previous.pools;
  delete previous.seamAccrued;
  delete previous.channel;
  delete (previous.ecologyLedger as { seamDissolved?: number }).seamDissolved;
  return previous;
}

describe('linked habitat snapshot revision', () => {
  it('migrates revision 12 with the second pool and channel and no gifted life or pigment', () => {
    const before = createWorld(51);
    before.elapsed = 80;
    before.tick = 2400;
    const old = previousRevision(before);
    const source = JSON.stringify(old);
    const migrated = restoreWorld(source)!;
    const habitat = linkedHabitat();
    expect(migrated).not.toBeNull();
    expect(migrated).toMatchObject({
      schemaRevision: SCHEMA_REVISION,
      lastSeenAt: null,
      pools: habitat.pools,
      channel: habitat.channel,
      nextId: old.nextId,
      tick: old.tick,
      elapsed: old.elapsed,
      randomState: old.randomState,
      sediment: old.sediment,
      organisms: old.organisms,
      grazers: old.grazers,
      nests: old.nests,
      fossils: old.fossils,
    });
    expect(migrated.skimmers).toEqual([]);
    expect(migrated.ecologyLedger.fossilsFormed).toBe(before.ecologyLedger.fossilsFormed);
    expect(JSON.stringify(old)).toBe(source);
    expect(restoreWorld(serializeWorld(migrated))).toEqual(migrated);
  });

  it('round-trips a present habitat and continues identically', () => {
    const world = createWorld(51);
    expect(world.schemaRevision).toBe(SCHEMA_REVISION);
    const resumed = restoreWorld(serializeWorld(world))!;
    expect(resumed).toEqual(world);
    for (let step = 0; step < 180; step++) {
      stepWorld(world);
      stepWorld(resumed);
    }
    expect(resumed).toEqual(world);
  });

  it('rejects hybrids, future revisions, and rewritten habitats', () => {
    const edits: ((world: Record<string, unknown>) => void)[] = [
      (w) => {
        delete w.pools;
      },
      (w) => {
        delete w.channel;
      },
      (w) => {
        w.schemaRevision = 12;
      },
      (w) => {
        w.schemaRevision = 15;
      },
      (w) => {
        (w.pools as { x: number }[])[1].x = 900;
      },
      (w) => {
        (w.channel as { flow: number }).flow = 20;
      },
      (w) => {
        w.pools = [];
      },
    ];
    for (const edit of edits) {
      const world = structuredClone(createWorld(4)) as unknown as Record<string, unknown>;
      edit(world);
      expect(restoreWorld(JSON.stringify(world))).toBeNull();
    }
    const old = previousRevision(createWorld(4));
    old.pools = linkedHabitat().pools;
    expect(restoreWorld(JSON.stringify(old))).toBeNull();
  });
});
