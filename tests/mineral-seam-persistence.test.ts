import { describe, expect, it } from 'vitest';
import { MINERAL_SEAM, pigmentNearSeam, seamRemaining } from '../src/world/environment/mineral-seam';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { createWorld, stepWorld } from '../src/world/simulation';
import { SCHEMA_REVISION, type World } from '../src/world/types';

function previousRevision(world: World): Record<string, unknown> {
  const previous = structuredClone(world) as unknown as Record<string, any>;
  previous.schemaRevision = 13;
  delete previous.seamAccrued;
  delete previous.ecologyLedger.seamDissolved;
  return previous;
}

describe('mineral seam snapshot revision', () => {
  it('migrates revision 13 with a full vein and no gifted pigment or life', () => {
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
      seamAccrued: 0,
      nextId: old.nextId,
      tick: old.tick,
      elapsed: old.elapsed,
      randomState: old.randomState,
      sediment: old.sediment,
      organisms: old.organisms,
      grazers: old.grazers,
      nests: old.nests,
    });
    expect(migrated.ecologyLedger.seamDissolved).toBe(0);
    expect(seamRemaining(migrated)).toBe(MINERAL_SEAM.capacity);
    expect(pigmentNearSeam(migrated)).toBe(0);
    expect(migrated.skimmers).toEqual([]);
    expect(JSON.stringify(old)).toBe(source);
    expect(restoreWorld(serializeWorld(migrated))).toEqual(migrated);
  });

  it('round-trips a leaching seam and continues identically', () => {
    const world = createWorld(51);
    for (let step = 0; step < 1800; step++) stepWorld(world);
    expect(world.ecologyLedger.seamDissolved).toBeGreaterThan(0);
    const resumed = restoreWorld(serializeWorld(world))!;
    expect(resumed).toEqual(world);
    for (let step = 0; step < 180; step++) {
      stepWorld(world);
      stepWorld(resumed);
    }
    expect(resumed).toEqual(world);
  });

  it('rejects hybrids, future revisions, and overfull veins', () => {
    const edits: ((world: Record<string, unknown>) => void)[] = [
      (w) => {
        delete w.seamAccrued;
      },
      (w) => {
        delete (w.ecologyLedger as { seamDissolved?: number }).seamDissolved;
      },
      (w) => {
        w.schemaRevision = 13;
      },
      (w) => {
        w.schemaRevision = 15;
      },
      (w) => {
        w.seamAccrued = 2;
      },
      (w) => {
        (w.ecologyLedger as { seamDissolved: number }).seamDissolved = MINERAL_SEAM.capacity + 1;
      },
    ];
    for (const edit of edits) {
      const world = structuredClone(createWorld(4)) as unknown as Record<string, unknown>;
      edit(world);
      expect(restoreWorld(JSON.stringify(world))).toBeNull();
    }
    const old = previousRevision(createWorld(4));
    old.seamAccrued = 0;
    expect(restoreWorld(JSON.stringify(old))).toBeNull();
  });
});
