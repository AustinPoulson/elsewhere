import { describe, expect, it } from 'vitest';
import {
  CATCH_UP_JOURNAL_SECONDS,
  CATCH_UP_MAX_SECONDS,
  CATCH_UP_MIN_SECONDS,
  CATCH_UP_PROGRESS_MS,
  catchUpShouldShowProgress,
  catchUpWorld,
  catchUpWorldChunked,
  composeJournal,
  describeSpan,
  planCatchUp,
  remainsLedgerBalanced,
  shouldPresentJournal,
  type CatchUpEvents,
  type ResourceSnapshot,
} from '../src/world/catchup';
import { serializeWorld } from '../src/world/persistence';
import { createWorld, stepWorld } from '../src/world/simulation';
import { FIXED_STEP } from '../src/world/types';

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

describe('catch-up planning', () => {
  it('ignores missing, inverted, and tiny clocks without granting time', () => {
    expect(planCatchUp(null, 1_700_000_000_000)).toMatchObject({
      reason: 'missing',
      simulateSeconds: 0,
      sleptSeconds: 0,
    });
    expect(planCatchUp(undefined, 1_700_000_000_000).reason).toBe('missing');
    expect(planCatchUp(Number.NaN, Date.now()).reason).toBe('missing');
    expect(planCatchUp(50, Number.NaN).reason).toBe('missing');
    expect(planCatchUp(2_000, 1_000)).toMatchObject({ reason: 'backwards', simulateSeconds: 0 });
    expect(planCatchUp(1_000, 1_000 + (CATCH_UP_MIN_SECONDS - 1) * 1000)).toMatchObject({
      reason: 'too-small',
      simulateSeconds: 0,
    });
  });

  it('caps long and absurd absences and records the remainder as sleep', () => {
    const hour = planCatchUp(0, 3600_000);
    expect(hour).toMatchObject({ reason: 'ready', awaySeconds: 3600, simulateSeconds: 3600, sleptSeconds: 0 });
    const over = planCatchUp(0, (CATCH_UP_MAX_SECONDS + 2 * 3600) * 1000);
    expect(over.reason).toBe('ready');
    expect(over.simulateSeconds).toBe(CATCH_UP_MAX_SECONDS);
    expect(over.sleptSeconds).toBe(2 * 3600);
    const absurd = planCatchUp(0, 50 * 365.25 * 24 * 3600 * 1000);
    expect(absurd.reason).toBe('ready');
    expect(absurd.simulateSeconds).toBe(CATCH_UP_MAX_SECONDS);
    expect(absurd.sleptSeconds).toBeGreaterThan(CATCH_UP_MAX_SECONDS);
  });
});

describe('catch-up presentation', () => {
  it('simulates a short gap without opening a journal', () => {
    const seconds = 45;
    const plan = planCatchUp(0, seconds * 1000);
    expect(plan.reason).toBe('ready');
    expect(plan.simulateSeconds).toBe(seconds);
    expect(shouldPresentJournal(plan, idleEvents())).toBe(false);
    const world = createWorld(5);
    const report = catchUpWorld(world, plan);
    expect(report.steps).toBe(Math.ceil(seconds / FIXED_STEP));
    expect(world.elapsed).toBeCloseTo(seconds, 5);
    expect(shouldPresentJournal(plan, report.events)).toBe(false);
  });

  it('opens a journal for a long gap even when little can be named', () => {
    const plan = planCatchUp(0, CATCH_UP_JOURNAL_SECONDS * 1000);
    expect(plan.reason).toBe('ready');
    expect(shouldPresentJournal(plan, idleEvents())).toBe(true);
    const justUnder = planCatchUp(0, (CATCH_UP_JOURNAL_SECONDS - 1) * 1000);
    expect(justUnder.reason).toBe('ready');
    expect(shouldPresentJournal(justUnder, idleEvents())).toBe(false);
  });

  it('still surfaces a short gap when a lineage ended', () => {
    const plan = planCatchUp(0, 4 * 60 * 1000);
    expect(plan.awaySeconds).toBeLessThan(CATCH_UP_JOURNAL_SECONDS);
    const events = idleEvents();
    events.glassLimpets = { births: 0, deaths: 1, extinctAt: 20 };
    expect(shouldPresentJournal(plan, events)).toBe(true);
    const journal = composeJournal(plan, events, quietResources, quietResources, 80);
    expect(journal.lines).toContain('The last glass limpet died about a minute ago.');
  });

  it('withholds the progress overlay until catch-up would block', () => {
    expect(catchUpShouldShowProgress(CATCH_UP_PROGRESS_MS, 10, 100)).toBe(false);
    expect(catchUpShouldShowProgress(CATCH_UP_PROGRESS_MS + 1, 10, 100)).toBe(true);
    expect(catchUpShouldShowProgress(CATCH_UP_PROGRESS_MS + 1, 100, 100)).toBe(false);
  });
});

describe('catch-up journal copy', () => {
  it('names elapsed time and an extinction in plain language', () => {
    const events = idleEvents();
    events.glassLimpets = { births: 0, deaths: 1, extinctAt: 100 };
    const journal = composeJournal(
      { reason: 'ready', awaySeconds: 7200, simulateSeconds: 7200, sleptSeconds: 0 },
      events,
      quietResources,
      quietResources,
      7300,
    );
    expect(journal.lines[0]).toBe('You were away for about two hours.');
    expect(journal.lines).toContain('The last glass limpet died about two hours ago.');
    expect(journal.lines).toContain('The shore passed from spring into summer.');
    expect(describeSpan(8 * 3600)).toBe('about eight hours');
  });

  it('admits when the world slept through the rest of a long absence', () => {
    const journal = composeJournal(
      { reason: 'ready', awaySeconds: 12 * 3600, simulateSeconds: CATCH_UP_MAX_SECONDS, sleptSeconds: 4 * 3600 },
      idleEvents(),
      quietResources,
      quietResources,
      0,
    );
    expect(journal.lines[0]).toBe('You were away for about 12 hours.');
    expect(journal.lines[1]).toBe('The pool lived through about eight hours of that time. The rest, it slept.');
    expect(journal.lines).toContain('The water kept its own counsel. Little changed that I could name.');
  });
});

describe('catch-up simulation', () => {
  it('matches a live step loop for a fixed seed and gap', () => {
    const seconds = 120;
    const plan = planCatchUp(0, seconds * 1000);
    const caught = createWorld(1);
    const live = createWorld(1);
    const report = catchUpWorld(caught, plan);
    const steps = Math.ceil(seconds / FIXED_STEP);
    for (let i = 0; i < steps; i++) stepWorld(live);
    expect(report.steps).toBe(steps);
    expect(serializeWorld(caught)).toBe(serializeWorld(live));
    expect(remainsLedgerBalanced(caught)).toBe(true);
    expect(caught.elapsed).toBeCloseTo(seconds, 5);
  });

  it('is deterministic across two catch-up runs of the same seed', () => {
    const plan = planCatchUp(0, 180_000);
    const first = createWorld(42);
    const second = createWorld(42);
    catchUpWorld(first, plan);
    catchUpWorld(second, plan);
    expect(serializeWorld(first)).toBe(serializeWorld(second));
    expect(remainsLedgerBalanced(first)).toBe(true);
  });

  it('keeps the remains ledger balanced after an hour on seed 1', () => {
    const plan = planCatchUp(0, 3600_000);
    const world = createWorld(1);
    const report = catchUpWorld(world, plan);
    expect(report.steps).toBe(Math.ceil(3600 / FIXED_STEP));
    expect(world.elapsed).toBeCloseTo(3600, 5);
    expect(remainsLedgerBalanced(world)).toBe(true);
    expect(
      world.ecologyLedger.remainsCreated -
        (report.after.remainPigment + world.ecologyLedger.remainsConsumed + world.ecologyLedger.remainsDecayed),
    ).toBeCloseTo(0, 6);
    expect(report.journal.lines[0]).toBe('You were away for about an hour.');
    expect(shouldPresentJournal(plan, report.events)).toBe(true);
  }, 30_000);

  it('chunked catch-up matches the synchronous path', async () => {
    const plan = planCatchUp(0, 12_000);
    const syncWorld = createWorld(7);
    const asyncWorld = createWorld(7);
    catchUpWorld(syncWorld, plan);
    await catchUpWorldChunked(asyncWorld, plan, { chunkMs: 1, yieldToMain: async () => undefined });
    expect(serializeWorld(asyncWorld)).toBe(serializeWorld(syncWorld));
  });

  it('does not advance a world when the clock is unsafe', () => {
    const world = createWorld(3);
    const before = serializeWorld(world);
    const report = catchUpWorld(world, planCatchUp(null, Date.now()));
    expect(report.steps).toBe(0);
    expect(serializeWorld(world)).toBe(before);
  });
});
