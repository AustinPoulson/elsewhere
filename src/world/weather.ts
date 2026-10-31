import type { World } from './types';

export interface Weather {
  intensity: number;
  raining: boolean;
  secondsUntilChange: number;
}

export const CALM_LIGHT_REACH = 64;
const RAIN_LIGHT_EXTENSION = 48;
const CYCLE_SECONDS = 180;
const RAIN_START = 30;
const RAIN_END = 68;
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

// Weather belongs to simulated time, so pause and restored saves keep its phase.
export function getWeather(elapsed: number): Weather {
  if (!Number.isFinite(elapsed) || elapsed < 0) throw new RangeError('Weather time must be finite and nonnegative.');
  const phase = elapsed % CYCLE_SECONDS;
  const raining = phase >= RAIN_START && phase < RAIN_END;
  return {
    intensity: raining
      ? Math.min(ease((phase - RAIN_START) / FADE_SECONDS), ease((RAIN_END - phase) / FADE_SECONDS))
      : 0,
    raining,
    secondsUntilChange: raining
      ? RAIN_END - phase
      : phase < RAIN_START
        ? RAIN_START - phase
        : CYCLE_SECONDS - phase + RAIN_START,
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
