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
    intensity: raining ? Math.min(ease((phase - RAIN_START) / FADE_SECONDS), ease((RAIN_END - phase) / FADE_SECONDS)) : 0,
    raining,
    secondsUntilChange: raining ? RAIN_END - phase : phase < RAIN_START ? RAIN_START - phase : CYCLE_SECONDS - phase + RAIN_START,
  };
}

export function getLightReach(elapsed: number): number {
  return CALM_LIGHT_REACH + RAIN_LIGHT_EXTENSION * getWeather(elapsed).intensity;
}
