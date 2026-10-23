import { describe, expect, it } from 'vitest';
import fixture from '../src/app/shower-study.json';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { addLight, createWorld, stepWorld } from '../src/world/simulation';
import { callRain, effectiveLightReach, effectiveWeather, getWeather } from '../src/world/weather';
import { FIXED_STEP, type World } from '../src/world/types';

function ecology(world: World) {
  const { version: _version, schemaRevision: _revision, weatherCall: _call, currents: _currents, skimmers: _skimmers, skimmerAdmissionAt: _admission, ecologyLedger: _ledger, reedwells: _reedwells, reedwellAdmissionAt: _reedwellAdmission, reedwellCandidateAfterId: _reedwellCandidate, organisms, ...rest } = world;
  return { ...rest, organisms: organisms.map(({ pigmentCredit: _credit, ...entry }) => entry) };
}

describe('visitor-called rain', () => {
  it('changes only weather and pauses its shower and cooldown with simulated time', () => {
    const world = createWorld(43);
    world.elapsed = 90;
    const before = structuredClone(ecology(world));
    expect(callRain(world)).toEqual({ status: 'called', secondsRemaining: 60 });
    expect(ecology(world)).toEqual(before);
    expect(effectiveWeather(world)).toMatchObject({ called: true, intensity: 0, raining: true, callCooldown: 60 });
    const paused = serializeWorld(world);
    for (let i = 0; i < 20; i++) {
      expect(callRain(world)).toEqual({ status: 'cooldown', secondsRemaining: 60 });
      expect(effectiveWeather(world).callCooldown).toBe(60);
    }
    expect(serializeWorld(world)).toBe(paused);
    world.elapsed = 120;
    expect(effectiveWeather(world)).toMatchObject({ called: false, raining: false, callCooldown: 30 });
    world.elapsed = 150;
    expect(callRain(world).status).toBe('called');
    expect(world.weatherCall).toEqual({ startedAt: 150, nextAllowedAt: 210 });
    expect(ecology(world)).toEqual({ ...before, elapsed: 150 });
  });

  it('eases in and out and combines overlapping natural rain by maximum, never sum', () => {
    const world = createWorld();
    world.elapsed = 90;
    callRain(world);
    for (const [age, intensity] of [[0, 0], [1.5, .15625], [3, .5], [6, 1], [24, 1], [27, .5], [28.5, .15625], [30, 0]]) {
      world.elapsed = 90 + age;
      expect(effectiveWeather(world).intensity).toBeCloseTo(intensity, 12);
      expect(effectiveLightReach(world)).toBeCloseTo(64 + intensity * 48, 12);
    }
    world.elapsed = 24;
    world.weatherCall = { startedAt: null, nextAllowedAt: 0 };
    callRain(world);
    expect(effectiveWeather(world).secondsUntilChange).toBe(30);
    world.elapsed = 30;
    expect(effectiveWeather(world).secondsUntilChange).toBe(24);
    for (let age = 0; age <= 60; age += .25) {
      world.elapsed = 24 + age;
      const called = age < 30 ? Math.min(smooth(age / 6), smooth((30 - age) / 6)) : 0;
      expect(effectiveWeather(world).intensity).toBe(Math.max(getWeather(world.elapsed).intensity, called));
      expect(effectiveWeather(world).intensity).toBeLessThanOrEqual(1);
    }
  });

  it('lets a lucent feed at ninety units during a called shower using existing light energy', () => {
    const calm = createWorld(42);
    calm.elapsed = 90;
    calm.organisms = [calm.organisms[0]];
    calm.lights = []; calm.sediment = []; calm.grazers = []; calm.nests = [];
    Object.assign(calm.organisms[0], { x: 630, y: 500, vx: 0, vy: 0, energy: .5, trail: [] });
    addLight(calm, 720, 500);
    const rain = structuredClone(calm);
    callRain(rain);
    // Compare the same ecology and natural calm at the called shower's peak.
    calm.elapsed = rain.elapsed = 96;
    stepWorld(calm); stepWorld(rain);
    expect(calm.consumed).toBe(0);
    expect(rain.consumed).toBeGreaterThan(0);
    expect(90 - rain.lights[0].energy).toBeCloseTo(rain.consumed + FIXED_STEP * .045, 10);
    expect(rain.organisms[0].energy - .5).toBeCloseTo(rain.consumed * .065 - FIXED_STEP * .008, 10);
  });
});

function smooth(value: number) { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); }

describe('versioned weather calls', () => {
  it('restores a running shower and cooldown exactly, with deterministic continuation and no reload bypass', () => {
    const world = createWorld(59);
    world.elapsed = 90;
    callRain(world);
    for (let i = 0; i < 270; i++) stepWorld(world);
    const restored = restoreWorld(serializeWorld(world))!;
    expect(restored).toEqual(world);
    expect(callRain(restored)).toEqual({ status: 'cooldown', secondsRemaining: world.weatherCall.nextAllowedAt - world.elapsed });
    expect(effectiveWeather(restored)).toEqual(effectiveWeather(world));
    for (let i = 0; i < 1900; i++) { stepWorld(world); stepWorld(restored); }
    expect(restored).toEqual(world);
    expect(callRain(restored).status).toBe('called');
  });

  it('migrates genuine v2 history inactive without replacing any ecology or old identifiers', () => {
    const old = JSON.stringify(fixture);
    const migrated = restoreWorld(old)!;
    const { version: _version, ...original } = fixture;
    expect(ecology(migrated)).toEqual(original);
    expect(migrated).toMatchObject({ version: 3, schemaRevision: 4, weatherCall: { startedAt: null, nextAllowedAt: 0 } });
    expect(JSON.stringify(fixture)).toBe(old);
    expect(restoreWorld(serializeWorld(migrated))).toEqual(migrated);
  });

  it('rejects missing or inconsistent current fields, future revisions and malformed fields even in legacy saves', () => {
    const mutations: ((world: Record<string, unknown>) => void)[] = [
      world => { delete world.weatherCall; },
      world => { delete world.schemaRevision; },
      world => { world.schemaRevision = 5; },
      world => { world.weatherCall = null; },
      world => { world.weatherCall = { startedAt: null, nextAllowedAt: 60 }; },
      world => { world.weatherCall = { startedAt: 91, nextAllowedAt: 151 }; },
      world => { world.weatherCall = { startedAt: -1, nextAllowedAt: 59 }; },
      world => { world.weatherCall = { startedAt: 90, nextAllowedAt: 90 }; },
      world => { world.weatherCall = { startedAt: 90, nextAllowedAt: 151 }; },
      world => { world.weatherCall = { startedAt: 90, nextAllowedAt: Infinity }; },
      world => { world.weatherCall = { startedAt: Number.MAX_SAFE_INTEGER, nextAllowedAt: Number.MAX_SAFE_INTEGER }; },
    ];
    for (const mutate of mutations) {
      const world = { ...createWorld(), elapsed: 90 } as Record<string, unknown>;
      mutate(world);
      expect(restoreWorld(JSON.stringify(world))).toBeNull();
    }
    for (const version of [1, 2]) {
      const old = { ...createWorld(), version, weatherCall: { startedAt: null, nextAllowedAt: -1 } };
      expect(restoreWorld(JSON.stringify(old))).toBeNull();
      expect(restoreWorld(JSON.stringify({ ...ecology(createWorld()), version }))).not.toBeNull();
      const active = createWorld();
      callRain(active);
      expect(restoreWorld(JSON.stringify({ ...active, version }))).toBeNull();
    }
    const world = createWorld();
    world.elapsed = Number.MAX_SAFE_INTEGER;
    const before = serializeWorld(world);
    expect(callRain(world).status).toBe('cooldown');
    expect(serializeWorld(world)).toBe(before);
  });
});
