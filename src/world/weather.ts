import { depthAt, rainScale } from './environment/depth';
import { rainSpanAt } from './environment/seasons';
import type { Point, World } from './types';

export interface Weather {
  intensity: number;
  raining: boolean;
  secondsUntilChange: number;
}

export const CALM_LIGHT_REACH = 64;
const RAIN_LIGHT_EXTENSION = 48;
const CYCLE_SECONDS = 180;
const RAIN_MID = 49;
const FADE_SECONDS = 6;
export const CALLED_RAIN_SECONDS = 30;
export const RAIN_CALL_COOLDOWN = 60;

export type RainCallResult = { status: 'called' | 'cooldown'; secondsRemaining: number };
export interface EffectiveWeather extends Weather {
  called: boolean;
  callCooldown: number;
}

function ease(value: number): number {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

function rainWindow(elapsed: number): { start: number; end: number } {
  const half = rainSpanAt(elapsed) / 2;
  return { start: RAIN_MID - half, end: RAIN_MID + half };
}

export function getWeather(elapsed: number): Weather {
  if (!Number.isFinite(elapsed) || elapsed < 0) throw new RangeError('Weather time must be finite and nonnegative.');
  const cycleStart = Math.floor(elapsed / CYCLE_SECONDS) * CYCLE_SECONDS;
  const phase = elapsed - cycleStart;
  const window = rainWindow(cycleStart);
  const raining = phase >= window.start && phase < window.end;
  return {
    intensity: raining
      ? Math.min(ease((phase - window.start) / FADE_SECONDS), ease((window.end - phase) / FADE_SECONDS))
      : 0,
    raining,
    secondsUntilChange: raining
      ? window.end - phase
      : phase < window.start
        ? window.start - phase
        : CYCLE_SECONDS - phase + rainWindow(cycleStart + CYCLE_SECONDS).start,
  };
}

export function getLightReach(elapsed: number): number {
  return CALM_LIGHT_REACH + RAIN_LIGHT_EXTENSION * getWeather(elapsed).intensity;
}

// This touch changes only weather state: no time, resources, IDs or random draws.
export function callRain(world: World): RainCallResult {
  const remaining = Math.max(0, world.weatherCall.nextAllowedAt - world.elapsed);
  if (remaining > 0) return { status: 'cooldown', secondsRemaining: remaining };
  if (world.elapsed > Number.MAX_SAFE_INTEGER - RAIN_CALL_COOLDOWN) {
    return { status: 'cooldown', secondsRemaining: RAIN_CALL_COOLDOWN };
  }
  world.weatherCall = { startedAt: world.elapsed, nextAllowedAt: world.elapsed + RAIN_CALL_COOLDOWN };
  return { status: 'called', secondsRemaining: RAIN_CALL_COOLDOWN };
}

export function effectiveWeather(world: World): EffectiveWeather {
  const natural = getWeather(world.elapsed);
  const age = world.weatherCall.startedAt === null ? Infinity : world.elapsed - world.weatherCall.startedAt;
  const called = age >= 0 && age < CALLED_RAIN_SECONDS;
  const intensity = called ? Math.min(ease(age / FADE_SECONDS), ease((CALLED_RAIN_SECONDS - age) / FADE_SECONDS)) : 0;
  return {
    intensity: Math.max(natural.intensity, intensity),
    raining: natural.raining || called,
    secondsUntilChange: called ? CALLED_RAIN_SECONDS - age : natural.secondsUntilChange,
    called,
    callCooldown: Math.max(0, world.weatherCall.nextAllowedAt - world.elapsed),
  };
}

export function effectiveLightReach(world: World): number {
  return CALM_LIGHT_REACH + RAIN_LIGHT_EXTENSION * effectiveWeather(world).intensity;
}

export function rainIntensityAt(world: World, x: number, y: number): number {
  return effectiveWeather(world).intensity * rainScale(depthAt(x, y));
}

export function lightReachAt(world: World, point: Point): number {
  return CALM_LIGHT_REACH + RAIN_LIGHT_EXTENSION * rainIntensityAt(world, point.x, point.y);
}
