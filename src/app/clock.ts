import { FIXED_STEP } from '../world/types';

/** Pauses reset this clock; long frames never replay a hidden tab's history. */
export class SimulationClock {
  private accumulator = 0;
  advance(seconds: number, update: (dt: number) => void): number {
    if (!Number.isFinite(seconds) || seconds <= 0) return 0;
    this.accumulator += Math.min(seconds, FIXED_STEP * 5);
    let steps = 0;
    while (this.accumulator + 1e-10 >= FIXED_STEP && steps < 5) {
      update(FIXED_STEP);
      this.accumulator = Math.max(0, this.accumulator - FIXED_STEP);
      steps++;
    }
    return steps;
  }
  reset(): void { this.accumulator = 0; }
}
