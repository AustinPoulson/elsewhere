import { createWorld } from '../world/simulation';
import { restoreWorld, serializeWorld } from '../world/persistence';
import { forgetAwayTraces } from '../world/traces';
import type { World } from '../world/types';
import { createShowerStudy } from './study';

export const SAVE_KEY = 'elsewhere:tidepool:v1';
export type SaveResult = 'saved' | 'unavailable' | 'preview';
export type PreviewKind = 'study' | 'era';
export interface SaveStorage {
  setItem(key: string, value: string): void;
}

/** The only autosave boundary. A study or era visit never becomes the personal world. */
export class WorldSession<Controls> {
  world: World;
  revision = 0;
  private retained: { world: World; controls: Controls; kind: PreviewKind; eraSnapshot: string | null } | null = null;
  constructor(world: World) {
    this.world = world;
  }
  get preview(): boolean {
    return this.retained !== null;
  }
  get previewKind(): PreviewKind | null {
    return this.retained?.kind ?? null;
  }
  save(storage: SaveStorage): SaveResult {
    if (this.preview) return 'preview';
    try {
      storage.setItem(SAVE_KEY, serializeWorld(this.world));
      return 'saved';
    } catch {
      return 'unavailable';
    }
  }
  enterStudy(controls: Controls, storage: SaveStorage): SaveResult {
    if (this.preview) return 'preview';
    const study = createShowerStudy();
    const result = this.save(storage);
    this.retained = { world: this.world, controls, kind: 'study', eraSnapshot: null };
    this.world = study;
    this.revision++;
    return result;
  }
  enterEra(snapshot: string, controls: Controls, storage: SaveStorage): SaveResult | 'invalid' {
    if (this.preview) return 'preview';
    const restored = restoreWorld(snapshot);
    if (!restored) return 'invalid';
    restored.lastSeenAt = Date.now();
    forgetAwayTraces(restored);
    const result = this.save(storage);
    this.retained = { world: this.world, controls, kind: 'era', eraSnapshot: snapshot };
    this.world = restored;
    this.revision++;
    return result;
  }
  returnToPool(): Controls | null {
    if (!this.retained) return null;
    const { world, controls } = this.retained;
    this.world = world;
    this.retained = null;
    this.revision++;
    return controls;
  }
  reset(): void {
    if (this.retained?.kind === 'era' && this.retained.eraSnapshot) {
      const restored = restoreWorld(this.retained.eraSnapshot);
      if (restored) {
        restored.lastSeenAt = Date.now();
        forgetAwayTraces(restored);
        this.world = restored;
        this.revision++;
        return;
      }
    }
    this.world = this.preview ? createShowerStudy() : createWorld(this.world.seed);
    this.revision++;
  }
  /** Capture before an asynchronous file read; reject stale reads after any transition. */
  importToken(): number | null {
    return this.preview ? null : this.revision;
  }
  importSnapshot(snapshot: string, token: number | null): 'imported' | 'stale' | 'invalid' {
    if (this.preview || token === null || token !== this.revision) return 'stale';
    const restored = restoreWorld(snapshot);
    if (!restored) return 'invalid';
    restored.lastSeenAt = Date.now();
    forgetAwayTraces(restored);
    this.world = restored;
    this.revision++;
    return 'imported';
  }
}
