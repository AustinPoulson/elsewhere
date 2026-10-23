import { describe, expect, it } from 'vitest';
import historicalStudy from '../src/app/shower-study.json';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { createWorld, stepWorld } from '../src/world/simulation';
import type { Skimmer, World } from '../src/world/types';

function legacy(world: World, version: 1 | 2 | 3, revision = 2) {
  const { skimmers: _skimmers, skimmerAdmissionAt: _admission, ecologyLedger: _ledger, reedwells: _reedwells, reedwellAdmissionAt: _reedwellAdmission, reedwellCandidateAfterId: _reedwellCandidate, rainbells: _rainbells, rainbellAdmissionAt: _rainbellAdmission, rainbellCandidateAfterId: _rainbellCandidate, siltstitchers: _siltstitchers, siltstitcherAdmissionAt: _siltstitcherAdmission, siltstitcherCandidateAfterId: _siltstitcherCandidate, organisms, ...old } = structuredClone(world);
  const result: Record<string, any> = { ...old, version,
    organisms: organisms.map(({ pigmentCredit: _credit, ...entry }) => entry) };
  if (version !== 3) { delete result.schemaRevision; delete result.weatherCall; delete result.currents; }
  else { result.schemaRevision = revision; if (revision === 1) delete result.currents; }
  if (version === 1) { delete result.grazers; delete result.nests; }
  return result;
}

function inhabited(): World {
  const world = createWorld(91);
  world.elapsed = 20;
  world.tick = 601;
  world.weatherCall = { startedAt: 10, nextAllowedAt: 70 };
  world.currents = [{ id: world.nextId++, x: 720, y: 500, dx: 1, dy: 0, startedAt: 19, duration: 8, radius: 110 }];
  const home = world.nests[0];
  const skimmer: Skimmer = { id: world.nextId++, species: 'skimmer', size: 8, body: .2,
    x: home.x, y: home.y, vx: 2, vy: 0, hue: 359, reserve: .8, age: 19, phase: .3,
    homeNestId: home.id, targetSedimentId: world.sediment[0].id, starvedFor: 0,
    emissionNextAllowedAt: 0, lastEmissionAt: null };
  world.skimmers = [skimmer];
  world.skimmerAdmissionAt = 60;
  world.organisms[0].pigmentCredit = .073;
  world.ecologyLedger = { ...world.ecologyLedger, mineralizedPigment: .2, maintenancePigment: .01, emittedLight: 1.35, pigmentConverted: .9, feedingCreditLost: .03 };
  return world;
}

describe('prism snapshot revision', () => {
  it('migrates every supported historical schema without granting population or resources', () => {
    for (const [version, revision] of [[1, 0], [2, 0], [3, 1], [3, 2]] as const) {
      const source = legacy(createWorld(42), version, revision);
      source.elapsed = 123; source.tick = 3690;
      const before = JSON.stringify(source);
      const restored = restoreWorld(before)!;
      expect(restored).not.toBeNull();
      expect(restored).toMatchObject({ version: 3, schemaRevision: 6, skimmers: [], skimmerAdmissionAt: 123,
        elapsed: 123, tick: 3690, seed: source.seed, randomState: source.randomState,
        lights: source.lights, sediment: source.sediment, consumed: source.consumed });
      expect(restored.organisms).toEqual(source.organisms.map((entry: object) => ({ ...entry, pigmentCredit: 0 })));
      expect(Object.values(restored.ecologyLedger)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      expect(restored.nextId).toBe(source.nextId + (version === 1 ? 8 : 0));
      expect(JSON.stringify(source)).toBe(before);
      expect(restoreWorld(serializeWorld(restored))).toEqual(restored);
    }
  });

  it('retains the immutable historical shower and adds only empty prism state', () => {
    const before = JSON.stringify(historicalStudy);
    const world = restoreWorld(before)!;
    expect(world.skimmers).toEqual([]);
    expect(world.organisms.every(entry => entry.pigmentCredit === 0)).toBe(true);
    expect(world.skimmerAdmissionAt).toBe(historicalStudy.elapsed);
    expect(world.nextId).toBe(historicalStudy.nextId);
    expect(JSON.stringify(historicalStudy)).toBe(before);
  });

  it('migrates active revision2 rain and currents without dropping either saved relationship', () => {
    const source = legacy(inhabited(), 3, 2);
    const before = JSON.stringify(source);
    const restored = restoreWorld(before)!;
    expect(restored).not.toBeNull();
    expect(restored.weatherCall).toEqual(source.weatherCall);
    expect(restored.currents).toEqual(source.currents);
    expect(restored.nextId).toBe(source.nextId);
    expect(restored.randomState).toBe(source.randomState);
    expect(restored.skimmerAdmissionAt).toBe(source.elapsed);
    expect(restored.skimmers).toEqual([]);
    expect(JSON.stringify(source)).toBe(before);
    expect(restoreWorld(serializeWorld(restored))).toEqual(restored);
  });

  it('preserves weather, current, funded credit, ledger and arbitrary search-phase continuation', () => {
    for (let offset = 0; offset < 6; offset++) {
      const world = inhabited();
      for (let tick = 0; tick < offset; tick++) stepWorld(world);
      const resumed = restoreWorld(serializeWorld(world))!;
      expect(resumed).toEqual(world);
      for (let tick = 0; tick < 180; tick++) { stepWorld(world); stepWorld(resumed); }
      expect(resumed).toEqual(world);
    }
  });

  it('allows an extinct skimmer population and an already deleted cached target', () => {
    const world = inhabited();
    const target = world.skimmers[0].targetSedimentId;
    world.sediment = world.sediment.filter(entry => entry.id !== target);
    expect(restoreWorld(serializeWorld(world))).toEqual(world);
    world.skimmers = [];
    expect(restoreWorld(serializeWorld(world))).toEqual(world);
  });

  it('rejects malformed fields, ownership, limits and global identifier collisions', () => {
    const changes: ((world: Record<string, any>) => void)[] = [
      w => { delete w.skimmers; }, w => { w.skimmers = null; },
      w => { delete w.skimmerAdmissionAt; }, w => { w.skimmerAdmissionAt = 81; },
      w => { w.skimmerAdmissionAt = -1; }, w => { delete w.ecologyLedger; },
      w => { delete w.ecologyLedger.feedingCreditLost; }, w => { w.ecologyLedger.emittedLight = -1; },
      w => { w.ecologyLedger.maintenancePigment = Infinity; },
      w => { delete w.organisms[0].pigmentCredit; }, w => { w.organisms[0].pigmentCredit = 1.01; },
      w => { w.organisms[0].pigmentCredit = -.01; }, w => { w.skimmers[0].body = .6; },
      w => { w.skimmers[0].size = 9; }, w => { w.skimmers[0].species = 'grazer'; },
      w => { w.skimmers[0].vx = 81; }, w => { w.skimmers[0].reserve = 1.1; },
      w => { w.skimmers[0].age = -1; }, w => { w.skimmers[0].hue = 360; },
      w => { w.skimmers[0].phase = -1; }, w => { w.skimmers[0].starvedFor = 61; },
      w => { w.skimmers[0].x = 0; }, w => { w.skimmers[0].homeNestId = w.organisms[0].id; },
      w => { w.skimmers[0].targetSedimentId = w.nextId; }, w => { w.skimmers[0].targetSedimentId = 0; },
      w => { w.skimmers[0].targetSedimentId = w.organisms[0].id; },
      w => { w.skimmers[0].emissionNextAllowedAt = 36; },
      w => { w.skimmers[0].emissionNextAllowedAt = 21; },
      w => { w.skimmers[0].lastEmissionAt = w.elapsed; w.skimmers[0].emissionNextAllowedAt = 0; },
      w => { w.skimmers[0].lastEmissionAt = 5; w.skimmers[0].emissionNextAllowedAt = 19; },
      w => { w.skimmers[0].lastEmissionAt = 21; }, w => { w.skimmers[0].lastEmissionAt = -1; },
      w => { w.skimmers[0].id = w.currents[0].id; }, w => { w.skimmers[0].id = w.nextId; },
      w => { w.skimmers = Array.from({ length: 7 }, (_, index) => ({ ...w.skimmers[0], id: w.nextId + index })); w.nextId += 7; },
      w => { w.schemaRevision = 7; },
    ];
    for (const change of changes) {
      const world = inhabited(); change(world);
      expect(restoreWorld(serializeWorld(world))).toBeNull();
    }
  });

  it('rejects present prism fields in downgraded schemas rather than silently resetting them', () => {
    for (const [version, revision] of [[1, 0], [2, 0], [3, 1], [3, 2]] as const) {
      for (const key of ['skimmers', 'skimmerAdmissionAt', 'ecologyLedger', 'pigmentCredit']) {
        const world = legacy(createWorld(), version, revision);
        if (key === 'pigmentCredit') world.organisms[0].pigmentCredit = 0;
        else world[key] = key === 'skimmers' ? [] : key === 'skimmerAdmissionAt' ? 0 : {};
        expect(restoreWorld(JSON.stringify(world))).toBeNull();
      }
    }
  });
});
