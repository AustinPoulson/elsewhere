import { describe, expect, it } from 'vitest';
import {
  catchUpWorld,
  catchUpWorldChunked,
  composeJournal,
  planCatchUp,
  type CatchUpEvents,
  type ResourceSnapshot,
} from '../src/world/catchup';
import { DEEP_BASIN } from '../src/world/environment/depth';
import { MINERAL_SEAM } from '../src/world/environment/mineral-seam';
import { INLET_POOL, channelSegment } from '../src/world/habitat';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { createWorld, stepWorld } from '../src/world/simulation';
import {
  TRACE_FADE_SECONDS,
  TRACE_MARK_CAP,
  TRACE_MEMORY_CAP,
  composeAwayTraces,
  describeAwayTraces,
  describeShoreMemory,
  holdTracesAcrossCatchUp,
  recordAwayTraces,
  settleAwayTraces,
  traceStrength,
  visibleAwayTraces,
  type AwayTrace,
} from '../src/world/traces';
import { FIXED_STEP, SCHEMA_REVISION } from '../src/world/types';

function idleEvents(): CatchUpEvents {
  return {
    lucents: { births: 0, deaths: 0, extinctAt: null },
    grazers: { births: 0, deaths: 0, extinctAt: null },
    skimmers: { births: 0, deaths: 0, extinctAt: null },
    reedwells: { births: 0, deaths: 0, extinctAt: null },
    rainbells: { births: 0, deaths: 0, extinctAt: null },
    siltstitchers: { births: 0, deaths: 0, extinctAt: null },
    glassLimpets: { births: 0, deaths: 0, extinctAt: null },
    cargoMites: { births: 0, deaths: 0, extinctAt: null },
    marlgrubs: { births: 0, deaths: 0, extinctAt: null },
  };
}

const quietResources: ResourceSnapshot = {
  loosePigment: 1,
  nestedPigment: 1,
  remainPigment: 0,
  fossilPigment: 0,
  fossils: 0,
  seamRemaining: 24,
  seamDissolved: 0,
  deepPigment: 0,
};

function facts(overrides: Partial<Parameters<typeof composeAwayTraces>[0]> = {}) {
  return {
    formedAt: 3600,
    extinctions: [],
    seamReleased: 0,
    deepDelta: 0,
    inletDelta: 0,
    inletBodiesDelta: 0,
    channelOccupied: false,
    ...overrides,
  };
}

describe('away traces from recorded events', () => {
  it('invents nothing when catch-up recorded no events', () => {
    expect(composeAwayTraces(facts())).toEqual([]);
    expect(describeAwayTraces([])).toBeNull();
  });

  it('places extinction marks at last-body positions and color marks on authored geometry', () => {
    const traces = composeAwayTraces(
      facts({
        extinctions: [
          { species: 'glassLimpets', at: 800, x: 640, y: 520, hue: 40 },
          { species: 'reedwells', at: 1200, x: 700, y: 480, hue: 90 },
          { species: 'rainbells', at: 400, x: 500, y: 400, hue: 200 },
        ],
        seamReleased: 2.4,
        deepDelta: 0.5,
        inletDelta: 0.6,
        inletBodiesDelta: 1,
        channelOccupied: true,
      }),
    );
    expect(traces.length).toBe(TRACE_MARK_CAP);
    expect(traces.filter((trace) => trace.kind === 'extinction')).toEqual([
      expect.objectContaining({ kind: 'extinction', x: 700, y: 480, hue: 90 }),
      expect.objectContaining({ kind: 'extinction', x: 640, y: 520, hue: 40 }),
    ]);
    expect(traces.some((trace) => trace.kind === 'channel')).toBe(true);
    expect(traces.some((trace) => trace.kind === 'deep')).toBe(true);
    expect(traces.some((trace) => trace.kind === 'seam')).toBe(true);
    expect(traces.some((trace) => trace.kind === 'inlet')).toBe(false);
    const path = channelSegment();
    const channel = traces.find((trace) => trace.kind === 'channel');
    expect(channel).toMatchObject({ x: path.ax, y: path.ay, x2: path.bx, y2: path.by });
    const deep = traces.find((trace) => trace.kind === 'deep');
    expect(deep).toMatchObject({ x: DEEP_BASIN.x, y: DEEP_BASIN.y });
    const seam = traces.find((trace) => trace.kind === 'seam');
    expect(seam).toMatchObject({ x: MINERAL_SEAM.ax, y: MINERAL_SEAM.ay, x2: MINERAL_SEAM.bx, y2: MINERAL_SEAM.by });
  });

  it('marks the inlet from geometry when color arrived there', () => {
    const traces = composeAwayTraces(facts({ inletDelta: 0.5 }));
    expect(traces).toEqual([
      expect.objectContaining({ kind: 'channel' }),
      expect.objectContaining({ kind: 'inlet', x: INLET_POOL.x, y: INLET_POOL.y }),
    ]);
  });

  it('keeps one mark per extinct species and ignores a later re-founding in the composer input', () => {
    const traces = composeAwayTraces(
      facts({
        extinctions: [
          { species: 'glassLimpets', at: 100, x: 1, y: 1, hue: 10 },
          { species: 'glassLimpets', at: 900, x: 2, y: 2, hue: 20 },
        ],
      }),
    );
    expect(traces).toEqual([expect.objectContaining({ kind: 'extinction', x: 2, y: 2, hue: 20 })]);
  });

  it('fades over watched time and expires', () => {
    const trace: AwayTrace = {
      kind: 'seam',
      x: MINERAL_SEAM.ax,
      y: MINERAL_SEAM.ay,
      hue: MINERAL_SEAM.hue,
      strength: 0.5,
      formedAt: 100,
    };
    expect(traceStrength(trace, 100)).toBeCloseTo(0.5, 5);
    expect(traceStrength(trace, 100 + TRACE_FADE_SECONDS / 2)).toBeCloseTo(0.25, 5);
    expect(traceStrength(trace, 100 + TRACE_FADE_SECONDS)).toBe(0);
    expect(visibleAwayTraces([trace], 100 + TRACE_FADE_SECONDS)).toEqual([]);
  });

  it('names marks in the field journal without replacing what happened', () => {
    const events = idleEvents();
    events.glassLimpets = { births: 0, deaths: 1, extinctAt: 100 };
    const traces = composeAwayTraces(
      facts({
        formedAt: 7300,
        extinctions: [{ species: 'glassLimpets', at: 100, x: 640, y: 520, hue: 40 }],
      }),
    );
    const journal = composeJournal(
      { reason: 'ready', awaySeconds: 7200, simulateSeconds: 7200, sleptSeconds: 0 },
      events,
      quietResources,
      quietResources,
      7300,
      traces,
    );
    expect(journal.lines).toContain('The last glass limpet died about two hours ago.');
    expect(journal.lines).toContain('A faint mark remains where that lineage ended.');
  });

  it('quietly recalls faded returns in the journal and observations copy', () => {
    const memory = [{ formedAt: 100, kinds: ['extinction' as const, 'seam' as const] }];
    expect(describeShoreMemory(memory)).toBe(
      'The shore still remembers an earlier return: a lineage ending, and color that moved.',
    );
    expect(
      describeShoreMemory([
        { formedAt: 100, kinds: ['inlet'] },
        { formedAt: 200, kinds: ['channel'] },
      ]),
    ).toBe('The shore still remembers a few earlier returns.');
    const journal = composeJournal(
      { reason: 'ready', awaySeconds: 3600, simulateSeconds: 3600, sleptSeconds: 0 },
      idleEvents(),
      quietResources,
      quietResources,
      3600,
      composeAwayTraces(facts({ seamReleased: 1 })),
      memory,
    );
    expect(journal.lines).toContain('The shore kept a faint stain of color that settled while you were gone.');
    expect(journal.lines).toContain(
      'The shore still remembers an earlier return: a lineage ending, and color that moved.',
    );
  });

  it('holds fade across unwatched catch-up and archives a replaced return', () => {
    const trace: AwayTrace = {
      kind: 'seam',
      x: MINERAL_SEAM.ax,
      y: MINERAL_SEAM.ay,
      hue: MINERAL_SEAM.hue,
      strength: 0.5,
      formedAt: 100,
    };
    const held = holdTracesAcrossCatchUp([trace], 180);
    expect(traceStrength(held[0], 280)).toBeCloseTo(traceStrength(trace, 100), 5);
    const faded: AwayTrace = { ...trace, formedAt: 0 };
    const settled = settleAwayTraces([faded], [], TRACE_FADE_SECONDS);
    expect(settled.traces).toEqual([]);
    expect(settled.memory).toEqual([{ formedAt: 0, kinds: ['seam'] }]);
    const next = recordAwayTraces([trace], [], composeAwayTraces(facts({ formedAt: 400, inletDelta: 0.5 })), 400);
    expect(next.memory).toEqual([{ formedAt: 100, kinds: ['seam'] }]);
    expect(next.traces.some((entry) => entry.kind === 'inlet')).toBe(true);
    expect(next.memory.length).toBeLessThanOrEqual(TRACE_MEMORY_CAP);
  });
});

function ecologyOf(world: ReturnType<typeof createWorld>) {
  const { awayTraces: _traces, shoreMemory: _memory, ...rest } = world;
  return rest;
}

describe('catch-up writes traces into the save without touching ledgers', () => {
  it('does not create traces when the clock is unsafe', () => {
    const world = createWorld(3);
    const report = catchUpWorld(world, planCatchUp(null, Date.now()));
    expect(report.traces).toEqual([]);
    expect(report.steps).toBe(0);
    expect(world.awayTraces).toEqual([]);
  });

  it('stores unfaded marks in revision 15 without changing the simulated world', () => {
    expect(SCHEMA_REVISION).toBe(15);
    const world = createWorld(1);
    const live = createWorld(1);
    expect(world.awayTraces).toEqual([]);
    expect(world.shoreMemory).toEqual([]);
    const plan = planCatchUp(0, 600_000);
    const report = catchUpWorld(world, plan);
    const steps = Math.ceil(600 / FIXED_STEP);
    for (let i = 0; i < steps; i++) stepWorld(live);
    expect(ecologyOf(world)).toEqual(ecologyOf(live));
    expect(world.randomState).toBe(live.randomState);
    expect(world.ecologyLedger).toEqual(live.ecologyLedger);
    expect(report.traces.length).toBeGreaterThan(0);
    expect(report.traces.length).toBeLessThanOrEqual(TRACE_MARK_CAP);
    expect(report.traces.some((trace) => trace.kind === 'seam')).toBe(true);
    expect(world.awayTraces).toEqual(report.traces);
    const snapshot = JSON.parse(serializeWorld(world)) as Record<string, unknown>;
    expect(snapshot.schemaRevision).toBe(15);
    expect(snapshot.awayTraces).toEqual(report.traces);
    expect(restoreWorld(serializeWorld(world))).toEqual(world);
    expect(live.awayTraces).toEqual([]);
  });

  it('chunked catch-up records the same traces as the synchronous path', async () => {
    const plan = planCatchUp(0, 12_000);
    const syncWorld = createWorld(7);
    const asyncWorld = createWorld(7);
    const sync = catchUpWorld(syncWorld, plan);
    const chunked = await catchUpWorldChunked(asyncWorld, plan, { chunkMs: 1, yieldToMain: async () => undefined });
    expect(serializeWorld(asyncWorld)).toBe(serializeWorld(syncWorld));
    expect(chunked.traces).toEqual(sync.traces);
    expect(asyncWorld.awayTraces).toEqual(syncWorld.awayTraces);
  });
});
