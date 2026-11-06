import { OPENING_HEIGHT, OPENING_WIDTH, WORLD_HEIGHT, WORLD_WIDTH, type Point } from '../world/types';
import { OPENING_POOL } from '../world/habitat';

export const MIN_ZOOM = 0.84;
export const MAX_ZOOM = 1.28;

export interface HabitatCamera {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  lookX: number;
  lookY: number;
}

export interface CameraView {
  lookX: number;
  lookY: number;
  zoom: number;
}

export function openingView(): CameraView {
  return { lookX: OPENING_POOL.x, lookY: OPENING_POOL.y, zoom: 1 };
}

export function fitScale(width: number, height: number): { scale: number; portrait: boolean } {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const portrait = safeWidth / safeHeight < 0.8;
  return {
    portrait,
    scale: portrait
      ? Math.min(safeWidth / OPENING_HEIGHT, safeHeight / OPENING_WIDTH)
      : Math.min(safeWidth / OPENING_WIDTH, safeHeight / OPENING_HEIGHT),
  };
}

export function fitHabitatCamera(width: number, height: number, view: CameraView = openingView()): HabitatCamera {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const fitted = fitScale(safeWidth, safeHeight);
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom));
  return {
    x: safeWidth / 2,
    y: safeHeight * (fitted.portrait ? 0.51 : 0.5),
    scale: fitted.scale * zoom,
    rotation: fitted.portrait ? Math.PI / 2 : 0,
    lookX: view.lookX,
    lookY: view.lookY,
  };
}

export function clampCameraView(width: number, height: number, view: CameraView): CameraView {
  const camera = fitHabitatCamera(width, height, view);
  const portrait = camera.rotation !== 0;
  const viewWidth = (portrait ? height : width) / camera.scale;
  const viewHeight = (portrait ? width : height) / camera.scale;
  const minX = viewWidth / 2;
  const maxX = WORLD_WIDTH - viewWidth / 2;
  const minY = viewHeight / 2;
  const maxY = WORLD_HEIGHT - viewHeight / 2;
  return {
    zoom: camera.scale / fitScale(width, height).scale,
    lookX: minX > maxX ? WORLD_WIDTH / 2 : Math.min(maxX, Math.max(minX, view.lookX)),
    lookY: minY > maxY ? WORLD_HEIGHT / 2 : Math.min(maxY, Math.max(minY, view.lookY)),
  };
}

export function viewportToWorld(camera: HabitatCamera, point: Point): Point {
  const x = (point.x - camera.x) / camera.scale;
  const y = (point.y - camera.y) / camera.scale;
  const cos = Math.cos(camera.rotation);
  const sin = Math.sin(camera.rotation);
  return {
    x: camera.lookX + x * cos + y * sin,
    y: camera.lookY - x * sin + y * cos,
  };
}
