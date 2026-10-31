import { describe, expect, it } from 'vitest';
import { SAVE_KEY, WorldSession, type SaveStorage } from '../src/app/session';
import { createShowerStudy, SHOWER_STUDY } from '../src/app/study';
import { createWorld, releaseNestPigment, stepWorld } from '../src/world/simulation';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { LIMITS } from '../src/world/types';
import { getWeather } from '../src/world/weather';
import fixture from '../src/app/shower-study.json';

function storage() {
  const entries = new Map<string, string>();
  return {
    entries,
    writes: 0,
    setItem(key: string, value: string) {
      this.writes++;
      entries.set(key, value);
    },
  };
}
const controls = { paused: false, tool: 'light', selectedId: 3, cursor: { x: 700, y: 500 } };

describe('safe shower study', () => {
  it('normalizes its immutable v2 history to the current schema without changing ecology, rain or conserved six-grain return', () => {
    const expected = restoreWorld(JSON.stringify(fixture));
    expect(expected).not.toBeNull();
    const { version: _oldVersion, ...historicalEcology } = fixture;
    const {
      version: _version,
      schemaRevision: _revision,
      weatherCall: _call,
      currents: _currents,
      skimmers: _skimmers,
      skimmerAdmissionAt: _admission,
      skimmerCandidateAfterId: _skimmerCandidate,
      ecologyLedger: _ledger,
      reedwells: _reedwells,
      reedwellAdmissionAt: _reedwellAdmission,
      reedwellCandidateAfterId: _reedwellCandidate,
      rainbells: _rainbells,
      rainbellAdmissionAt: _rainbellAdmission,
      rainbellCandidateAfterId: _rainbellCandidate,
      siltstitchers: _siltstitchers,
      siltstitcherAdmissionAt: _siltstitcherAdmission,
      siltstitcherCandidateAfterId: _siltstitcherCandidate,
      glassLimpets: _glassLimpets,
      glassLimpetAdmissionAt: _glassLimpetAdmissionAt,
      glassLimpetCandidateAfterId: _glassLimpetCandidateAfterId,
      nextFoundingTick: _nextFoundingTick,
      foundingTypeCursor: _foundingTypeCursor,
      cargoMites: _cargoMites,
      cargoMiteAdmissionAt: _cargoMiteAdmissionAt,
      cargoMiteCandidateAfterId: _cargoMiteCandidateAfterId,
      organisms,
      ...normalizedEcology
    } = expected!;
    expect({ ...normalizedEcology, organisms: organisms.map(({ pigmentCredit: _credit, ...entry }) => entry) }).toEqual(
      historicalEcology,
    );
    expect(expected!.seed).toBe(SHOWER_STUDY.seed);
    expect(expected!.tick).toBe(SHOWER_STUDY.steps);
    expect(expected!.elapsed).toBeCloseTo(SHOWER_STUDY.seconds, 10);
    const study = createShowerStudy();
    expect(study).toEqual(expected);
    expect(study.version).toBe(3);
    expect(getWeather(study.elapsed).raining).toBe(true);
    expect(study.sediment.length).toBeLessThanOrEqual(LIMITS.sediment - 6);
    const nest = study.nests.find((n) => n.pigment >= 3)!;
    const count = study.sediment.length;
    const total =
      study.sediment.reduce((sum, grain) => sum + grain.strength, 0) +
      study.nests.reduce((sum, n) => sum + n.pigment, 0);
    expect(releaseNestPigment(study, nest.id)).toEqual({ status: 'released', amount: 3 });
    expect(study.sediment).toHaveLength(count + 6);
    expect(
      study.sediment.reduce((sum, grain) => sum + grain.strength, 0) +
        study.nests.reduce((sum, n) => sum + n.pigment, 0),
    ).toBeCloseTo(total, 10);
    expect(restoreWorld(serializeWorld(study))).toEqual(study);
    expect(createShowerStudy()).toEqual(expected);
  });

  it('checkpoints personal progress and suppresses every subsequent lifecycle save while the study changes', () => {
    const personal = createWorld(92);
    for (let i = 0; i < 50; i++) stepWorld(personal);
    const before = serializeWorld(personal);
    const session = new WorldSession(personal);
    const disk = storage();
    expect(session.enterStudy(controls, disk)).toBe('saved');
    expect(disk.entries.get(SAVE_KEY)).toBe(before);
    for (let i = 0; i < 90; i++) stepWorld(session.world);
    releaseNestPigment(session.world, session.world.nests[0].id);
    // Periodic, visibilitychange, pagehide, and action saves all share this boundary.
    for (let i = 0; i < 4; i++) expect(session.save(disk)).toBe('preview');
    expect(disk.writes).toBe(1);
    expect(serializeWorld(personal)).toBe(before);
    expect(restoreWorld(disk.entries.get(SAVE_KEY)!)).toEqual(personal);
    expect(session.returnToPool()).toBe(controls);
    expect(session.world).toBe(personal);
    expect(serializeWorld(session.world)).toBe(before);
    expect(session.save(disk)).toBe('saved');
    expect(disk.entries.get(SAVE_KEY)).toBe(before);
  });

  it('resets the study to its fixture, retains personal identity and controls, and never checkpoints twice on reentry', () => {
    const personal = createWorld(100);
    const before = serializeWorld(personal);
    const session = new WorldSession(personal);
    const disk = storage();
    session.enterStudy(controls, disk);
    const first = session.world;
    expect(session.enterStudy({ ...controls, paused: true }, disk)).toBe('preview');
    expect(session.world).toBe(first);
    stepWorld(session.world);
    session.reset();
    expect(session.world).toEqual(createShowerStudy());
    expect(session.world).not.toBe(first);
    expect(session.save(disk)).toBe('preview');
    expect(disk.writes).toBe(1);
    expect(session.returnToPool()).toBe(controls);
    expect(session.world).toBe(personal);
    expect(serializeWorld(personal)).toBe(before);
    expect(session.returnToPool()).toBeNull();
    session.reset();
    expect(session.world).toEqual(createWorld(100));
  });

  it('survives denied storage in memory without attempting study writes', () => {
    const personal = createWorld(73);
    let attempts = 0;
    const denied: SaveStorage = {
      setItem() {
        attempts++;
        throw new Error('Quota or privacy policy');
      },
    };
    const session = new WorldSession(personal);
    expect(session.enterStudy(controls, denied)).toBe('unavailable');
    expect(session.preview).toBe(true);
    expect(session.save(denied)).toBe('preview');
    expect(attempts).toBe(1);
    expect(session.returnToPool()).toBe(controls);
    expect(session.world).toBe(personal);
    expect(session.save(denied)).toBe('unavailable');
  });

  it('rejects asynchronous imports across enter/return/reset and concurrent imports without replacing either pool', () => {
    const personal = createWorld(11);
    const imported = serializeWorld(createWorld(12));
    const session = new WorldSession(personal);
    const token = session.importToken();
    session.enterStudy(controls, storage());
    const study = session.world;
    expect(session.importToken()).toBeNull();
    expect(session.importSnapshot(imported, token)).toBe('stale');
    expect(session.world).toBe(study);
    session.returnToPool();
    expect(session.importSnapshot(imported, token)).toBe('stale');
    expect(session.world).toBe(personal);
    const resetToken = session.importToken();
    session.reset();
    expect(session.importSnapshot(imported, resetToken)).toBe('stale');
    const freshToken = session.importToken();
    expect(session.importSnapshot(imported, freshToken)).toBe('imported');
    expect(session.importSnapshot(serializeWorld(createWorld(13)), freshToken)).toBe('stale');
    expect(session.world.seed).toBe(12);
  });

  it('keeps valid v1 migration and v2 import/export while malformed imports leave the current world intact', () => {
    const session = new WorldSession(createWorld(22));
    const legacy = JSON.parse(serializeWorld(createWorld(44)));
    legacy.version = 1;
    delete legacy.grazers;
    delete legacy.nests;
    delete legacy.weatherCall;
    delete legacy.schemaRevision;
    delete legacy.currents;
    delete legacy.skimmers;
    delete legacy.skimmerAdmissionAt;
    delete legacy.skimmerCandidateAfterId;
    delete legacy.ecologyLedger;
    delete legacy.reedwells;
    delete legacy.reedwellAdmissionAt;
    delete legacy.reedwellCandidateAfterId;
    delete legacy.rainbells;
    delete legacy.rainbellAdmissionAt;
    delete legacy.rainbellCandidateAfterId;
    delete legacy.siltstitchers;
    delete legacy.siltstitcherAdmissionAt;
    delete legacy.siltstitcherCandidateAfterId;
    delete legacy.glassLimpets;
    delete legacy.glassLimpetAdmissionAt;
    delete legacy.glassLimpetCandidateAfterId;
    delete legacy.cargoMites;
    delete legacy.cargoMiteAdmissionAt;
    delete legacy.cargoMiteCandidateAfterId;
    delete legacy.nextFoundingTick;
    delete legacy.foundingTypeCursor;
    for (const entry of legacy.organisms) delete entry.pigmentCredit;
    expect(session.importSnapshot(JSON.stringify(legacy), session.importToken())).toBe('imported');
    expect(session.world.version).toBe(3);
    expect(session.world.grazers).toHaveLength(4);
    const before = session.world;
    expect(session.importSnapshot('{', session.importToken())).toBe('invalid');
    expect(session.world).toBe(before);
    expect(session.importSnapshot(serializeWorld(createWorld(55)), session.importToken())).toBe('imported');
    expect(restoreWorld(serializeWorld(session.world))).toEqual(session.world);
  });
});
