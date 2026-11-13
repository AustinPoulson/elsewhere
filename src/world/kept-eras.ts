import { eraCatalogBytes, isReviewedEraId, namedEras } from './era-catalog';
import { MAX_ERA_CATALOG_BYTES, MAX_NAMED_ERAS, parseEraFile, type NamedEra } from './eras';

export const KEPT_ERAS_KEY = 'elsewhere:kept-eras:v1';
export const KEPT_ERAS_FORMAT = 'elsewhere-kept-eras';
export const KEPT_ERAS_FORMAT_REVISION = 1;

export interface KeptEraStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface KeptEraShelf {
  eras: NamedEra[];
  files: string[];
}

export type ShelfRoom = 'ok' | 'full-count' | 'full-bytes';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function emptyKeptEraShelf(): KeptEraShelf {
  return { eras: [], files: [] };
}

export function encodeKeptEraStore(files: readonly string[]): string {
  return JSON.stringify({
    format: KEPT_ERAS_FORMAT,
    formatRevision: KEPT_ERAS_FORMAT_REVISION,
    files: [...files],
  });
}

export function parseKeptEraStore(
  input: string,
  reviewed: { ids: ReadonlySet<string>; bytes: number; count: number } = reviewedBudget(),
): KeptEraShelf | null {
  if (typeof input !== 'string' || input.length === 0) return emptyKeptEraShelf();
  let parsed: unknown;
  try {
    parsed = JSON.parse(input) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
  const files = filesFromStore(parsed);
  if (!files) return null;
  if (reviewed.count + files.length > MAX_NAMED_ERAS) return null;
  let total = reviewed.bytes;
  const eras: NamedEra[] = [];
  const ids = new Set<string>();
  for (const file of files) {
    if (typeof file !== 'string') return null;
    total += file.length;
    if (total > MAX_ERA_CATALOG_BYTES) return null;
    const era = parseEraFile(file);
    if (!era || ids.has(era.id) || reviewed.ids.has(era.id)) return null;
    ids.add(era.id);
    eras.push(era);
  }
  return { eras, files };
}

export function readKeptEras(storage: KeptEraStorage): KeptEraShelf {
  try {
    const raw = storage.getItem(KEPT_ERAS_KEY);
    if (raw == null || raw === '') return emptyKeptEraShelf();
    return parseKeptEraStore(raw) ?? emptyKeptEraShelf();
  } catch {
    return emptyKeptEraShelf();
  }
}

export function writeKeptEras(storage: KeptEraStorage, files: readonly string[]): 'saved' | 'unavailable' {
  try {
    storage.setItem(KEPT_ERAS_KEY, encodeKeptEraStore(files));
    return 'saved';
  } catch {
    return 'unavailable';
  }
}

export function nextKeptEraId(existing: readonly { id: string }[]): string {
  const used = new Set(existing.map((era) => era.id));
  let n = 1;
  while (used.has(`kept-${n}`)) n += 1;
  return `kept-${n}`;
}

export function shelfRoom(keptFiles: readonly string[], nextFile?: string): ShelfRoom {
  const files = nextFile === undefined ? keptFiles : [...keptFiles, nextFile];
  if (namedEras().length + files.length > MAX_NAMED_ERAS) return 'full-count';
  let total = eraCatalogBytes();
  for (const file of files) {
    total += file.length;
    if (total > MAX_ERA_CATALOG_BYTES) return 'full-bytes';
  }
  return 'ok';
}

export function removeKeptEra(shelf: KeptEraShelf, id: string): KeptEraShelf | null {
  if (isReviewedEraId(id)) return null;
  const index = shelf.eras.findIndex((era) => era.id === id);
  if (index < 0) return null;
  return {
    eras: shelf.eras.filter((_, item) => item !== index),
    files: shelf.files.filter((_, item) => item !== index),
  };
}

export function addKeptEra(
  shelf: KeptEraShelf,
  era: NamedEra,
  encoded: string,
): { shelf: KeptEraShelf; room: ShelfRoom } {
  const room = shelfRoom(shelf.files, encoded);
  if (room !== 'ok') return { shelf, room };
  if (shelf.eras.some((item) => item.id === era.id) || isReviewedEraId(era.id)) {
    return { shelf, room: 'full-count' };
  }
  return {
    shelf: {
      eras: [...shelf.eras, era],
      files: [...shelf.files, encoded],
    },
    room: 'ok',
  };
}

function reviewedBudget(): { ids: ReadonlySet<string>; bytes: number; count: number } {
  return {
    ids: new Set(namedEras().map((era) => era.id)),
    bytes: eraCatalogBytes(),
    count: namedEras().length,
  };
}

function filesFromStore(parsed: unknown): string[] | null {
  if (Array.isArray(parsed)) {
    if (!parsed.every((entry) => typeof entry === 'string')) return null;
    return parsed;
  }
  if (
    !record(parsed) ||
    parsed.format !== KEPT_ERAS_FORMAT ||
    parsed.formatRevision !== KEPT_ERAS_FORMAT_REVISION ||
    !Array.isArray(parsed.files)
  ) {
    return null;
  }
  if (!parsed.files.every((entry) => typeof entry === 'string')) return null;
  return parsed.files;
}
