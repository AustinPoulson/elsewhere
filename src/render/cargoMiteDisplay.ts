import type { CargoMite, Point, World } from '../world/types';
import { confinePosition } from '../world/geometry';

/** Keep an attached mite visible on its host's rim, with a matching Observe target. */
export function cargoMiteDisplayPoint(world: World, mite: CargoMite): Point {
  if (mite.mode !== 'attached' || mite.hostId === null) return mite;
  const host = world.grazers.find((grazer) => grazer.id === mite.hostId);
  if (!host) return mite;
  const attached = world.cargoMites
    .filter((other) => other.mode === 'attached' && other.hostId === host.id)
    .sort((a, b) => a.id - b.id);
  const side = attached.findIndex((other) => other.id === mite.id) === 1 ? -1 : 1;
  const angle = Math.atan2(host.vy, host.vx);
  const radius = host.size * 1.75 + 7;
  const display = {
    x: host.x - Math.sin(angle) * radius * side,
    y: host.y + Math.cos(angle) * radius * side,
  };
  confinePosition(display, 2);
  return display;
}
