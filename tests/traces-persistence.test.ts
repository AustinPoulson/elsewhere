import { describe, expect, it } from 'vitest';
import { WorldSession } from '../src/app/session';
import { catchUpWorld, planCatchUp } from '../src/world/catchup';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { createWorld, stepWorld } from '../src/world/simulation';
import {
  TRACE_FADE_SECONDS,
  TRACE_MARK_CAP,
  TRACE_MEMORY_CAP,
  composeAwayTraces,
  settleAwayTraces,
  traceStrength,
} from '../src/world/traces';
import { SCHEMA_REVISION, type AwayTrace, type World } from '../src/world/types';

function previousRevision(world: World): Record<string, unknown> {
  const previous = structuredClone(world) as unknown as Record<string, unknown>;
  previous.schemaRevision = 14;
  delete previous.awayTraces;
  delete previous.shoreMemory;
  return previous;
}

function sampleTrace(formedAt: number, strength = 0.5): AwayTrace {
  return (
    composeAwayTraces({
      formedAt,
      extinctions: [{ species: 'glassLimpets', at: formedAt, x: 640, y: 520, hue: 40 }],
      seamReleased: 0,
      deepDelta: 0,
      inletDelta: 0,
      inletBodiesDelta: 0,
      channelOccupied: false,
    })[0] ?? {
      kind: 'extinction',
      x: 640,
      y: 520,
      hue: 40,
      strength,
      formedAt,
    }
  );
}

describe('away-trace snapshot revision', () => {
  it('migrates revision 14 with no marks and no shore memory', () => {
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
      awayTraces: [],
      shoreMemory: [],
      nextId: old.nextId,
      tick: old.tick,
      elapsed: old.elapsed,
      randomState: old.randomState,
      sediment: old.sediment,
      organisms: old.organisms,
    });
    expect(JSON.stringify(old)).toBe(source);
    expect(restoreWorld(serializeWorld(migrated))).toEqual(migrated);
  });

  it('round-trips unfaded marks and continues fading from the saved clock', () => {
    const world = createWorld(1);
    catchUpWorld(world, planCatchUp(0, 600_000));
    expect(world.awayTraces.length).toBeGreaterThan(0);
    const remaining = world.awayTraces.map((trace) => traceStrength(trace, world.elapsed));
    const resumed = restoreWorld(serializeWorld(world))!;
    expect(resumed.awayTraces).toEqual(world.awayTraces);
    expect(resumed.awayTraces.map((trace) => traceStrength(trace, resumed.elapsed))).toEqual(remaining);
    for (let step = 0; step < 180; step++) {
      stepWorld(world);
      stepWorld(resumed);
    }
    expect(resumed.randomState).toBe(world.randomState);
    expect(resumed.ecologyLedger).toEqual(world.ecologyLedger);
    expect(resumed.awayTraces.map((trace) => traceStrength(trace, resumed.elapsed))).toEqual(
      world.awayTraces.map((trace) => traceStrength(trace, world.elapsed)),
    );
  });

  it('compacts faded marks into bounded shore memory on restore', () => {
    const world = createWorld(12);
    world.awayTraces = [sampleTrace(0)];
    world.elapsed = TRACE_FADE_SECONDS;
    world.tick = Math.round(TRACE_FADE_SECONDS * 30);
    const resumed = restoreWorld(serializeWorld(world))!;
    expect(resumed.awayTraces).toEqual([]);
    expect(resumed.shoreMemory).toEqual([{ formedAt: 0, kinds: ['extinction'] }]);
    expect(resumed.shoreMemory.length).toBeLessThanOrEqual(TRACE_MEMORY_CAP);
    const settled = settleAwayTraces(world.awayTraces, world.shoreMemory, world.elapsed);
    expect(settled).toEqual({ traces: resumed.awayTraces, memory: resumed.shoreMemory });
  });

  it('leaves opening worlds, imports, and named-era opens without marks', () => {
    const opening = createWorld(4);
    expect(opening.awayTraces).toEqual([]);
    expect(opening.shoreMemory).toEqual([]);
    const marked = createWorld(1);
    catchUpWorld(marked, planCatchUp(0, 600_000));
    expect(marked.awayTraces.length).toBeGreaterThan(0);
    const session = new WorldSession(createWorld(2));
    expect(session.importSnapshot(serializeWorld(marked), session.importToken())).toBe('imported');
    expect(session.world.awayTraces).toEqual([]);
    expect(session.world.shoreMemory).toEqual([]);
    expect(session.world.seed).toBe(1);
  });

  it('rejects hybrids, future revisions, and overfull memory', () => {
    const edits: ((world: Record<string, unknown>) => void)[] = [
      (w) => {
        delete w.awayTraces;
      },
      (w) => {
        delete w.shoreMemory;
      },
      (w) => {
        w.schemaRevision = 14;
      },
      (w) => {
        w.schemaRevision = 16;
      },
      (w) => {
        w.awayTraces = Array.from({ length: TRACE_MARK_CAP + 1 }, () => sampleTrace(0));
      },
      (w) => {
        w.shoreMemory = Array.from({ length: TRACE_MEMORY_CAP + 1 }, (_, index) => ({
          formedAt: index,
          kinds: ['seam'],
        }));
      },
      (w) => {
        w.awayTraces = [{ kind: 'ghost', x: 720, y: 500, hue: 10, strength: 0.4, formedAt: 0 }];
      },
    ];
    for (const edit of edits) {
      const world = structuredClone(createWorld(4)) as unknown as Record<string, unknown>;
      edit(world);
      expect(restoreWorld(JSON.stringify(world))).toBeNull();
    }
    const old = previousRevision(createWorld(4));
    old.awayTraces = [];
    expect(restoreWorld(JSON.stringify(old))).toBeNull();
  });
});
