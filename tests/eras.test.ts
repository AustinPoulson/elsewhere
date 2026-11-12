import { describe, expect, it } from 'vitest';
import { WorldSession } from '../src/app/session';
import { eraById, eraCatalogBytes, namedEras } from '../src/world/era-catalog';
import {
  captureNamedEra,
  ERA_FORMAT,
  MAX_ERA_CATALOG_BYTES,
  MAX_ERA_FILE_LENGTH,
  MAX_ERA_NOTE_LENGTH,
  MAX_NAMED_ERAS,
  MAX_ERA_SNAPSHOT_LENGTH,
  parseEraCatalog,
  parseEraFile,
} from '../src/world/eras';
import { inInletPool, inOpeningPool } from '../src/world/habitat';
import { planCatchUp } from '../src/world/catchup';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { createWorld, stepWorld } from '../src/world/simulation';
import { CARGO_MITE_CAP } from '../src/world/species/catalog';
import { FIXED_STEP, LIMITS, SCHEMA_REVISION } from '../src/world/types';

function captureFile(seed = 7, worldDays = 2) {
  return captureNamedEra({
    id: `seed-${seed}-days-${worldDays}`,
    name: 'A short capture',
    note: 'A bounded test capture of the named-era format.',
    seed,
    worldDays,
    visitorLight: false,
    source: `createWorld(${seed}), ${worldDays} world days of stepWorld; visitor light off.`,
  });
}

describe('named eras', () => {
  it('keeps the live snapshot at the current revision and stores eras beside it', () => {
    expect(SCHEMA_REVISION).toBe(15);
    const opening = createWorld(1);
    expect(opening.schemaRevision).toBe(15);
    expect(opening.fossils).toEqual([]);
    expect('camera' in opening).toBe(false);
    expect('journal' in opening).toBe(false);
  });

  it('captures a world through restoreWorld without granting life, pigment, or a last-seen stamp', () => {
    const live = createWorld(7);
    const steps = Math.ceil((2 * 360) / FIXED_STEP);
    for (let step = 0; step < steps; step++) stepWorld(live);
    live.lastSeenAt = null;
    const { file, era } = captureFile(7, 2);
    expect(era.world.lastSeenAt).toBeNull();
    expect(era.snapshot).toBe(serializeWorld(live));
    expect(era.world.organisms).toHaveLength(live.organisms.length);
    expect(era.world.sediment.reduce((total, grain) => total + grain.strength, 0)).toBeCloseTo(
      live.sediment.reduce((total, grain) => total + grain.strength, 0),
      10,
    );
    expect(restoreWorld(era.snapshot)).toEqual(era.world);
    expect(parseEraFile(JSON.stringify(file))).toEqual(era);
    expect(JSON.stringify(file).length).toBeLessThanOrEqual(MAX_ERA_FILE_LENGTH);
    expect(era.snapshot.length).toBeLessThanOrEqual(MAX_ERA_SNAPSHOT_LENGTH);
  });

  it('rejects malformed files, mismatched provenance, hybrids, and overfull catalogs', () => {
    const { file, era } = captureFile(8, 1);
    const encoded = JSON.stringify(file);
    expect(parseEraFile('')).toBeNull();
    expect(parseEraFile('{')).toBeNull();
    expect(parseEraFile('x'.repeat(MAX_ERA_FILE_LENGTH + 1))).toBeNull();
    expect(parseEraFile(JSON.stringify({ ...file, format: 'world' }))).toBeNull();
    expect(parseEraFile(JSON.stringify({ ...file, formatRevision: 2 }))).toBeNull();
    expect(parseEraFile(JSON.stringify({ ...file, id: 'Bad Id' }))).toBeNull();
    expect(parseEraFile(JSON.stringify({ ...file, note: 'n'.repeat(MAX_ERA_NOTE_LENGTH + 1) }))).toBeNull();
    expect(parseEraFile(JSON.stringify({ ...file, provenance: { ...file.provenance, worldDays: 30 } }))).toBeNull();
    expect(parseEraFile(JSON.stringify({ ...file, provenance: { ...file.provenance, seed: 99 } }))).toBeNull();
    const hybrid = structuredClone(file);
    const hybridWorld = hybrid.world as Record<string, unknown>;
    hybridWorld.schemaRevision = 12;
    expect(parseEraFile(JSON.stringify(hybrid))).toBeNull();
    expect(parseEraCatalog([])).toBeNull();
    expect(parseEraCatalog([encoded, encoded])).toBeNull();
    const many = Array.from({ length: MAX_NAMED_ERAS + 1 }, (_, index) =>
      JSON.stringify({ ...file, id: `era-${index + 1}` }),
    );
    expect(many).toHaveLength(9);
    expect(parseEraCatalog(many)).toBeNull();
    expect(parseEraCatalog([encoded])).toEqual([era]);
  });

  it('opens each curated era through the ordinary importer without gifts or catch-up', () => {
    const eras = namedEras();
    expect(eras).toHaveLength(3);
    expect(eras.length).toBeLessThanOrEqual(MAX_NAMED_ERAS);
    expect(eraCatalogBytes()).toBeLessThanOrEqual(MAX_ERA_CATALOG_BYTES);
    expect(new Set(eras.map((era) => era.id)).size).toBe(eras.length);

    const hour = eraById('an-hour-unwatched')!;
    const thirty = eraById('thirty-days-unwatched')!;
    const other = eraById('another-seeds-sediment')!;
    expect(hour.world.elapsed).toBeCloseTo(3600, 5);
    expect(hour.world.fossils.length).toBe(12);
    expect(hour.world.skimmers.length).toBe(3);
    expect(hour.world.cargoMites.length).toBe(3);
    expect(hour.world.lastSeenAt).toBeNull();
    expect(
      hour.world.sediment.reduce((total, grain) => total + (inInletPool(grain.x, grain.y) ? grain.strength : 0), 0),
    ).toBe(0);

    expect(thirty.world.elapsed).toBeCloseTo(10800, 5);
    expect(thirty.world.fossils).toHaveLength(LIMITS.fossils);
    expect(thirty.world.cargoMites).toHaveLength(CARGO_MITE_CAP);
    expect(
      thirty.world.sediment.reduce((total, grain) => total + (inOpeningPool(grain.x, grain.y) ? grain.strength : 0), 0),
    ).toBe(0);
    expect(
      thirty.world.sediment.reduce((total, grain) => total + (inInletPool(grain.x, grain.y) ? grain.strength : 0), 0),
    ).toBeGreaterThan(0.3);

    expect(other.provenance.seed).toBe(42);
    expect(other.world.fossils).toHaveLength(LIMITS.fossils);
    expect(other.world.skimmers.length).toBeGreaterThan(0);
    expect(
      other.world.sediment.reduce((total, grain) => total + (inOpeningPool(grain.x, grain.y) ? grain.strength : 0), 0),
    ).toBeGreaterThan(0.4);

    for (const era of eras) {
      expect(era.note.length).toBeGreaterThan(40);
      expect(era.world.schemaRevision).toBe(SCHEMA_REVISION);
      expect(era.world.awayTraces).toEqual([]);
      expect(era.world.shoreMemory).toEqual([]);
      expect(era.snapshot.length).toBeLessThanOrEqual(MAX_ERA_SNAPSHOT_LENGTH);
      const session = new WorldSession(createWorld(99));
      const frozen = serializeWorld(era.world);
      const before = Date.now();
      expect(
        session.importSnapshot(JSON.stringify({ format: ERA_FORMAT, world: era.world }), session.importToken()),
      ).toBe('invalid');
      expect(session.world.seed).toBe(99);
      expect(session.importSnapshot(era.snapshot, session.importToken())).toBe('imported');
      expect(session.world.elapsed).toBe(era.world.elapsed);
      expect(session.world.organisms).toHaveLength(era.world.organisms.length);
      expect(session.world.fossils).toHaveLength(era.world.fossils.length);
      expect(session.world.sediment).toHaveLength(era.world.sediment.length);
      expect(session.world.awayTraces).toEqual([]);
      expect(session.world.shoreMemory).toEqual([]);
      expect(session.world.lastSeenAt).toBeGreaterThanOrEqual(before);
      expect(session.world.lastSeenAt).toBeLessThanOrEqual(Date.now());
      expect(planCatchUp(session.world.lastSeenAt, Date.now())).toMatchObject({
        reason: 'too-small',
        simulateSeconds: 0,
      });
      expect(serializeWorld({ ...session.world, lastSeenAt: null })).toBe(frozen);
      expect(restoreWorld(serializeWorld(session.world))).toEqual(session.world);
    }
  });
});
