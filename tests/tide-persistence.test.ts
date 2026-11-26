import { describe, expect, it } from 'vitest';
import { inSea } from '../src/world/habitat';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { createWorld, stepWorld } from '../src/world/simulation';
import { SCHEMA_REVISION, type World } from '../src/world/types';

function previousRevision(world: World): Record<string, unknown> {
  const previous = structuredClone(world) as unknown as Record<string, unknown>;
  previous.schemaRevision = 19;
  previous.organisms = world.organisms.filter((entry) => !inSea(entry.x, entry.y));
  previous.sediment = world.sediment.filter((entry) => !inSea(entry.x, entry.y));
  const ledger = previous.ecologyLedger as {
    tidePigmentIn?: number;
    tidePigmentOut?: number;
    tideArrivals?: number;
    tideDepartures?: number;
    strandlineSettled?: number;
    strandlineLeached?: number;
  };
  delete ledger.tidePigmentIn;
  delete ledger.tidePigmentOut;
  delete ledger.tideArrivals;
  delete ledger.tideDepartures;
  delete ledger.strandlineSettled;
  delete ledger.strandlineLeached;
  return previous;
}

describe('tide snapshot revision', () => {
  it('migrates revision 19 with an empty sea and no gifted life or pigment', () => {
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
    expect(migrated.organisms.filter((entry) => inSea(entry.x, entry.y))).toHaveLength(0);
    expect(migrated.sediment.filter((entry) => inSea(entry.x, entry.y))).toHaveLength(0);
    expect(migrated.ecologyLedger.tidePigmentIn).toBe(0);
    expect(migrated.ecologyLedger.tidePigmentOut).toBe(0);
    expect(migrated.ecologyLedger.tideArrivals).toBe(0);
    expect(migrated.ecologyLedger.tideDepartures).toBe(0);
    expect(migrated.ecologyLedger.strandlineSettled).toBe(0);
    expect(migrated.ecologyLedger.strandlineLeached).toBe(0);
    expect(JSON.stringify(old)).toBe(source);
    expect(restoreWorld(serializeWorld(migrated))).toEqual(migrated);
  });

  it('round-trips a connected shore and continues identically', () => {
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

  it('rejects hybrids, future revisions, and missing tide ledgers', () => {
    const edits: ((world: Record<string, unknown>) => void)[] = [
      (w) => {
        delete (w.ecologyLedger as { tideArrivals?: number }).tideArrivals;
      },
      (w) => {
        delete (w.ecologyLedger as { tideDepartures?: number }).tideDepartures;
      },
      (w) => {
        delete (w.ecologyLedger as { tidePigmentIn?: number }).tidePigmentIn;
      },
      (w) => {
        delete (w.ecologyLedger as { tidePigmentOut?: number }).tidePigmentOut;
      },
      (w) => {
        w.schemaRevision = 19;
      },
      (w) => {
        w.schemaRevision = 22;
      },
      (w) => {
        (w.ecologyLedger as { tideArrivals: number }).tideArrivals = -1;
      },
    ];
    for (const edit of edits) {
      const world = structuredClone(createWorld(4)) as unknown as Record<string, unknown>;
      edit(world);
      expect(restoreWorld(JSON.stringify(world))).toBeNull();
    }
    const old = previousRevision(createWorld(4));
    (old.ecologyLedger as { tideArrivals: number }).tideArrivals = 0;
    expect(restoreWorld(JSON.stringify(old))).toBeNull();
  });
});
