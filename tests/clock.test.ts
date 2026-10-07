import { describe, expect, it } from 'vitest';
import { SimulationClock } from '../src/app/clock';
import { FIXED_STEP } from '../src/world/types';

describe('simulation clock', () => {
  it('produces equal simulation time at different display frame rates', () => {
    for (const fps of [30, 60, 120]) {
      const clock = new SimulationClock();
      let ticks = 0;
      for (let frame = 0; frame < fps * 10; frame++) clock.advance(1 / fps, () => ticks++);
      expect(ticks).toBe(300);
    }
  });
  it('bounds catchup after a long frame', () => {
    const clock = new SimulationClock();
    expect(clock.advance(100, () => {})).toBe(5);
    expect(clock.advance(FIXED_STEP, () => {})).toBe(1);
  });
  it('drops partial elapsed time on pause', () => {
    const clock = new SimulationClock();
    clock.advance(FIXED_STEP / 2, () => {});
    clock.reset();
    expect(clock.advance(FIXED_STEP / 2, () => {})).toBe(0);
  });
  it('ignores invalid timing', () => {
    const clock = new SimulationClock();
    for (const dt of [NaN, Infinity, -1, 0]) expect(clock.advance(dt, () => {})).toBe(0);
  });
});
