import { describe, expect, it } from 'vitest';
import { StirController } from '../src/app/stir';
import { createWorld } from '../src/world/simulation';
import { restoreWorld, serializeWorld } from '../src/world/persistence';

describe('Stir gestures', () => {
  it('keeps previews ephemeral and rejects taps, cancellations and cross-world commits', () => {
    const world = createWorld(42),
      before = serializeWorld(world),
      stir = new StirController();
    expect(stir.begin(world, { x: 0, y: 0 }, 'pointer')).toBe(false);
    stir.begin(world, { x: 720, y: 500 }, 'pointer');
    expect(stir.commit(world).status).toBe('invalid');
    stir.begin(world, { x: 720, y: 500 }, 'keyboard');
    stir.update({ x: 840, y: 500 });
    expect(serializeWorld(world)).toBe(before);
    stir.cancel();
    expect(stir.commit(world).status).toBe('invalid');
    stir.begin(world, { x: 720, y: 500 }, 'pointer');
    stir.update({ x: 840, y: 500 });
    const other = createWorld(43),
      otherBefore = serializeWorld(other);
    expect(stir.commit(other).status).toBe('invalid');
    expect(serializeWorld(world)).toBe(before);
    expect(serializeWorld(other)).toBe(otherBefore);
  });
  it('commits once while paused and preserves a mid-current snapshot', () => {
    const world = createWorld(44),
      stir = new StirController();
    stir.begin(world, { x: 720, y: 500 }, 'keyboard');
    stir.update({ x: 816, y: 500 });
    expect(stir.commit(world).status).toBe('applied');
    expect(world.elapsed).toBe(0);
    expect(world.currents).toHaveLength(1);
    expect(stir.state).toBe(null);
    expect(stir.commit(world).status).toBe('invalid');
    expect(restoreWorld(serializeWorld(world))).toEqual(world);
  });
});
