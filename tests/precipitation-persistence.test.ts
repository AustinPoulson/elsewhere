import { describe, expect, it } from 'vitest';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { createWorld, stepWorld } from '../src/world/simulation';
import { SCHEMA_REVISION, type World } from '../src/world/types';

function previousRevision(world: World): Record<string, unknown> {
  const previous = structuredClone(world) as unknown as Record<string, unknown>;
  previous.schemaRevision = 21;
  const ledger = previous.ecologyLedger as { precipitated?: number };
  delete ledger.precipitated;
  return previous;
}

describe('precipitation snapshot revision', () => {
  it('migrates revision 21 with a zero precipitation ledger and no gifted grains', () => {
    const before = createWorld(51);
    before.elapsed = 80;
    before.tick = 2400;
    const grainCount = before.sediment.length;
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
    expect(migrated.sediment).toHaveLength(grainCount);
    expect(migrated.ecologyLedger.precipitated).toBe(0);
    expect(JSON.stringify(old)).toBe(source);
    expect(restoreWorld(serializeWorld(migrated))).toEqual(migrated);
  });

  it('round-trips a shore that has already precipitated and continues identically', () => {
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

  it('rejects hybrids, future revisions, and missing precipitation ledgers', () => {
    const edits: ((world: Record<string, unknown>) => void)[] = [
      (w) => {
        delete (w.ecologyLedger as { precipitated?: number }).precipitated;
      },
      (w) => {
        w.schemaRevision = 21;
      },
      (w) => {
        w.schemaRevision = 23;
      },
      (w) => {
        (w.ecologyLedger as { precipitated: number }).precipitated = -1;
      },
    ];
    for (const edit of edits) {
      const world = structuredClone(createWorld(4)) as unknown as Record<string, unknown>;
      edit(world);
      expect(restoreWorld(JSON.stringify(world))).toBeNull();
    }
    const old = previousRevision(createWorld(4));
    (old.ecologyLedger as { precipitated: number }).precipitated = 0;
    expect(restoreWorld(JSON.stringify(old))).toBeNull();
  });
});
