import { describe, expect, it } from 'vitest';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { createWorld, stepWorld } from '../src/world/simulation';
import type { World } from '../src/world/types';

function previousRevision(world: World): Record<string, unknown> {
  const previous = structuredClone(world) as unknown as Record<string, unknown>;
  previous.schemaRevision = 10;
  delete previous.lastSeenAt;
  return previous;
}

describe('catch-up snapshot revision', () => {
  it('migrates revision 10 with a missing last-seen time and no gifted populations', () => {
    const before = createWorld(51);
    before.elapsed = 80;
    before.tick = 2400;
    const old = previousRevision(before);
    const source = JSON.stringify(old);
    const migrated = restoreWorld(source)!;
    expect(migrated).not.toBeNull();
    expect(migrated).toMatchObject({
      schemaRevision: 11,
      lastSeenAt: null,
      remains: old.remains,
      marlgrubs: old.marlgrubs,
      nextId: old.nextId,
      tick: old.tick,
      elapsed: old.elapsed,
      randomState: old.randomState,
      sediment: old.sediment,
      organisms: old.organisms,
      grazers: old.grazers,
      cargoMites: old.cargoMites,
    });
    expect(migrated.organisms.length).toBe(before.organisms.length);
    expect(migrated.grazers.length).toBe(before.grazers.length);
    expect(migrated.skimmers).toEqual([]);
    expect(migrated.marlgrubs).toEqual([]);
    expect(JSON.stringify(old)).toBe(source);
    expect(restoreWorld(serializeWorld(migrated))).toEqual(migrated);
  });

  it('round-trips a stamped last-seen time and continues identically', () => {
    const world = createWorld(12);
    world.lastSeenAt = 1_700_000_000_000;
    for (let step = 0; step < 30; step++) stepWorld(world);
    const resumed = restoreWorld(serializeWorld(world))!;
    expect(resumed.lastSeenAt).toBe(1_700_000_000_000);
    expect(resumed).toEqual(world);
    for (let step = 0; step < 90; step++) {
      stepWorld(world);
      stepWorld(resumed);
    }
    expect(resumed).toEqual(world);
  });

  it('rejects hybrids, future revisions, and malformed last-seen stamps', () => {
    const edits: ((world: Record<string, unknown>) => void)[] = [
      (w) => {
        delete w.lastSeenAt;
      },
      (w) => {
        w.lastSeenAt = -1;
      },
      (w) => {
        w.lastSeenAt = 1.5;
      },
      (w) => {
        w.lastSeenAt = 'yesterday';
      },
      (w) => {
        w.schemaRevision = 10;
      },
      (w) => {
        w.schemaRevision = 12;
      },
    ];
    for (const edit of edits) {
      const world = structuredClone(createWorld(4)) as unknown as Record<string, unknown>;
      world.lastSeenAt = 1_700_000_000_000;
      edit(world);
      expect(restoreWorld(JSON.stringify(world))).toBeNull();
    }
    const old = previousRevision(createWorld(4));
    old.lastSeenAt = 1_700_000_000_000;
    expect(restoreWorld(JSON.stringify(old))).toBeNull();
  });
});
