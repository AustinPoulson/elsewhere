export const WORLD_DAY_SECONDS = 360;
export const YEAR_DAYS = 6;
export const YEAR_SECONDS = WORLD_DAY_SECONDS * YEAR_DAYS;
export const SEASON_SECONDS = YEAR_SECONDS / 4;
export const BASE_RAIN_SPAN = 38;
export const SEASON_NAMES = ['spring', 'summer', 'autumn', 'winter'] as const;
export type SeasonName = (typeof SEASON_NAMES)[number];

export const SEASON_LABEL: Record<SeasonName, string> = {
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  winter: 'Winter',
};

export const SEASON_NOTE: Record<SeasonName, string> = {
  spring: "Days lengthen toward summer's start.",
  summer: 'Brightest at the start, then easing; rain is brief.',
  autumn: "Days shorten toward winter's start.",
  winter: 'Dimmest at the start, then easing; rain stays longer.',
};

function assertTime(elapsed: number): void {
  if (!Number.isFinite(elapsed) || elapsed < 0) throw new RangeError('Season time must be finite and nonnegative.');
}

function signed(value: number): number {
  return value === 0 ? 0 : value;
}

function summerAxis(elapsed: number): number {
  return signed(Math.sin((elapsed / YEAR_SECONDS) * Math.PI * 2));
}

function wrapYear(elapsed: number): number {
  return elapsed % YEAR_SECONDS;
}

export function dayStrengthAt(elapsed: number): number {
  assertTime(elapsed);
  return signed(1 + 0.2 * summerAxis(elapsed));
}

export function nightBiasAt(elapsed: number): number {
  assertTime(elapsed);
  return signed(-0.16 * summerAxis(elapsed));
}

export function rainSpanAt(elapsed: number): number {
  assertTime(elapsed);
  return signed(BASE_RAIN_SPAN - 14 * summerAxis(elapsed));
}

export function channelScaleAt(elapsed: number): number {
  assertTime(elapsed);
  return signed(1 - 0.18 * summerAxis(elapsed));
}

export function seasonIndex(elapsed: number): number {
  assertTime(elapsed);
  return Math.min(3, Math.floor((wrapYear(elapsed) / YEAR_SECONDS) * 4));
}

export function seasonName(elapsed: number): SeasonName {
  return SEASON_NAMES[seasonIndex(elapsed)];
}

export function seasonLabel(elapsed: number): string {
  return SEASON_LABEL[seasonName(elapsed)];
}

export function describeSeasonChange(startedAt: number, endedAt: number): string | null {
  assertTime(startedAt);
  assertTime(endedAt);
  if (endedAt <= startedAt) return null;
  const from = seasonName(startedAt);
  const to = seasonName(endedAt);
  if (from !== to) return `The shore passed from ${from} into ${to}.`;
  if (endedAt - startedAt >= SEASON_SECONDS) return `A year turned while you were gone. It is ${to} again.`;
  return null;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function packRgb(r: number, g: number, b: number): number {
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

function hexRgb(r: number, g: number, b: number): string {
  return `#${packRgb(r, g, b).toString(16).padStart(6, '0')}`;
}

const CAUSTIC_RGB: ReadonlyArray<readonly [number, number, number]> = [
  [123, 183, 156],
  [156, 191, 122],
  [181, 165, 106],
  [106, 168, 176],
];

const WASH_RGB: ReadonlyArray<readonly [number, number, number]> = [
  [86, 138, 116],
  [126, 150, 78],
  [140, 118, 72],
  [68, 118, 138],
];

const BACKDROP_MID: ReadonlyArray<readonly [number, number, number]> = [
  [21, 48, 43],
  [26, 53, 36],
  [28, 46, 34],
  [18, 46, 50],
];

const BACKDROP_EDGE: ReadonlyArray<readonly [number, number, number]> = [
  [8, 24, 23],
  [10, 26, 18],
  [12, 22, 16],
  [6, 22, 28],
];

function mixPalette(
  palette: ReadonlyArray<readonly [number, number, number]>,
  elapsed: number,
): [number, number, number] {
  const slot = (wrapYear(elapsed) / YEAR_SECONDS) * 4;
  const index = Math.min(3, Math.floor(slot));
  const next = (index + 1) % 4;
  const t = slot - index;
  const a = palette[index];
  const b = palette[next];
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

export function seasonCausticColor(elapsed: number): number {
  assertTime(elapsed);
  const [r, g, b] = mixPalette(CAUSTIC_RGB, elapsed);
  return packRgb(r, g, b);
}

export function seasonWashColor(elapsed: number): number {
  assertTime(elapsed);
  const [r, g, b] = mixPalette(WASH_RGB, elapsed);
  return packRgb(r, g, b);
}

export function getSeason(elapsed: number): {
  name: SeasonName;
  label: string;
  note: string;
  mid: string;
  edge: string;
} {
  const name = seasonName(elapsed);
  const mid = mixPalette(BACKDROP_MID, elapsed);
  const edge = mixPalette(BACKDROP_EDGE, elapsed);
  return {
    name,
    label: SEASON_LABEL[name],
    note: SEASON_NOTE[name],
    mid: hexRgb(mid[0], mid[1], mid[2]),
    edge: hexRgb(edge[0], edge[1], edge[2]),
  };
}
