import { WORLD_HEIGHT, WORLD_WIDTH, type Point } from '../world/types';

export interface HabitatCamera {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

/** The same habitat turns toward a portrait screen; simulation coordinates stay fixed. */
export function fitHabitatCamera(width: number, height: number): HabitatCamera {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const portrait = safeWidth / safeHeight < 0.8;
  return {
    x: safeWidth / 2,
    y: safeHeight * (portrait ? 0.51 : 0.5),
    scale: portrait
      ? Math.min(safeWidth / WORLD_HEIGHT, safeHeight / WORLD_WIDTH)
      : Math.min(safeWidth / WORLD_WIDTH, safeHeight / WORLD_HEIGHT),
    rotation: portrait ? Math.PI / 2 : 0,
  };
}

export function viewportToWorld(camera: HabitatCamera, point: Point): Point {
  const x = (point.x - camera.x) / camera.scale;
  const y = (point.y - camera.y) / camera.scale;
  const cos = Math.cos(camera.rotation);
  const sin = Math.sin(camera.rotation);
  return {
    x: WORLD_WIDTH / 2 + x * cos + y * sin,
    y: WORLD_HEIGHT / 2 - x * sin + y * cos,
  };
}
