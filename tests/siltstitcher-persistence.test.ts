import { describe, expect, it } from 'vitest';
import historicalStudy from '../src/app/shower-study.json';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { createWorld, stepWorld } from '../src/world/simulation';
import { LIMITS, type World } from '../src/world/types';

const ledgerKeys = [
  'siltstitcherNestReserve',
  'siltstitcherNestCargo',
  'siltstitcherOutwardPigment',
  'siltstitcherMaintenancePigment',
];
const limpetLedgerKeys = ['glassLimpetIntake', 'glassLimpetMaintenancePigment'];
const cargoMiteLedgerKeys = ['cargoMiteIntake', 'cargoMiteMaintenancePigment'];

function inhabited(): World {
  const world = createWorld(91);
  world.elapsed = 96;
  world.tick = 2881;
  world.weatherCall = { startedAt: 90, nextAllowedAt: 150 };
  world.currents = [{ id: world.nextId++, x: 720, y: 500, dx: 1, dy: 0, startedAt: 95, duration: 8, radius: 110 }];
  Object.assign(world.nests[0], { x: 720, y: 500 });
  world.skimmers = [
    {
      id: world.nextId++,
      species: 'skimmer',
      body: 0.2,
      size: 8,
      x: world.nests[0].x,
      y: world.nests[0].y,
      vx: 1,
      vy: -1,
      hue: 199,
      age: 14,
      reserve: 0.4,
      phase: 0.3,
      homeNestId: world.nests[0].id,
      targetSedimentId: world.sediment[0].id,
      starvedFor: 0,
      lastEmissionAt: null,
      emissionNextAllowedAt: 0,
    },
  ];
  world.reedwells = [
    {
      id: world.nextId++,
      species: 'reedwell',
      body: 0.6,
      x: 600,
      y: 500,
      hue: 187,
      age: 23.25,
      lightStore: 0.8,
      lastEmissionAt: 90,
      emissionNextAllowedAt: 105,
    },
  ];
  world.reedwellCandidateAfterId = world.sediment[0].id;
  world.rainbells = [
    {
      id: world.nextId++,
      species: 'rainbell',
      body: 0.2,
      x: 900,
      y: 500,
      hue: 240,
      age: 42,
      reserve: 0.35,
      starvedFor: 0,
      feedTargetSedimentId: world.sediment[0].id,
      pumpTargetSedimentId: world.sediment[1].id,
      lastPulseAt: 90,
      pulseNextAllowedAt: 105,
    },
  ];
  world.rainbellCandidateAfterId = world.sediment[1].id;
  world.siltstitchers = [
    {
      id: world.nextId++,
      species: 'siltstitcher',
      body: 0.2,
      x: 740,
      y: 500,
      vx: 10,
      vy: 0,
      hue: 193,
      age: 20,
      reserve: 0.08,
      cargo: 0.25,
      starvedFor: 0,
      homeNestId: world.nests[0].id,
      mode: 'outbound',
      destination: { x: 800, y: 500 },
      blockedFor: 0,
    },
  ];
  world.siltstitcherAdmissionAt = 130;
  world.siltstitcherCandidateAfterId = world.nests[1].id;
  world.organisms[0].pigmentCredit = 0.31;
  world.ecologyLedger = {
    ...world.ecologyLedger,
    mineralizedPigment: 0.2,
    maintenancePigment: 0.01,
    emittedLight: 1.35,
    pigmentConverted: 0.9,
    feedingCreditLost: 0.03,
    daylightHarvested: 4.9,
    daylightUnharvested: 0.7,
    reedwellEmittedLight: 1.5,
    reedwellDissipatedLight: 1,
    rainbellIntake: 0.23,
    rainbellPumpingPigment: 0.08,
    rainbellMaintenancePigment: 0.013,
    siltstitcherNestReserve: 0.1,
    siltstitcherNestCargo: 0.3,
    siltstitcherOutwardPigment: 0.05,
    siltstitcherMaintenancePigment: 0.02,
  };
  return world;
}

function previous(world: World): Record<string, any> {
  const {
    siltstitchers: _bodies,
    siltstitcherAdmissionAt: _admission,
    siltstitcherCandidateAfterId: _cursor,
    glassLimpets: _glassLimpets,
    glassLimpetAdmissionAt: _glassLimpetAdmissionAt,
    glassLimpetCandidateAfterId: _glassLimpetCandidateAfterId,
    nextFoundingTick: _nextFoundingTick,
    foundingTypeCursor: _foundingTypeCursor,
    cargoMites: _cargoMites,
    cargoMiteAdmissionAt: _cargoMiteAdmissionAt,
    cargoMiteCandidateAfterId: _cargoMiteCandidateAfterId,
    skimmerCandidateAfterId: _skimmerCandidate,
    ...old
  } = structuredClone(world);
  const result: Record<string, any> = { ...old, schemaRevision: 5 };
  for (const key of [...ledgerKeys, ...limpetLedgerKeys, ...cargoMiteLedgerKeys]) delete result.ecologyLedger[key];
  return result;
}

function legacy(version: 1 | 2 | 3, revision: number): Record<string, any> {
  const world = previous(inhabited());
  world.version = version;
  if (version === 3 && revision === 5) return world;
  delete world.rainbells;
  delete world.rainbellAdmissionAt;
  delete world.rainbellCandidateAfterId;
  for (const key of ['rainbellIntake', 'rainbellPumpingPigment', 'rainbellMaintenancePigment'])
    delete world.ecologyLedger[key];
  if (version === 3 && revision === 4) {
    world.schemaRevision = 4;
    return world;
  }
  delete world.reedwells;
  delete world.reedwellAdmissionAt;
  delete world.reedwellCandidateAfterId;
  for (const key of ['daylightHarvested', 'daylightUnharvested', 'reedwellEmittedLight', 'reedwellDissipatedLight'])
    delete world.ecologyLedger[key];
  if (version === 3 && revision === 3) {
    world.schemaRevision = 3;
    return world;
  }
  delete world.skimmers;
  delete world.skimmerAdmissionAt;
  delete world.skimmerCandidateAfterId;
  delete world.ecologyLedger;
  world.organisms.forEach((entry: Record<string, unknown>) => {
    delete entry.pigmentCredit;
  });
  if (version === 3) {
    world.schemaRevision = revision;
    if (revision === 1) delete world.currents;
  } else {
    delete world.schemaRevision;
    delete world.weatherCall;
    delete world.currents;
  }
  if (version === 1) {
    delete world.grazers;
    delete world.nests;
  }
  return world;
}

describe('siltstitcher snapshot revision', () => {
  it('extends revision5 with empty life and zero accounting without changing paid previous ecology or identifiers', () => {
    const source = previous(inhabited());
    const before = JSON.stringify(source);
    const restored = restoreWorld(before)!;
    expect(restored).not.toBeNull();
    const {
      siltstitchers,
      siltstitcherAdmissionAt,
      siltstitcherCandidateAfterId,
      glassLimpets: _glassLimpets,
      glassLimpetAdmissionAt: _glassLimpetAdmissionAt,
      glassLimpetCandidateAfterId: _glassLimpetCandidateAfterId,
      nextFoundingTick: _nextFoundingTick,
      foundingTypeCursor: _foundingTypeCursor,
      cargoMites: _cargoMites,
      cargoMiteAdmissionAt: _cargoMiteAdmissionAt,
      cargoMiteCandidateAfterId: _cargoMiteCandidateAfterId,
      skimmerCandidateAfterId: _skimmerCandidate,
      ...old
    } = restored;
    expect(restored.schemaRevision).toBe(8);
    expect(siltstitchers).toEqual([]);
    expect(siltstitcherAdmissionAt).toBe(source.elapsed);
    expect(siltstitcherCandidateAfterId).toBe(0);
    const oldLedger = { ...old.ecologyLedger } as Record<string, number>;
    for (const key of [...ledgerKeys, ...limpetLedgerKeys, ...cargoMiteLedgerKeys]) {
      expect(oldLedger[key]).toBe(0);
      delete oldLedger[key];
    }
    expect({ ...old, schemaRevision: 5, ecologyLedger: oldLedger }).toEqual(source);
    expect(JSON.stringify(source)).toBe(before);
    expect(restoreWorld(serializeWorld(restored))).toEqual(restored);
  });

  it('migrates every historical contract and immutable shower without new grants or changed clocks/randomness', () => {
    for (const [version, revision] of [
      [1, 0],
      [2, 0],
      [3, 1],
      [3, 2],
      [3, 3],
      [3, 4],
      [3, 5],
    ] as const) {
      const source = legacy(version, revision);
      const before = JSON.stringify(source);
      const restored = restoreWorld(before)!;
      expect(restored).toMatchObject({
        schemaRevision: 8,
        siltstitchers: [],
        siltstitcherAdmissionAt: source.elapsed,
        siltstitcherCandidateAfterId: 0,
        elapsed: source.elapsed,
        tick: source.tick,
        seed: source.seed,
        randomState: source.randomState,
        lights: source.lights,
        sediment: source.sediment,
        consumed: source.consumed,
      });
      expect(restored.nextId).toBe(source.nextId + (version === 1 ? 8 : 0));
      for (const key of ledgerKeys) expect((restored.ecologyLedger as unknown as Record<string, number>)[key]).toBe(0);
      expect(JSON.stringify(source)).toBe(before);
    }
    const before = JSON.stringify(historicalStudy);
    const restored = restoreWorld(before)!;
    expect(restored).toMatchObject({
      siltstitchers: [],
      siltstitcherAdmissionAt: historicalStudy.elapsed,
      siltstitcherCandidateAfterId: 0,
      nextId: historicalStudy.nextId,
      randomState: historicalStudy.randomState,
      elapsed: historicalStudy.elapsed,
      tick: historicalStudy.tick,
      lights: historicalStudy.lights,
      sediment: historicalStudy.sediment,
      grazers: historicalStudy.grazers,
      nests: historicalStudy.nests,
    });
    expect(JSON.stringify(historicalStudy)).toBe(before);
  });

  it('continues paid outbound cargo, returning/home states, active weather/current and old species exactly at arbitrary phases', () => {
    for (const mode of ['outbound', 'home', 'returning'] as const) {
      for (const offset of [0, 1, 4, 17]) {
        const world = inhabited();
        world.siltstitchers[0].mode = mode;
        if (mode !== 'outbound') world.siltstitchers[0].destination = null;
        for (let tick = 0; tick < offset; tick++) stepWorld(world);
        const resumed = restoreWorld(serializeWorld(world))!;
        expect(resumed).toEqual(world);
        for (let tick = 0; tick < 480; tick++) {
          stepWorld(world);
          stepWorld(resumed);
        }
        expect(resumed).toEqual(world);
      }
    }
  });

  it('preserves blocked timeout/cargo at sediment capacity and continues without losing a paid grain', () => {
    const world = inhabited();
    world.grazers = [];
    world.skimmers = [];
    world.rainbells = [];
    world.reedwells = [];
    world.skimmerAdmissionAt = world.reedwellAdmissionAt = world.rainbellAdmissionAt = world.elapsed + 60;
    const body = world.siltstitchers[0];
    Object.assign(body, { x: 800, y: 500, mode: 'blocked', blockedFor: 9.8, vx: 0, vy: 0 });
    while (world.sediment.length < LIMITS.sediment)
      world.sediment.push({
        id: world.nextId++,
        x: 1000,
        y: 500,
        strength: 0.5,
        radius: 2,
        hue: 180,
        age: 0,
      });
    const resumed = restoreWorld(serializeWorld(world))!;
    expect(resumed).toEqual(world);
    for (let tick = 0; tick < 15; tick++) {
      stepWorld(world);
      stepWorld(resumed);
    }
    expect(world.siltstitchers[0]).toMatchObject({ mode: 'returning', cargo: 0.25, destination: null, blockedFor: 0 });
    for (let tick = 0; tick < 165; tick++) {
      stepWorld(world);
      stepWorld(resumed);
    }
    expect(resumed).toEqual(world);
  });

  it('preserves historical missing homes/cursors and near-starved paid cargo through a finite exit', () => {
    const world = inhabited();
    const body = world.siltstitchers[0];
    world.skimmers = [];
    world.grazers = [];
    world.nests = world.nests.filter((nest) => nest.id !== body.homeNestId);
    world.siltstitcherCandidateAfterId = body.homeNestId;
    Object.assign(body, { reserve: 0, starvedFor: 59.5, mode: 'returning', destination: null });
    const resumed = restoreWorld(serializeWorld(world))!;
    expect(resumed).toEqual(world);
    for (let tick = 0; tick < 90; tick++) {
      stepWorld(world);
      stepWorld(resumed);
    }
    expect(resumed).toEqual(world);
    expect(world.siltstitchers).toEqual([]);
    expect(restoreWorld(serializeWorld(world))).toEqual(world);
  });

  it('accepts variable absence and the per-type maximum under the shared storage budget', () => {
    const world = inhabited();
    world.siltstitchers = Array.from({ length: 6 }, (_, index) => {
      const home = { ...world.nests[0], id: world.nextId++, x: 500 + index * 80 };
      world.nests.push(home);
      return {
        ...structuredClone(world.siltstitchers[0]),
        id: world.nextId++,
        x: home.x,
        y: home.y,
        vx: 0,
        vy: 0,
        homeNestId: home.id,
        mode: 'home' as const,
        destination: null,
        blockedFor: 0,
      };
    });
    expect(restoreWorld(serializeWorld(world))).toEqual(world);
    expect(serializeWorld(world).length).toBeLessThan(1_000_000);
    expect(restoreWorld(JSON.stringify({ ...world, ignored: 'x'.repeat(1_000_000) }))).toBeNull();
    world.siltstitchers = [];
    expect(restoreWorld(serializeWorld(world))).toEqual(world);
    expect(restoreWorld(serializeWorld(createWorld()))!.siltstitchers).toEqual([]);
  });

  it('rejects malformed resources, mode/destination hybrids, unsafe identities, missing fields and excessive population', () => {
    const changes: ((world: Record<string, any>) => void)[] = [
      (w) => {
        delete w.siltstitchers;
      },
      (w) => {
        w.siltstitchers = null;
      },
      (w) => {
        delete w.siltstitcherAdmissionAt;
      },
      (w) => {
        w.siltstitcherAdmissionAt = -1;
      },
      (w) => {
        w.siltstitcherAdmissionAt = w.elapsed + 61;
      },
      (w) => {
        delete w.siltstitcherCandidateAfterId;
      },
      (w) => {
        w.siltstitcherCandidateAfterId = -1;
      },
      (w) => {
        w.siltstitcherCandidateAfterId = 0.5;
      },
      (w) => {
        w.siltstitcherCandidateAfterId = w.nextId;
      },
      (w) => {
        w.siltstitchers[0].id = 0;
      },
      (w) => {
        w.siltstitchers[0].id = w.nextId;
      },
      (w) => {
        w.siltstitchers[0].id = Number.MAX_SAFE_INTEGER + 1;
      },
      (w) => {
        w.siltstitchers[0].species = 'grazer';
      },
      (w) => {
        w.siltstitchers[0].body = 0.3;
      },
      (w) => {
        w.siltstitchers[0].reserve = -0.01;
      },
      (w) => {
        w.siltstitchers[0].reserve = 0.100001;
      },
      (w) => {
        w.siltstitchers[0].cargo = -0.01;
      },
      (w) => {
        w.siltstitchers[0].cargo = 0.300001;
      },
      (w) => {
        w.siltstitchers[0].cargo = 0.0001;
      },
      (w) => {
        w.siltstitchers[0].mode = 'blocked';
        w.siltstitchers[0].cargo = 0.059;
      },
      (w) => {
        w.siltstitchers[0].age = -1;
      },
      (w) => {
        w.siltstitchers[0].age = 481;
      },
      (w) => {
        w.siltstitchers[0].starvedFor = 60.1;
      },
      (w) => {
        w.siltstitchers[0].starvedFor = -1;
      },
      (w) => {
        w.siltstitchers[0].hue = 360;
      },
      (w) => {
        w.siltstitchers[0].x = 0;
      },
      (w) => {
        w.siltstitchers[0].vx = 10.1;
      },
      (w) => {
        w.siltstitchers[0].vx = 8;
        w.siltstitchers[0].vy = 8;
      },
      (w) => {
        w.siltstitchers[0].homeNestId = 0;
      },
      (w) => {
        w.siltstitchers[0].homeNestId = w.nextId;
      },
      (w) => {
        w.siltstitchers[0].mode = 'unknown';
      },
      (w) => {
        w.siltstitchers[0].destination = null;
      },
      (w) => {
        w.siltstitchers[0].destination = { x: 720, y: 500 };
      },
      (w) => {
        w.siltstitchers[0].destination = { x: 900, y: 500 };
      },
      (w) => {
        w.siltstitchers[0].destination.x = 0;
      },
      (w) => {
        w.siltstitchers[0].blockedFor = 0.1;
      },
      (w) => {
        w.siltstitchers[0].mode = 'blocked';
        w.siltstitchers[0].blockedFor = 10.1;
      },
      (w) => {
        w.siltstitchers[0].mode = 'blocked';
        w.siltstitchers[0].blockedFor = -1;
      },
      (w) => {
        w.siltstitchers[0].mode = 'blocked';
        w.siltstitchers[0].destination = null;
      },
      (w) => {
        w.siltstitchers[0].mode = 'home';
      },
      (w) => {
        w.siltstitchers[0].mode = 'returning';
      },
      (w) => {
        w.siltstitchers.push({ ...structuredClone(w.siltstitchers[0]), id: w.nextId++ });
      },
      (w) => {
        w.siltstitchers = Array.from({ length: 7 }, () => ({ ...w.siltstitchers[0], id: w.nextId++ }));
      },
      (w) => {
        w.schemaRevision = 9;
      },
    ];
    for (const other of [
      'organisms',
      'lights',
      'sediment',
      'grazers',
      'nests',
      'currents',
      'skimmers',
      'reedwells',
      'rainbells',
    ]) {
      changes.push((w) => {
        w.siltstitchers[0].id = w[other][0].id;
      });
      if (other !== 'nests')
        changes.push((w) => {
          w.siltstitchers[0].homeNestId = w[other][0].id;
        });
    }
    changes.push((w) => {
      w.siltstitchers[0].homeNestId = w.siltstitchers[0].id;
    });
    for (const key of [
      'id',
      'species',
      'x',
      'y',
      'vx',
      'vy',
      'body',
      'reserve',
      'cargo',
      'age',
      'hue',
      'homeNestId',
      'starvedFor',
      'mode',
      'destination',
      'blockedFor',
    ]) {
      changes.push((w) => {
        delete w.siltstitchers[0][key];
      });
    }
    for (const key of ledgerKeys)
      changes.push(
        (w) => {
          delete w.ecologyLedger[key];
        },
        (w) => {
          w.ecologyLedger[key] = -1;
        },
        (w) => {
          w.ecologyLedger[key] = Infinity;
        },
      );
    for (const mutate of changes) {
      const world = inhabited();
      mutate(world);
      expect(restoreWorld(serializeWorld(world))).toBeNull();
    }
  });

  it('rejects each new field, including zero ledgers, in every historical schema', () => {
    for (const [version, revision] of [
      [1, 0],
      [2, 0],
      [3, 1],
      [3, 2],
      [3, 3],
      [3, 4],
      [3, 5],
    ] as const) {
      for (const key of ['siltstitchers', 'siltstitcherAdmissionAt', 'siltstitcherCandidateAfterId', ...ledgerKeys]) {
        const source = legacy(version, revision);
        if (ledgerKeys.includes(key)) {
          source.ecologyLedger ??= {};
          source.ecologyLedger[key] = 0;
        } else source[key] = key === 'siltstitchers' ? [] : 0;
        expect(restoreWorld(JSON.stringify(source))).toBeNull();
      }
    }
  });
});
