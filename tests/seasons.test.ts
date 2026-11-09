import { describe, expect, it } from 'vitest';
import { catchUpWorld, composeJournal, planCatchUp } from '../src/world/catchup';
import { daylight } from '../src/world/environment/daylight';
import {
  BASE_RAIN_SPAN,
  channelScaleAt,
  dayStrengthAt,
  describeSeasonChange,
  getSeason,
  nightBiasAt,
  rainSpanAt,
  SEASON_NOTE,
  seasonName,
  SEASON_SECONDS,
  YEAR_DAYS,
  YEAR_SECONDS,
} from '../src/world/environment/seasons';
import { channelFlowAt, HABITAT_CHANNEL } from '../src/world/habitat';
import { SPECIES_CATALOG } from '../src/world/species/catalog';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { createWorld, stepWorld } from '../src/world/simulation';
import { SCHEMA_REVISION, FIXED_STEP } from '../src/world/types';
import { getWeather } from '../src/world/weather';
import { parseHarnessArgs, runHarness } from '../scripts/harness';
import type { CatchUpEvents, ResourceSnapshot } from '../src/world/catchup';

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
};

describe('season math', () => {
  it('uses a six-world-day year so a 30-day harness covers five complete years', () => {
    expect(YEAR_DAYS).toBe(6);
    expect(YEAR_SECONDS).toBe(2160);
    expect(SEASON_SECONDS).toBe(540);
    expect(YEAR_SECONDS % 180).toBe(0);
    expect(YEAR_SECONDS % 360).toBe(0);
    expect(30 / YEAR_DAYS).toBe(5);
  });

  it('names seasons from elapsed time and repeats each year', () => {
    expect(seasonName(0)).toBe('spring');
    expect(seasonName(SEASON_SECONDS - 1e-9)).toBe('spring');
    expect(seasonName(SEASON_SECONDS)).toBe('summer');
    expect(seasonName(YEAR_SECONDS / 2)).toBe('autumn');
    expect(seasonName(YEAR_SECONDS * 0.75)).toBe('winter');
    expect(seasonName(YEAR_SECONDS)).toBe('spring');
    expect(seasonName(YEAR_SECONDS + SEASON_SECONDS)).toBe('summer');
  });

  it('matches the opening climate at t=0 and stays bounded', () => {
    expect(dayStrengthAt(0)).toBe(1);
    expect(nightBiasAt(0)).toBe(0);
    expect(rainSpanAt(0)).toBe(BASE_RAIN_SPAN);
    expect(channelScaleAt(0)).toBe(1);
    for (let elapsed = 0; elapsed <= YEAR_SECONDS; elapsed += 15) {
      expect(dayStrengthAt(elapsed)).toBeGreaterThanOrEqual(0.8);
      expect(dayStrengthAt(elapsed)).toBeLessThanOrEqual(1.2);
      expect(nightBiasAt(elapsed)).toBeGreaterThanOrEqual(-0.16);
      expect(nightBiasAt(elapsed)).toBeLessThanOrEqual(0.16);
      expect(rainSpanAt(elapsed)).toBeGreaterThanOrEqual(24);
      expect(rainSpanAt(elapsed)).toBeLessThanOrEqual(52);
      expect(channelScaleAt(elapsed)).toBeGreaterThanOrEqual(0.82);
      expect(channelScaleAt(elapsed)).toBeLessThanOrEqual(1.18);
    }
    for (const elapsed of [-1, Number.NaN, Infinity, -Infinity]) {
      expect(() => seasonName(elapsed)).toThrow(RangeError);
      expect(() => rainSpanAt(elapsed)).toThrow(RangeError);
      expect(() => dayStrengthAt(elapsed)).toThrow(RangeError);
    }
  });

  it('lengthens and brightens summer days and shortens dim winter days', () => {
    const springNoon = { elapsed: 0, seed: 90 };
    const summerNoon = { elapsed: 720, seed: 90 };
    const winterNoon = { elapsed: 1800, seed: 90 };
    expect(daylight(springNoon)).toBe(1);
    expect(daylight(summerNoon)).toBeGreaterThan(1);
    expect(daylight(winterNoon)).toBeGreaterThan(0);
    expect(daylight(winterNoon)).toBeLessThan(1);
    expect(daylight({ elapsed: 180, seed: 90 })).toBe(0);
    expect(daylight({ elapsed: YEAR_SECONDS, seed: 90 })).toBe(1);
  });

  it('peaks at the start of summer and bottoms at the start of winter', () => {
    expect(seasonName(SEASON_SECONDS)).toBe('summer');
    expect(seasonName((YEAR_SECONDS * 3) / 4)).toBe('winter');
    expect(dayStrengthAt(SEASON_SECONDS)).toBeCloseTo(1.2, 10);
    expect(dayStrengthAt((YEAR_SECONDS * 3) / 4)).toBeCloseTo(0.8, 10);
    expect(dayStrengthAt(SEASON_SECONDS / 2)).toBeGreaterThan(dayStrengthAt(0));
    expect(dayStrengthAt(SEASON_SECONDS / 2)).toBeLessThan(dayStrengthAt(SEASON_SECONDS));
    expect(dayStrengthAt(YEAR_SECONDS / 2 + SEASON_SECONDS / 2)).toBeLessThan(dayStrengthAt(YEAR_SECONDS / 2));
    expect(dayStrengthAt(YEAR_SECONDS / 2 + SEASON_SECONDS / 2)).toBeGreaterThan(dayStrengthAt((YEAR_SECONDS * 3) / 4));
    expect(SEASON_NOTE.spring).toBe("Days lengthen toward summer's start.");
    expect(SEASON_NOTE.summer).toBe('Brightest at the start, then easing; rain is brief.');
    expect(SEASON_NOTE.autumn).toBe("Days shorten toward winter's start.");
    expect(SEASON_NOTE.winter).toBe('Dimmest at the start, then easing; rain stays longer.');
    expect(getSeason(0).note).toBe(SEASON_NOTE.spring);
    expect(getSeason(SEASON_SECONDS).note).toBe(SEASON_NOTE.summer);
    const summerStartNoon = { elapsed: SEASON_SECONDS, seed: 270 };
    const winterStartNoon = { elapsed: (YEAR_SECONDS * 3) / 4, seed: 270 };
    expect(daylight(summerStartNoon)).toBeCloseTo(1.2, 10);
    expect(daylight(winterStartNoon)).toBeCloseTo(0.8, 10);
    expect(SPECIES_CATALOG.reedwell.harvestRate).toBe(0.18);
    expect(SPECIES_CATALOG.reedwell.harvestRate * daylight(summerStartNoon)).toBeCloseTo(0.216, 10);
    expect(SPECIES_CATALOG.reedwell.harvestRate * daylight(winterStartNoon)).toBeCloseTo(0.144, 10);
    expect(SPECIES_CATALOG.reedwell.harvestRate * daylight({ elapsed: 0, seed: 90 })).toBeCloseTo(0.18, 10);
  });

  it('bounds authored channel flow at 4.8 times seasonal scale', () => {
    expect(HABITAT_CHANNEL.flow).toBe(4.8);
    expect(HABITAT_CHANNEL.flow * 1.18).toBeCloseTo(5.664, 10);
    expect(channelScaleAt(SEASON_SECONDS)).toBeCloseTo(0.82, 10);
    expect(channelScaleAt((YEAR_SECONDS * 3) / 4)).toBeCloseTo(1.18, 10);
    let peak = 0;
    for (let elapsed = 0; elapsed <= YEAR_SECONDS; elapsed += 1) {
      const flow = Math.abs(channelFlowAt(elapsed));
      const envelope = Math.abs(HABITAT_CHANNEL.flow * channelScaleAt(elapsed));
      expect(flow).toBeLessThanOrEqual(envelope + 1e-12);
      if (flow > peak) peak = flow;
    }
    expect(peak).toBeGreaterThan(5.65);
    expect(peak).toBeLessThanOrEqual(5.664 + 1e-12);
  });

  it('holds the first rain cycle at 38 seconds and then dries in summer, wets in winter', () => {
    expect(getWeather(0)).toEqual({ intensity: 0, raining: false, secondsUntilChange: 30 });
    expect(getWeather(30)).toMatchObject({ raining: true, secondsUntilChange: 38 });
    expect(getWeather(45).intensity).toBe(1);
    expect(rainSpanAt(YEAR_SECONDS / 4)).toBeLessThan(BASE_RAIN_SPAN);
    expect(rainSpanAt((YEAR_SECONDS * 3) / 4)).toBeGreaterThan(BASE_RAIN_SPAN);
    expect(channelScaleAt((YEAR_SECONDS * 3) / 4)).toBeGreaterThan(channelScaleAt(YEAR_SECONDS / 4));
    for (const elapsed of [0, 14.5, 30, 45, 68, 179.5, 540, 1080, 1620]) {
      const now = getWeather(elapsed);
      const nextYear = getWeather(elapsed + YEAR_SECONDS);
      expect(nextYear.raining).toBe(now.raining);
      expect(nextYear.intensity).toBeCloseTo(now.intensity, 10);
      expect(nextYear.secondsUntilChange).toBeCloseTo(now.secondsUntilChange, 10);
    }
  });

  it('does not store a season field and follows the current schema revision', () => {
    const world = createWorld(1);
    world.elapsed = YEAR_SECONDS / 2;
    const parsed = JSON.parse(serializeWorld(world)) as { schemaRevision: number; season?: unknown };
    expect(parsed.schemaRevision).toBe(SCHEMA_REVISION);
    expect(parsed.schemaRevision).toBe(14);
    expect(parsed).not.toHaveProperty('season');
    const restored = restoreWorld(serializeWorld(world));
    expect(restored).not.toBeNull();
    expect(seasonName(restored!.elapsed)).toBe('autumn');
    expect(restoreWorld(serializeWorld(createWorld(1)))?.schemaRevision).toBe(14);
  });
});

describe('season catch-up and harness parity', () => {
  it('names a season change in the while-you-were-gone journal', () => {
    expect(describeSeasonChange(0, 3600)).toBe('The shore passed from spring into autumn.');
    expect(describeSeasonChange(0, YEAR_SECONDS)).toBe('A year turned while you were gone. It is spring again.');
    expect(describeSeasonChange(10, 40)).toBeNull();
    const hour = composeJournal(
      { reason: 'ready', awaySeconds: 3600, simulateSeconds: 3600, sleptSeconds: 0 },
      idleEvents(),
      quietResources,
      quietResources,
      3600,
    );
    expect(hour.lines).toContain('The shore passed from spring into autumn.');
  });

  it('matches a live step loop across a season boundary', () => {
    const seconds = SEASON_SECONDS + 30;
    const plan = planCatchUp(0, seconds * 1000);
    const caught = createWorld(1);
    const live = createWorld(1);
    const report = catchUpWorld(caught, plan);
    const steps = Math.ceil(seconds / FIXED_STEP);
    for (let i = 0; i < steps; i++) stepWorld(live);
    expect(report.steps).toBe(steps);
    expect(serializeWorld(caught)).toBe(serializeWorld(live));
    expect(seasonName(caught.elapsed)).toBe('summer');
    expect(seasonName(live.elapsed)).toBe(seasonName(caught.elapsed));
    expect(report.journal.lines).toContain('The shore passed from spring into summer.');
  });

  it('lets the harness see the same seasons as stepped elapsed time', () => {
    expect(parseHarnessArgs(['--days', '2', '--seed', '1']).days).toBe(2);
    const report = runHarness({ days: 2, seed: 1, visitorLight: false });
    expect(report.populations[0].season).toBe('spring');
    expect(report.populations[report.populations.length - 1].season).toBe('summer');
    for (const sample of report.populations) {
      expect(sample.season).toBe(seasonName(sample.worldTime));
    }
    const caught = createWorld(1);
    catchUpWorld(caught, planCatchUp(0, 2 * 360 * 1000));
    expect(caught.elapsed).toBeCloseTo(report.worldSeconds, 5);
    expect(serializeWorld(caught)).toBe(
      serializeWorld(
        (() => {
          const live = createWorld(1);
          const steps = Math.ceil((2 * 360) / FIXED_STEP);
          for (let i = 0; i < steps; i++) stepWorld(live);
          return live;
        })(),
      ),
    );
  }, 20_000);
});
