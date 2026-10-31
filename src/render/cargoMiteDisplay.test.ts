import { describe, expect, it } from 'vitest';
import { cargoMiteDisplayPoint } from './cargoMiteDisplay';
import { confinePosition } from '../world/geometry';
import { createWorld } from '../world/simulation';
import { isInPool } from '../world/types';

describe('attached cargo mite display', () => {
  it('keeps the shared rendered and observable point inside the coast at a tangential host edge', () => {
    const world = createWorld(28);
    const host = world.grazers[0];
    host.x = 1500;
    host.y = 500;
    host.vx = 0;
    host.vy = -8;
    confinePosition(host, host.size + 3);
    world.cargoMites.push({
      id: world.nextId++,
      species: 'cargoMite',
      x: host.x,
      y: host.y,
      vx: host.vx,
      vy: host.vy,
      body: 0.1,
      reserve: 0.4,
      age: 0,
      hue: host.hue,
      starvedFor: 0,
      mode: 'attached',
      hostId: host.id,
      targetHostId: null,
      parentId: null,
      nextBirthAt: 30,
    });
    const point = cargoMiteDisplayPoint(world, world.cargoMites[0]);
    expect(isInPool(point.x, point.y, 2)).toBe(true);
    expect(Math.hypot(point.x - host.x, point.y - host.y)).toBeGreaterThan(0);
  });
});
