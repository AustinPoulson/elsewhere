import { describe, expect, it } from 'vitest';
import { inStrandline } from '../src/world/habitat';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { createWorld, stepWorld } from '../src/world/simulation';
import { SCHEMA_REVISION, type World } from '../src/world/types';

function previousRevision(world: World): Record<string, unknown> {
  const previous = structuredClone(world) as unknown as Record<string, unknown>;
  previous.schemaRevision = 20;
  const ledger = previous.ecologyLedger as {
    strandPigmentIn?: number;
    strandPigmentOut?: number;
  };
  delete ledger.strandPigmentIn;
  delete ledger.strandPigmentOut;
  return previous;
}

describe('strandline snapshot revision', () => {
  it('migrates revision 20 with an empty strandline and no gifted wrack', () => {
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
      nextId: old.nextId,
      tick: old.tick,
      elapsed: old.elapsed,
      randomState: old.randomState,
      sediment: old.sediment,
      organisms: old.organisms,
      grazers: old.grazers,
      nests: old.nests,
    });
    expect(migrated.sediment.filter((entry) => inStrandline(entry.x, entry.y))).toHaveLength(0);
    expect(migrated.ecologyLedger.strandPigmentIn).toBe(0);
    expect(migrated.ecologyLedger.strandPigmentOut).toBe(0);
    expect(migrated.ecologyLedger.tideArrivals).toBe((old.ecologyLedger as { tideArrivals: number }).tideArrivals);
    expect(JSON.stringify(old)).toBe(source);
    expect(restoreWorld(serializeWorld(migrated))).toEqual(migrated);
  });

  it('round-trips a shore with wrack and continues identically', () => {
    const world = createWorld(51);
    for (let step = 0; step < 1800; step++) stepWorld(world);
    const resumed = restoreWorld(serializeWorld(world))!;
    expect(resumed).toEqual(world);
    for (let step = 0; step < 180; step++) {
      stepWorld(world);
      stepWorld(resumed);
    }
    expect(resumed).toEqual(world);
  });

  it('rejects hybrids, future revisions, and missing strandline ledgers', () => {
    const edits: ((world: Record<string, unknown>) => void)[] = [
      (w) => {
        delete (w.ecologyLedger as { strandPigmentIn?: number }).strandPigmentIn;
      },
      (w) => {
        delete (w.ecologyLedger as { strandPigmentOut?: number }).strandPigmentOut;
      },
      (w) => {
        w.schemaRevision = 20;
      },
      (w) => {
        w.schemaRevision = 22;
      },
      (w) => {
        (w.ecologyLedger as { strandPigmentIn: number }).strandPigmentIn = -1;
      },
    ];
    for (const edit of edits) {
      const world = structuredClone(createWorld(4)) as unknown as Record<string, unknown>;
      edit(world);
      expect(restoreWorld(JSON.stringify(world))).toBeNull();
    }
    const old = previousRevision(createWorld(4));
    (old.ecologyLedger as { strandPigmentIn: number }).strandPigmentIn = 0;
    expect(restoreWorld(JSON.stringify(old))).toBeNull();
  });
});
