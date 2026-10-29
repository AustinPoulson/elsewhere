import { describe, expect, it } from 'vitest';
import historicalStudy from '../src/app/shower-study.json';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { createWorld, stepWorld } from '../src/world/simulation';
import type { World } from '../src/world/types';

const rainbellLedgerKeys = ['rainbellIntake', 'rainbellPumpingPigment', 'rainbellMaintenancePigment'];
const siltstitcherLedgerKeys = ['siltstitcherNestReserve', 'siltstitcherNestCargo', 'siltstitcherOutwardPigment', 'siltstitcherMaintenancePigment'];
const limpetLedgerKeys = ['glassLimpetIntake', 'glassLimpetMaintenancePigment'];
const cargoMiteLedgerKeys = ['cargoMiteIntake', 'cargoMiteMaintenancePigment'];

function inhabited(): World {
  const world = createWorld(91);
  world.elapsed = 96; world.tick = 2881;
  world.weatherCall = { startedAt: 90, nextAllowedAt: 150 };
  world.currents = [{ id: world.nextId++, x: 720, y: 500, dx: 1, dy: 0, startedAt: 95, duration: 8, radius: 110 }];
  Object.assign(world.sediment[0], { x: 720, y: 500, strength: .4 });
  Object.assign(world.sediment[1], { x: 760, y: 500, strength: .3 });
  world.skimmers = [{ id: world.nextId++, species: 'skimmer', body: .2, size: 8,
    x: world.nests[0].x, y: world.nests[0].y, vx: 1, vy: -1, hue: 199, age: 14,
    reserve: .4, phase: .3, homeNestId: world.nests[0].id, targetSedimentId: world.sediment[0].id,
    starvedFor: 0, lastEmissionAt: null, emissionNextAllowedAt: 0 }];
  world.reedwells = [{ id: world.nextId++, species: 'reedwell', body: .6,
    x: 600, y: 500, hue: 187, age: 23.25, lightStore: .8, lastEmissionAt: 90, emissionNextAllowedAt: 105 }];
  world.reedwellCandidateAfterId = world.sediment[0].id;
  world.rainbells = [{ id: world.nextId++, species: 'rainbell', body: .2,
    x: 720, y: 500, hue: 240, age: 42, reserve: .35, starvedFor: 0,
    feedTargetSedimentId: world.sediment[0].id, pumpTargetSedimentId: world.sediment[1].id,
    lastPulseAt: 90, pulseNextAllowedAt: 105 }];
  world.rainbellAdmissionAt = 130;
  world.rainbellCandidateAfterId = world.sediment[1].id;
  world.organisms[0].pigmentCredit = .31;
  world.ecologyLedger = { ...world.ecologyLedger, mineralizedPigment: .2, maintenancePigment: .01, emittedLight: 1.35,
    pigmentConverted: .9, feedingCreditLost: .03, daylightHarvested: 4.9, daylightUnharvested: .7,
    reedwellEmittedLight: 1.5, reedwellDissipatedLight: 1,
    rainbellIntake: .23, rainbellPumpingPigment: .08, rainbellMaintenancePigment: .013 };
  return world;
}

function revision4(world: World): Record<string, any> {
  const { rainbells: _polyps, rainbellAdmissionAt: _admission, rainbellCandidateAfterId: _cursor, siltstitchers: _siltstitchers, siltstitcherAdmissionAt: _siltstitcherAdmission, siltstitcherCandidateAfterId: _siltstitcherCandidate, glassLimpets: _glassLimpets, glassLimpetAdmissionAt: _glassLimpetAdmissionAt, glassLimpetCandidateAfterId: _glassLimpetCandidateAfterId, nextFoundingTick: _nextFoundingTick, foundingTypeCursor: _foundingTypeCursor, cargoMites: _cargoMites, cargoMiteAdmissionAt: _cargoMiteAdmissionAt, cargoMiteCandidateAfterId: _cargoMiteCandidateAfterId, skimmerCandidateAfterId: _skimmerCandidate, ...previous } = structuredClone(world);
  const result: Record<string, any> = { ...previous, schemaRevision: 4 };
  for (const key of [...rainbellLedgerKeys, ...siltstitcherLedgerKeys, ...limpetLedgerKeys, ...cargoMiteLedgerKeys]) delete result.ecologyLedger[key];
  return result;
}

function legacy(version: 1 | 2 | 3, revision: number): Record<string, any> {
  const world = revision4(inhabited());
  world.version = version;
  if (version === 3 && revision === 4) return world;
  delete world.reedwells; delete world.reedwellAdmissionAt; delete world.reedwellCandidateAfterId;
  for (const key of ['daylightHarvested', 'daylightUnharvested', 'reedwellEmittedLight', 'reedwellDissipatedLight']) delete world.ecologyLedger[key];
  if (version === 3 && revision === 3) { world.schemaRevision = 3; return world; }
  delete world.skimmers; delete world.skimmerAdmissionAt; delete world.skimmerCandidateAfterId; delete world.ecologyLedger;
  world.organisms.forEach((entry: Record<string, unknown>) => { delete entry.pigmentCredit; });
  if (version === 3) { world.schemaRevision = revision; if (revision === 1) delete world.currents; }
  else { delete world.schemaRevision; delete world.weatherCall; delete world.currents; }
  if (version === 1) { delete world.grazers; delete world.nests; }
  return world;
}

describe('rainbell snapshot revision', () => {
  it('migrates revision4 as a pure extension without changing paid earlier ecology or identities', () => {
    const source = revision4(inhabited());
    const before = JSON.stringify(source);
    const restored = restoreWorld(before)!;
    expect(restored).not.toBeNull();
    const { rainbells, rainbellAdmissionAt, rainbellCandidateAfterId, siltstitchers, siltstitcherAdmissionAt, siltstitcherCandidateAfterId,
      glassLimpets: _glassLimpets, glassLimpetAdmissionAt: _glassLimpetAdmissionAt,
      glassLimpetCandidateAfterId: _glassLimpetCandidateAfterId,
      nextFoundingTick: _nextFoundingTick, foundingTypeCursor: _foundingTypeCursor, cargoMites: _cargoMites, cargoMiteAdmissionAt: _cargoMiteAdmissionAt, cargoMiteCandidateAfterId: _cargoMiteCandidateAfterId, skimmerCandidateAfterId: _skimmerCandidate, ...oldFields } = restored;
    expect(restored.schemaRevision).toBe(8);
    expect(rainbells).toEqual([]);
    expect(rainbellAdmissionAt).toBe(source.elapsed);
    expect(rainbellCandidateAfterId).toBe(0);
    expect(siltstitchers).toEqual([]);
    expect(siltstitcherAdmissionAt).toBe(source.elapsed);
    expect(siltstitcherCandidateAfterId).toBe(0);
    const oldLedger = { ...oldFields.ecologyLedger } as Record<string, number>;
    for (const key of [...rainbellLedgerKeys, ...siltstitcherLedgerKeys, ...limpetLedgerKeys, ...cargoMiteLedgerKeys]) { expect(oldLedger[key]).toBe(0); delete oldLedger[key]; }
    expect({ ...oldFields, schemaRevision: 4, ecologyLedger: oldLedger }).toEqual(source);
    expect(JSON.stringify(source)).toBe(before);
    expect(restoreWorld(serializeWorld(restored))).toEqual(restored);
  });

  it('migrates every historical contract and the immutable shower with no free rainbell population or resources', () => {
    for (const [version, revision] of [[1, 0], [2, 0], [3, 1], [3, 2], [3, 3], [3, 4]] as const) {
      const source = legacy(version, revision);
      const before = JSON.stringify(source);
      const restored = restoreWorld(before)!;
      expect(restored).toMatchObject({ schemaRevision: 8, rainbells: [], rainbellAdmissionAt: source.elapsed,
        rainbellCandidateAfterId: 0, elapsed: source.elapsed, tick: source.tick, seed: source.seed,
        randomState: source.randomState, lights: source.lights, sediment: source.sediment, consumed: source.consumed });
      expect(restored.nextId).toBe(source.nextId + (version === 1 ? 8 : 0));
      for (const key of rainbellLedgerKeys) expect((restored.ecologyLedger as unknown as Record<string, number>)[key]).toBe(0);
      expect(JSON.stringify(source)).toBe(before);
    }
    const before = JSON.stringify(historicalStudy);
    const restored = restoreWorld(before)!;
    expect(restored).toMatchObject({ rainbells: [], rainbellAdmissionAt: historicalStudy.elapsed, rainbellCandidateAfterId: 0,
      nextId: historicalStudy.nextId, randomState: historicalStudy.randomState, elapsed: historicalStudy.elapsed,
      tick: historicalStudy.tick, lights: historicalStudy.lights, sediment: historicalStudy.sediment,
      grazers: historicalStudy.grazers, nests: historicalStudy.nests });
    expect(JSON.stringify(historicalStudy)).toBe(before);
  });

  it('continues middle-of-pulse cooldown, targets, cursors, active weather/current and paid feeding exactly at arbitrary phases', () => {
    for (const offset of [0, 1, 4, 17]) {
      const world = inhabited();
      for (let tick = 0; tick < offset; tick++) stepWorld(world);
      const resumed = restoreWorld(serializeWorld(world))!;
      expect(resumed).toEqual(world);
      for (let tick = 0; tick < 480; tick++) { stepWorld(world); stepWorld(resumed); }
      expect(resumed).toEqual(world);
    }
  });

  it('continues a nearly starved polyp and safely persists cached targets/cursors after their source grains disappeared', () => {
    const world = inhabited();
    world.sediment = [];
    Object.assign(world.rainbells[0], { reserve: 0, starvedFor: 59.5 });
    const resumed = restoreWorld(serializeWorld(world))!;
    expect(resumed).toEqual(world);
    for (let tick = 0; tick < 90; tick++) { stepWorld(world); stepWorld(resumed); }
    expect(resumed).toEqual(world);
    expect(world.rainbells).toEqual([]);
    expect(restoreWorld(serializeWorld(world))).toEqual(world);
  });

  it('accepts absence and newborn inactive pulse state without granting a replacement', () => {
    const world = inhabited();
    Object.assign(world.rainbells[0], { age: 0, lastPulseAt: null, pulseNextAllowedAt: world.elapsed,
      feedTargetSedimentId: null, pumpTargetSedimentId: null });
    expect(restoreWorld(serializeWorld(world))).toEqual(world);
    world.rainbells = [];
    expect(restoreWorld(serializeWorld(world))).toEqual(world);
    expect(restoreWorld(serializeWorld(createWorld()))!.rainbells).toEqual([]);
  });

  it('rejects malformed resources, unsafe IDs, partial ledgers, population excess and inconsistent deadlines', () => {
    const changes: ((world: Record<string, any>) => void)[] = [
      w => { delete w.rainbells; }, w => { w.rainbells = null; },
      w => { delete w.rainbellAdmissionAt; }, w => { w.rainbellAdmissionAt = -1; },
      w => { w.rainbellAdmissionAt = w.elapsed + 61; },
      w => { delete w.rainbellCandidateAfterId; }, w => { w.rainbellCandidateAfterId = -.1; },
      w => { w.rainbellCandidateAfterId = 1.5; }, w => { w.rainbellCandidateAfterId = w.nextId; },
      w => { w.rainbells[0].id = 0; }, w => { w.rainbells[0].id = w.nextId; },
      w => { w.rainbells[0].id = w.reedwells[0].id; }, w => { w.rainbells[0].id = w.currents[0].id; },
      w => { w.rainbells[0].id = Number.MAX_SAFE_INTEGER + 1; },
      w => { w.rainbells[0].body = .3; }, w => { w.rainbells[0].species = 'reedwell'; },
      w => { w.rainbells[0].age = -1; }, w => { w.rainbells[0].age = 601; },
      w => { w.rainbells[0].reserve = -.01; }, w => { w.rainbells[0].reserve = 1.01; },
      w => { w.rainbells[0].starvedFor = -1; }, w => { w.rainbells[0].starvedFor = 61; },
      w => { w.rainbells[0].hue = 360; }, w => { w.rainbells[0].x = 0; },
      w => { w.rainbells[0].pulseNextAllowedAt = 106; }, w => { delete w.rainbells[0].lastPulseAt; },
      w => { w.rainbells[0].lastPulseAt = w.elapsed + 1; }, w => { w.rainbells[0].lastPulseAt = -1; },
      w => { w.rainbells[0].lastPulseAt = null; w.rainbells[0].pulseNextAllowedAt = w.elapsed + .01; },
      w => { w.rainbells = Array.from({ length: 5 }, (_, index) => ({ ...w.rainbells[0], id: w.nextId + index })); w.nextId += 5; },
      w => { w.schemaRevision = 9; },
    ];
    for (const target of ['feedTargetSedimentId', 'pumpTargetSedimentId']) {
      changes.push(w => { delete w.rainbells[0][target]; }, w => { w.rainbells[0][target] = 0; },
        w => { w.rainbells[0][target] = w.nextId; }, w => { w.rainbells[0][target] = 1.5; });
      for (const wrongType of ['organisms', 'lights', 'grazers', 'nests', 'currents', 'skimmers', 'reedwells', 'rainbells']) {
        changes.push(w => { w.rainbells[0][target] = w[wrongType][0].id; });
      }
    }
    for (const key of rainbellLedgerKeys) changes.push(w => { delete w.ecologyLedger[key]; },
      w => { w.ecologyLedger[key] = -1; }, w => { w.ecologyLedger[key] = Infinity; });
    for (const mutate of changes) {
      const world = inhabited(); mutate(world);
      expect(restoreWorld(serializeWorld(world))).toBeNull();
    }
  });

  it('rejects even zero-valued rainbell fields in every previous schema instead of discarding state', () => {
    for (const [version, revision] of [[1, 0], [2, 0], [3, 1], [3, 2], [3, 3], [3, 4]] as const) {
      for (const key of ['rainbells', 'rainbellAdmissionAt', 'rainbellCandidateAfterId', ...rainbellLedgerKeys]) {
        const source = legacy(version, revision);
        if (rainbellLedgerKeys.includes(key)) {
          source.ecologyLedger ??= {};
          source.ecologyLedger[key] = 0;
        } else source[key] = key === 'rainbells' ? [] : 0;
        expect(restoreWorld(JSON.stringify(source))).toBeNull();
      }
    }
  });

  it('retains the one-megabyte import budget', () => {
    const world = inhabited();
    expect(serializeWorld(world).length).toBeLessThan(1_000_000);
    expect(restoreWorld(JSON.stringify({ ...world, ignored: 'x'.repeat(1_000_000) }))).toBeNull();
  });
});
