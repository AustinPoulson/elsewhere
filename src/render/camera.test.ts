import { describe, expect, it } from 'vitest';
import { fitHabitatCamera, viewportToWorld } from './camera';

describe('habitat camera', () => {
  it('keeps the desktop view centered without rotating it', () => {
    const camera = fitHabitatCamera(1280, 720);
    expect(camera).toEqual({ x: 640, y: 360, scale: 0.72, rotation: 0 });
    expect(viewportToWorld(camera, { x: 640, y: 360 })).toEqual({ x: 720, y: 500 });
    const left = viewportToWorld(camera, { x: 200.8, y: 360 });
    expect(left.x).toBeCloseTo(110);
    expect(left.y).toBeCloseTo(500);
  });

  it('turns toward a portrait screen and maps input back to the original axes', () => {
    const camera = fitHabitatCamera(390, 844);
    expect(camera.scale).toBe(0.39);
    expect(camera.rotation).toBe(Math.PI / 2);
    const center = viewportToWorld(camera, { x: 195, y: 430.44 });
    expect(center.x).toBeCloseTo(720);
    expect(center.y).toBeCloseTo(500);

    // The world north shore lies to the right after clockwise rotation.
    const north = viewportToWorld(camera, { x: 351, y: 430.44 });
    expect(north.x).toBeCloseTo(720);
    expect(north.y).toBeCloseTo(100);
    // The world west shore lies above the screen center.
    const west = viewportToWorld(camera, { x: 195, y: 192.54 });
    expect(west.x).toBeCloseTo(110);
    expect(west.y).toBeCloseTo(500);
  });

  it('keeps coordinates finite while a host is temporarily collapsed', () => {
    const camera = fitHabitatCamera(0, 0);
    expect(Number.isFinite(camera.scale)).toBe(true);
    const point = viewportToWorld(camera, { x: camera.x, y: camera.y });
    expect(point).toEqual({ x: 720, y: 500 });
  });
});
