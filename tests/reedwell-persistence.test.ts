import { describe, expect, it } from 'vitest';
import historicalStudy from '../src/app/shower-study.json';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { createWorld, stepWorld } from '../src/world/simulation';
import type { Reedwell, World } from '../src/world/types';

const reedwellLedgerKeys = ['daylightHarvested', 'daylightUnharvested', 'reedwellEmittedLight', 'reedwellDissipatedLight'];
const rainbellLedgerKeys = ['rainbellIntake', 'rainbellPumpingPigment', 'rainbellMaintenancePigment'];

function inhabited(): World {
  const world = createWorld(91);
  world.elapsed = 85; world.tick = 2550;
  world.weatherCall = { startedAt: 75, nextAllowedAt: 135 };
  world.currents = [{ id: world.nextId++, x: 720, y: 500, dx: 1, dy: 0, startedAt: 84, duration: 8, radius: 110 }];
  const plant: Reedwell = { id: world.nextId++, species: 'reedwell', body: .6,
    x: 720, y: 500, hue: 187, age: 23.25, lightStore: 2.4,
    lastEmissionAt: 80, emissionNextAllowedAt: 95 };
  world.reedwells = [plant]; world.reedwellAdmissionAt = 120;
  world.reedwellCandidateAfterId = world.sediment[0].id;
  world.skimmers = [{ id: world.nextId++, species: 'skimmer', body: .2, size: 8,
    x: world.nests[0].x, y: world.nests[0].y, vx: 1, vy: -1, hue: 199, age: 14,
    reserve: .4, phase: .3, homeNestId: world.nests[0].id, targetSedimentId: world.sediment[0].id,
    starvedFor: 0, lastEmissionAt: null, emissionNextAllowedAt: 0 }];
  world.organisms[0].pigmentCredit = .31;
  world.ecologyLedger = { ...world.ecologyLedger, mineralizedPigment: .2, maintenancePigment: .01, emittedLight: 1.35,
    pigmentConverted: .9, feedingCreditLost: .03, daylightHarvested: 4.9, daylightUnharvested: .7,
    reedwellEmittedLight: 1.5, reedwellDissipatedLight: 1 };
  return world;
}

function revision3(world: World): Record<string, any> {
  const { reedwells: _plants, reedwellAdmissionAt: _admission, reedwellCandidateAfterId: _candidate, rainbells: _rainbells, rainbellAdmissionAt: _rainbellAdmission, rainbellCandidateAfterId: _rainbellCandidate, ...previous } = structuredClone(world);
  const result: Record<string, any> = { ...previous, schemaRevision: 3 };
  for (const key of [...reedwellLedgerKeys, ...rainbellLedgerKeys]) delete result.ecologyLedger[key];
  return result;
}

describe('reedwell snapshot revision', () => {
  it('migrates paid prism history without adding population, resources, time, identities or randomness', () => {
    const source = revision3(inhabited());
    const before = JSON.stringify(source);
    const restored = restoreWorld(before)!;
    expect(restored).not.toBeNull();
    const { reedwells, reedwellAdmissionAt, reedwellCandidateAfterId, rainbells, rainbellAdmissionAt, rainbellCandidateAfterId, ...oldFields } = restored;
    expect(reedwells).toEqual([]);
    expect(reedwellAdmissionAt).toBe(source.elapsed);
    expect(reedwellCandidateAfterId).toBe(0);
    expect(rainbells).toEqual([]);
    expect(rainbellAdmissionAt).toBe(source.elapsed);
    expect(rainbellCandidateAfterId).toBe(0);
    const oldLedger = { ...oldFields.ecologyLedger } as Record<string, number>;
    for (const key of [...reedwellLedgerKeys, ...rainbellLedgerKeys]) { expect(oldLedger[key]).toBe(0); delete oldLedger[key]; }
    expect({ ...oldFields, schemaRevision: 3, ecologyLedger: oldLedger }).toEqual(source);
    expect(JSON.stringify(source)).toBe(before);
    expect(restoreWorld(serializeWorld(restored))).toEqual(restored);
  });

  it('keeps the immutable shower empty of new plants and retains its exact old resources', () => {
    const before = JSON.stringify(historicalStudy);
    const restored = restoreWorld(before)!;
    expect(restored).toMatchObject({ schemaRevision: 5, reedwells: [], reedwellAdmissionAt: historicalStudy.elapsed, reedwellCandidateAfterId: 0,
      nextId: historicalStudy.nextId, randomState: historicalStudy.randomState, elapsed: historicalStudy.elapsed,
      tick: historicalStudy.tick, lights: historicalStudy.lights, sediment: historicalStudy.sediment,
      grazers: historicalStudy.grazers, nests: historicalStudy.nests, consumed: historicalStudy.consumed });
    for (const key of reedwellLedgerKeys) expect((restored.ecologyLedger as unknown as Record<string, number>)[key]).toBe(0);
    expect(JSON.stringify(historicalStudy)).toBe(before);
  });

  it('continues stored sunlight, emission rest, active weather/current and paid feeding exactly at arbitrary phases', () => {
    for (const offset of [0, 1, 4, 17]) {
      const world = inhabited();
      for (let tick = 0; tick < offset; tick++) stepWorld(world);
      const resumed = restoreWorld(serializeWorld(world))!;
      expect(resumed).toEqual(world);
      for (let tick = 0; tick < 480; tick++) { stepWorld(world); stepWorld(resumed); }
      expect(resumed).toEqual(world);
    }
  });

  it('accepts variable presence, a newborn un-emitted root and extinct populations without free replacement', () => {
    const world = inhabited();
    Object.assign(world.reedwells[0], { age: 0, lightStore: 0, lastEmissionAt: null, emissionNextAllowedAt: world.elapsed });
    expect(restoreWorld(serializeWorld(world))).toEqual(world);
    world.reedwells = [];
    expect(restoreWorld(serializeWorld(world))).toEqual(world);
    expect(restoreWorld(serializeWorld(createWorld()))!.reedwells).toEqual([]);
  });

  it('persists a rotating admission cursor even after its source grain has disappeared', () => {
    const world = inhabited();
    world.sediment = world.sediment.filter(grain => grain.id !== world.reedwellCandidateAfterId);
    const resumed = restoreWorld(serializeWorld(world))!;
    expect(resumed).toEqual(world);
    expect(resumed.reedwellCandidateAfterId).toBeGreaterThan(0);
    for (let tick = 0; tick < 180; tick++) { stepWorld(world); stepWorld(resumed); }
    expect(resumed).toEqual(world);
    world.reedwellCandidateAfterId = 0;
    expect(restoreWorld(serializeWorld(world))).toEqual(world);
  });

  it('rejects partial state, invalid resources, unsafe IDs, budgets and inconsistent emission/admission clocks', () => {
    const mutations: ((world: Record<string, any>) => void)[] = [
      w => { delete w.reedwells; }, w => { w.reedwells = null; },
      w => { delete w.reedwellAdmissionAt; }, w => { w.reedwellAdmissionAt = -1; },
      w => { w.reedwellAdmissionAt = w.elapsed + 61; }, w => { w.reedwellAdmissionAt = Infinity; },
      w => { delete w.reedwellCandidateAfterId; }, w => { w.reedwellCandidateAfterId = -1; },
      w => { w.reedwellCandidateAfterId = .5; }, w => { w.reedwellCandidateAfterId = w.nextId; },
      w => { w.reedwellCandidateAfterId = Number.MAX_SAFE_INTEGER + 1; },
      w => { w.reedwells[0].id = 0; }, w => { w.reedwells[0].id = 1.5; },
      w => { w.reedwells[0].id = w.currents[0].id; }, w => { w.reedwells[0].id = w.organisms[0].id; },
      w => { w.reedwells[0].id = w.skimmers[0].id; },
      w => { w.reedwells[0].id = w.nextId; }, w => { w.nextId = Number.MAX_SAFE_INTEGER + 1; },
      w => { w.reedwells[0].species = 'skimmer'; }, w => { w.reedwells[0].body = .61; },
      w => { w.reedwells[0].age = -1; }, w => { w.reedwells[0].age = 901; },
      w => { w.reedwells[0].hue = 360; }, w => { w.reedwells[0].hue = -1; },
      w => { w.reedwells[0].x = 0; }, w => { w.reedwells[0].y = NaN; },
      w => { w.reedwells[0].lightStore = 3.00001; }, w => { w.reedwells[0].lightStore = -.00001; },
      w => { w.reedwells[0].lightStore = Infinity; }, w => { delete w.reedwells[0].lightStore; },
      w => { w.reedwells[0].lastEmissionAt = w.elapsed + 1; }, w => { w.reedwells[0].lastEmissionAt = -1; },
      w => { w.reedwells[0].emissionNextAllowedAt = 96; }, w => { w.reedwells[0].emissionNextAllowedAt = -1; },
      w => { w.reedwells[0].lastEmissionAt = null; w.reedwells[0].emissionNextAllowedAt = w.elapsed + .1; },
      w => { delete w.reedwells[0].lastEmissionAt; }, w => { delete w.reedwells[0].emissionNextAllowedAt; },
      w => { w.reedwells = Array.from({ length: 7 }, (_, index) => ({ ...w.reedwells[0], id: w.nextId + index })); w.nextId += 7; },
      w => { w.schemaRevision = 6; },
    ];
    for (const key of reedwellLedgerKeys) {
      mutations.push(w => { delete w.ecologyLedger[key]; }, w => { w.ecologyLedger[key] = -1; },
        w => { w.ecologyLedger[key] = Infinity; });
    }
    for (const mutate of mutations) {
      const world = inhabited(); mutate(world);
      expect(restoreWorld(serializeWorld(world))).toBeNull();
    }
  });

  it('rejects every new field in a downgraded prism save instead of silently discarding ecological state', () => {
    for (const key of ['reedwells', 'reedwellAdmissionAt', 'reedwellCandidateAfterId', ...reedwellLedgerKeys]) {
      const world = revision3(inhabited());
      if (key === 'reedwells') world.reedwells = [];
      else if (key === 'reedwellAdmissionAt' || key === 'reedwellCandidateAfterId') world[key] = 0;
      else world.ecologyLedger[key] = 0;
      expect(restoreWorld(JSON.stringify(world))).toBeNull();
    }
    for (const version of [1, 2, 3]) {
      const world = revision3(inhabited());
      world.version = version;
      if (version !== 3) { delete world.schemaRevision; delete world.weatherCall; delete world.currents; }
      else world.schemaRevision = 2;
      delete world.skimmers; delete world.skimmerAdmissionAt; delete world.ecologyLedger;
      world.organisms.forEach((entry: Record<string, unknown>) => { delete entry.pigmentCredit; });
      for (const [key, value] of [['reedwells', []], ['reedwellAdmissionAt', 0], ['reedwellCandidateAfterId', 0]]) {
        expect(restoreWorld(JSON.stringify({ ...world, [key as string]: value }))).toBeNull();
      }
    }
  });

  it('retains the one-megabyte import bound for a growing catalog', () => {
    const world = inhabited();
    expect(serializeWorld(world).length).toBeLessThan(1_000_000);
    expect(restoreWorld(JSON.stringify({ ...world, ignored: 'x'.repeat(1_000_000) }))).toBeNull();
  });
});
