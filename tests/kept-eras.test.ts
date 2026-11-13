import { describe, expect, it } from 'vitest';
import { SAVE_KEY, WorldSession } from '../src/app/session';
import { eraById, eraCatalogBytes, isReviewedEraId, namedEras } from '../src/world/era-catalog';
import { captureNamedEra, keepLiveEra, MAX_ERA_CATALOG_BYTES, MAX_NAMED_ERAS, parseEraFile } from '../src/world/eras';
import {
  addKeptEra,
  encodeKeptEraStore,
  KEPT_ERAS_FORMAT,
  KEPT_ERAS_KEY,
  nextKeptEraId,
  parseKeptEraStore,
  readKeptEras,
  removeKeptEra,
  shelfRoom,
  writeKeptEras,
} from '../src/world/kept-eras';
import { planCatchUp } from '../src/world/catchup';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { createWorld, stepWorld } from '../src/world/simulation';
import { composeAwayTraces } from '../src/world/traces';
import { SCHEMA_REVISION } from '../src/world/types';

function captureFile(seed = 7, worldDays = 1, id = `seed-${seed}-days-${worldDays}`) {
  return captureNamedEra({
    id,
    name: 'A short capture',
    note: 'A bounded test capture of the named-era format.',
    seed,
    worldDays,
    visitorLight: false,
    source: `createWorld(${seed}), ${worldDays} world days of stepWorld; visitor light off.`,
  });
}

function memoryStorage(entries = new Map<string, string>()) {
  return {
    entries,
    getItem(key: string) {
      return entries.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      entries.set(key, value);
    },
  };
}

describe('visitor kept eras', () => {
  it('keeps the live snapshot at revision 15 and stores kept eras beside it', () => {
    expect(SCHEMA_REVISION).toBe(15);
    expect(namedEras()).toHaveLength(3);
    expect(namedEras().length).toBeLessThanOrEqual(MAX_NAMED_ERAS);
    expect(eraCatalogBytes()).toBeLessThanOrEqual(MAX_ERA_CATALOG_BYTES);
    const world = createWorld(4);
    const before = serializeWorld(world);
    const captured = keepLiveEra(world, 'kept-1')!;
    const disk = memoryStorage();
    disk.setItem(SAVE_KEY, before);
    expect(writeKeptEras(disk, [JSON.stringify(captured.file)])).toBe('saved');
    expect(disk.entries.get(SAVE_KEY)).toBe(before);
    expect(restoreWorld(disk.entries.get(SAVE_KEY)!)).toEqual(world);
    expect(JSON.parse(disk.entries.get(KEPT_ERAS_KEY)!)).toMatchObject({
      format: KEPT_ERAS_FORMAT,
      formatRevision: 1,
    });
  });

  it('loads an empty shelf, migrates a raw array of era files, and rejects later revisions', () => {
    const captured = captureFile(5, 1, 'kept-1');
    const encoded = JSON.stringify(captured.file);
    expect(parseKeptEraStore('')).toEqual({ eras: [], files: [] });
    expect(parseKeptEraStore('')).toEqual(readKeptEras(memoryStorage()));
    const migrated = parseKeptEraStore(JSON.stringify([encoded]));
    expect(migrated).not.toBeNull();
    expect(migrated!.eras).toHaveLength(1);
    expect(migrated!.eras[0].id).toBe('kept-1');
    expect(migrated!.files).toEqual([encoded]);
    const current = parseKeptEraStore(encodeKeptEraStore([encoded]));
    expect(current).toEqual(migrated);
    expect(
      parseKeptEraStore(JSON.stringify({ format: KEPT_ERAS_FORMAT, formatRevision: 2, files: [encoded] })),
    ).toBeNull();
    expect(parseKeptEraStore('{')).toBeNull();
    expect(readKeptEras(memoryStorage(new Map([[KEPT_ERAS_KEY, '{']])))).toEqual({
      eras: [],
      files: [],
    });
  });

  it('counts kept eras toward the eight-era and 4 MB catalog with the reviewed shelf', () => {
    const { file } = captureFile(8, 1, 'kept-base');
    const extras = Array.from({ length: 5 }, (_, index) => JSON.stringify({ ...file, id: `kept-${index + 1}` }));
    expect(extras).toHaveLength(5);
    expect(namedEras().length + extras.length).toBe(MAX_NAMED_ERAS);
    const loaded = parseKeptEraStore(encodeKeptEraStore(extras));
    expect(loaded).not.toBeNull();
    expect(loaded!.eras).toHaveLength(5);
    expect(shelfRoom(extras)).toBe('ok');
    const overCount = [...extras, JSON.stringify({ ...file, id: 'kept-6' })];
    expect(parseKeptEraStore(encodeKeptEraStore(overCount))).toBeNull();
    expect(shelfRoom(overCount)).toBe('full-count');
    expect(parseKeptEraStore(encodeKeptEraStore([JSON.stringify({ ...file, id: 'an-hour-unwatched' })]))).toBeNull();
    expect(
      parseKeptEraStore(encodeKeptEraStore([encodedForBytes()]), {
        ids: new Set(),
        bytes: MAX_ERA_CATALOG_BYTES - 10,
        count: 0,
      }),
    ).toBeNull();
    expect(shelfRoom([], 'x'.repeat(MAX_ERA_CATALOG_BYTES - eraCatalogBytes() + 1))).toBe('full-bytes');
  });

  it('lets a visitor add and remove their own eras, not the reviewed ones', () => {
    const live = createWorld(11);
    for (let step = 0; step < 30; step++) stepWorld(live);
    const captured = keepLiveEra(live, nextKeptEraId([...namedEras()]))!;
    const encoded = JSON.stringify(captured.file);
    const added = addKeptEra({ eras: [], files: [] }, captured.era, encoded);
    expect(added.room).toBe('ok');
    expect(added.shelf.eras).toHaveLength(1);
    expect(isReviewedEraId('an-hour-unwatched')).toBe(true);
    expect(isReviewedEraId(captured.era.id)).toBe(false);
    expect(removeKeptEra(added.shelf, 'an-hour-unwatched')).toBeNull();
    const removed = removeKeptEra(added.shelf, captured.era.id);
    expect(removed).toEqual({ eras: [], files: [] });
    expect(eraById('an-hour-unwatched')).not.toBeNull();
  });

  it('opens a kept era through the ordinary importer without gifts, catch-up, or traces, and holds the live save', () => {
    const live = createWorld(21);
    for (let step = 0; step < 90; step++) stepWorld(live);
    live.lastSeenAt = 1_700_000_000_000;
    live.awayTraces = composeAwayTraces({
      formedAt: live.elapsed,
      extinctions: [],
      seamReleased: 0,
      deepDelta: 0.5,
      inletDelta: 0,
      inletBodiesDelta: 0,
      channelOccupied: false,
    });
    live.shoreMemory = [{ formedAt: live.elapsed, kinds: ['seam'] }];
    const before = serializeWorld(live);
    const captured = keepLiveEra(live, 'kept-1')!;
    expect(serializeWorld(live)).toBe(before);
    const session = new WorldSession(live);
    const disk = memoryStorage();
    disk.setItem(SAVE_KEY, before);
    const frozen = captured.era.snapshot;
    const controls = { paused: false, tool: 'light', selectedId: 3 };
    const beforeOpen = Date.now();
    expect(session.enterEra(frozen, controls, disk)).toBe('saved');
    expect(session.previewKind).toBe('era');
    expect(session.world.elapsed).toBe(captured.era.world.elapsed);
    expect(session.world.organisms).toHaveLength(captured.era.world.organisms.length);
    expect(session.world.awayTraces).toEqual([]);
    expect(session.world.shoreMemory).toEqual([]);
    expect(session.world.lastSeenAt).toBeGreaterThanOrEqual(beforeOpen);
    expect(planCatchUp(session.world.lastSeenAt, Date.now())).toMatchObject({
      reason: 'too-small',
      simulateSeconds: 0,
    });
    expect(session.save(disk)).toBe('preview');
    expect(disk.entries.get(SAVE_KEY)).toBe(before);
    stepWorld(session.world);
    expect(session.returnToPool()).toBe(controls);
    expect(session.world).toBe(live);
    expect(serializeWorld(session.world)).toBe(before);
    expect(session.world.randomState).toBe(JSON.parse(before).randomState);
    expect(session.world.awayTraces).toHaveLength(1);
    expect(session.world.shoreMemory).toHaveLength(1);
    expect(parseEraFile(JSON.stringify(captured.file))!.world.awayTraces).toEqual([]);
  });
});

function encodedForBytes(): string {
  const { file } = captureFile(8, 1, 'kept-bytes');
  return JSON.stringify(file);
}
