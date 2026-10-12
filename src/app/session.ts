import { createWorld } from '../world/simulation';
import { restoreWorld, serializeWorld } from '../world/persistence';
import type { World } from '../world/types';
import { createShowerStudy } from './study';

export const SAVE_KEY = 'elsewhere:tidepool:v1';
export type SaveResult = 'saved' | 'unavailable' | 'preview';
export interface SaveStorage { setItem(key: string, value: string): void }

/** The only autosave boundary. A study never becomes the personal world. */
export class WorldSession<Controls> {
  world: World;
  revision = 0;
  private retained: { world: World; controls: Controls } | null = null;
  constructor(world: World) { this.world = world; }
  get preview(): boolean { return this.retained !== null; }
  save(storage: SaveStorage): SaveResult {
    if (this.preview) return 'preview';
    try { storage.setItem(SAVE_KEY, serializeWorld(this.world)); return 'saved'; }
    catch { return 'unavailable'; }
  }
  enterStudy(controls: Controls, storage: SaveStorage): SaveResult {
    if (this.preview) return 'preview';
    // Validate before checkpointing or changing identity.
    const study = createShowerStudy();
    const result = this.save(storage);
    this.retained = { world: this.world, controls };
    this.world = study;
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
    this.world = this.preview ? createShowerStudy() : createWorld(this.world.seed);
    this.revision++;
  }
  /** Capture before an asynchronous file read; reject stale reads after any transition. */
  importToken(): number | null { return this.preview ? null : this.revision; }
  importSnapshot(snapshot: string, token: number | null): 'imported' | 'stale' | 'invalid' {
    if (this.preview || token === null || token !== this.revision) return 'stale';
    const restored = restoreWorld(snapshot);
    if (!restored) return 'invalid';
    this.world = restored;
    this.revision++;
    return 'imported';
  }
}
