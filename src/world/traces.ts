import { DEEP_BASIN } from './environment/depth';
import { MINERAL_SEAM } from './environment/mineral-seam';
import { INLET_POOL, channelSegment, confineToWater, inInletPool, inOpeningPool } from './habitat';
import { isInPool, type AwayTrace, type AwayTraceKind, type Point, type ShoreMemory, type World } from './types';

export const TRACE_MARK_CAP = 5;
export const TRACE_POOL_MARGIN = 24;
export const TRACE_EXTINCTION_CAP = 2;
export const TRACE_EXTINCTION_RECORD_CAP = 16;
export const TRACE_FADE_SECONDS = 8 * 60;
export const TRACE_SETTLE_THRESHOLD = 0.2;
export const TRACE_MEMORY_CAP = 4;
export const TRACE_KINDS: readonly AwayTraceKind[] = ['extinction', 'deep', 'seam', 'inlet', 'channel'];

export type { AwayTrace, AwayTraceKind, ShoreMemory };

export interface ExtinctionMark extends Point {
  species: string;
  at: number;
  hue: number;
}

export interface AwayTraceFacts {
  formedAt: number;
  extinctions: readonly ExtinctionMark[];
  seamReleased: number;
  deepDelta: number;
  inletDelta: number;
  inletBodiesDelta: number;
  channelOccupied: boolean;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function inNeck(x: number, y: number): boolean {
  return isInPool(x, y) && !inOpeningPool(x, y) && !inInletPool(x, y);
}

export function colorInInlet(world: Pick<World, 'sediment' | 'remains'>): number {
  let total = 0;
  for (const grain of world.sediment) {
    if (inInletPool(grain.x, grain.y)) total += grain.strength;
  }
  for (const remain of world.remains) {
    if (inInletPool(remain.x, remain.y)) total += remain.pigment;
  }
  return total;
}

export function livingPoints(world: World): Point[] {
  return [
    ...world.organisms,
    ...world.grazers,
    ...world.skimmers,
    ...world.reedwells,
    ...world.rainbells,
    ...world.siltstitchers,
    ...world.glassLimpets,
    ...world.cargoMites,
    ...world.marlgrubs,
  ];
}

export function livingInInlet(world: World): number {
  let count = 0;
  for (const body of livingPoints(world)) {
    if (inInletPool(body.x, body.y)) count += 1;
  }
  return count;
}

export function channelOccupied(world: World): boolean {
  for (const body of livingPoints(world)) {
    if (inNeck(body.x, body.y)) return true;
  }
  for (const grain of world.sediment) {
    if (inNeck(grain.x, grain.y)) return true;
  }
  for (const remain of world.remains) {
    if (inNeck(remain.x, remain.y)) return true;
  }
  for (const fossil of world.fossils) {
    if (inNeck(fossil.x, fossil.y)) return true;
  }
  return false;
}

function mark(
  kind: AwayTraceKind,
  x: number,
  y: number,
  hue: number,
  strength: number,
  formedAt: number,
  extra?: Pick<AwayTrace, 'x2' | 'y2'>,
): AwayTrace {
  return {
    kind,
    x,
    y,
    hue,
    strength: clamp01(strength),
    formedAt,
    ...extra,
  };
}

export function placeAwayTracePoint(x: number, y: number): Point | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const point = { x, y };
  if (isInPool(point.x, point.y, TRACE_POOL_MARGIN)) return point;
  if (!isInPool(point.x, point.y, 0)) return null;
  confineToWater(point, TRACE_POOL_MARGIN);
  if (!isInPool(point.x, point.y, TRACE_POOL_MARGIN)) return null;
  return point;
}

export function placeAwayTrace(trace: AwayTrace): AwayTrace | null {
  const start = placeAwayTracePoint(trace.x, trace.y);
  if (!start) return null;
  if (trace.kind === 'channel' || trace.kind === 'seam') {
    if (trace.x2 === undefined || trace.y2 === undefined) return null;
    const end = placeAwayTracePoint(trace.x2, trace.y2);
    if (!end) return null;
    return { ...trace, x: start.x, y: start.y, x2: end.x, y2: end.y };
  }
  return { ...trace, x: start.x, y: start.y };
}

export function composeAwayTraces(facts: AwayTraceFacts): AwayTrace[] {
  if (!Number.isFinite(facts.formedAt) || facts.formedAt < 0) return [];
  const traces: AwayTrace[] = [];
  const recent: ExtinctionMark[] = [];
  const seen = new Set<string>();
  const sorted = [...facts.extinctions]
    .filter((entry) => Number.isFinite(entry.at) && Number.isFinite(entry.x) && Number.isFinite(entry.y))
    .sort((a, b) => b.at - a.at);
  for (const ended of sorted) {
    if (seen.has(ended.species)) continue;
    seen.add(ended.species);
    recent.push(ended);
    if (recent.length >= TRACE_EXTINCTION_CAP) break;
  }
  for (const ended of recent) {
    const placed = placeAwayTracePoint(ended.x, ended.y);
    if (!placed) continue;
    traces.push(mark('extinction', placed.x, placed.y, ended.hue, 0.58, facts.formedAt));
  }
  const drifted = facts.channelOccupied || facts.inletDelta >= TRACE_SETTLE_THRESHOLD || facts.inletBodiesDelta > 0;
  if (drifted && traces.length < TRACE_MARK_CAP) {
    const path = channelSegment();
    traces.push(
      mark('channel', path.ax, path.ay, 168, 0.42, facts.formedAt, {
        x2: path.bx,
        y2: path.by,
      }),
    );
  }
  if (facts.deepDelta >= TRACE_SETTLE_THRESHOLD && traces.length < TRACE_MARK_CAP) {
    traces.push(mark('deep', DEEP_BASIN.x, DEEP_BASIN.y, 198, 0.28 + clamp01(facts.deepDelta) * 0.32, facts.formedAt));
  }
  if (facts.seamReleased >= TRACE_SETTLE_THRESHOLD && traces.length < TRACE_MARK_CAP) {
    traces.push(
      mark(
        'seam',
        MINERAL_SEAM.ax,
        MINERAL_SEAM.ay,
        MINERAL_SEAM.hue,
        0.3 + clamp01(facts.seamReleased / 4) * 0.28,
        facts.formedAt,
        { x2: MINERAL_SEAM.bx, y2: MINERAL_SEAM.by },
      ),
    );
  }
  if (facts.inletDelta >= TRACE_SETTLE_THRESHOLD && traces.length < TRACE_MARK_CAP) {
    traces.push(mark('inlet', INLET_POOL.x, INLET_POOL.y, 164, 0.28 + clamp01(facts.inletDelta) * 0.3, facts.formedAt));
  }
  return traces.slice(0, TRACE_MARK_CAP);
}

export function traceStrength(trace: AwayTrace, elapsed: number): number {
  if (!Number.isFinite(elapsed)) return 0;
  const age = elapsed - trace.formedAt;
  if (age < 0) return trace.strength;
  const remain = 1 - Math.min(1, age / TRACE_FADE_SECONDS);
  return trace.strength * remain;
}

export function visibleAwayTraces(traces: readonly AwayTrace[], elapsed: number): AwayTrace[] {
  const visible: AwayTrace[] = [];
  for (const trace of traces) {
    if (visible.length >= TRACE_MARK_CAP) break;
    if (traceStrength(trace, elapsed) > 0.02) visible.push(trace);
  }
  return visible;
}

export function describeAwayTraces(traces: readonly AwayTrace[]): string | null {
  if (traces.length === 0) return null;
  const kinds = new Set(traces.map((trace) => trace.kind));
  const ended = kinds.has('extinction');
  const settled = kinds.has('deep') || kinds.has('seam') || kinds.has('inlet');
  const drifted = kinds.has('channel');
  if (ended && (settled || drifted)) {
    return 'The shore kept faint marks of that time: where a lineage ended, and where color moved.';
  }
  if (ended) {
    return traces.filter((trace) => trace.kind === 'extinction').length === 1
      ? 'A faint mark remains where that lineage ended.'
      : 'Faint marks remain where lineages ended.';
  }
  if (drifted && settled) return 'A faded path still shows along the channel, and color left a stain.';
  if (drifted) return 'A faded path still shows along the channel.';
  return 'The shore kept a faint stain of color that settled while you were gone.';
}

export function isAwayTraceKind(value: unknown): value is AwayTraceKind {
  return value === 'extinction' || value === 'deep' || value === 'seam' || value === 'inlet' || value === 'channel';
}

function uniqueKinds(kinds: readonly AwayTraceKind[]): AwayTraceKind[] {
  const seen = new Set<AwayTraceKind>();
  const ordered: AwayTraceKind[] = [];
  for (const kind of TRACE_KINDS) {
    if (!kinds.includes(kind) || seen.has(kind)) continue;
    seen.add(kind);
    ordered.push(kind);
  }
  return ordered.slice(0, TRACE_MARK_CAP);
}

export function memoryFromTraces(traces: readonly AwayTrace[]): ShoreMemory[] {
  const byTime = new Map<number, AwayTraceKind[]>();
  const order: number[] = [];
  for (const trace of traces) {
    const existing = byTime.get(trace.formedAt);
    if (existing) existing.push(trace.kind);
    else {
      byTime.set(trace.formedAt, [trace.kind]);
      order.push(trace.formedAt);
    }
  }
  return order
    .map((formedAt) => ({ formedAt, kinds: uniqueKinds(byTime.get(formedAt) ?? []) }))
    .filter((entry) => entry.kinds.length > 0);
}

export function keepShoreMemory(memory: readonly ShoreMemory[], traces: readonly AwayTrace[]): ShoreMemory[] {
  const next = memory.map((entry) => ({ formedAt: entry.formedAt, kinds: uniqueKinds(entry.kinds) }));
  for (const entry of memoryFromTraces(traces)) {
    const last = next[next.length - 1];
    if (last && last.formedAt === entry.formedAt) {
      next[next.length - 1] = { formedAt: last.formedAt, kinds: uniqueKinds([...last.kinds, ...entry.kinds]) };
    } else next.push(entry);
  }
  return next.slice(-TRACE_MEMORY_CAP);
}

export function holdTracesAcrossCatchUp(traces: readonly AwayTrace[], elapsedDelta: number): AwayTrace[] {
  if (!Number.isFinite(elapsedDelta) || elapsedDelta <= 0) return traces.map((trace) => ({ ...trace }));
  return traces.map((trace) => ({ ...trace, formedAt: trace.formedAt + elapsedDelta }));
}

export function settleAwayTraces(
  traces: readonly AwayTrace[],
  memory: readonly ShoreMemory[],
  elapsed: number,
): { traces: AwayTrace[]; memory: ShoreMemory[] } {
  const visible = visibleAwayTraces(traces, elapsed);
  const faded = traces.filter((trace) => traceStrength(trace, elapsed) <= 0.02);
  return {
    traces: visible.slice(0, TRACE_MARK_CAP),
    memory: faded.length === 0 ? memory.slice(-TRACE_MEMORY_CAP) : keepShoreMemory(memory, faded),
  };
}

export function recordAwayTraces(
  current: readonly AwayTrace[],
  memory: readonly ShoreMemory[],
  nextTraces: readonly AwayTrace[],
  elapsed: number,
): { traces: AwayTrace[]; memory: ShoreMemory[] } {
  if (nextTraces.length === 0) return settleAwayTraces(current, memory, elapsed);
  const archived = current.length > 0 ? keepShoreMemory(memory, current) : memory.slice(-TRACE_MEMORY_CAP);
  return settleAwayTraces(nextTraces, archived, elapsed);
}

export function forgetAwayTraces(world: Pick<World, 'awayTraces' | 'shoreMemory'>): void {
  world.awayTraces = [];
  world.shoreMemory = [];
}

export function withoutAwayMemory(world: World): World {
  return { ...world, awayTraces: [], shoreMemory: [] };
}

export function describeShoreMemory(memory: readonly ShoreMemory[]): string | null {
  if (memory.length === 0) return null;
  if (memory.length > 1) return 'The shore still remembers a few earlier returns.';
  const kinds = new Set(memory[0].kinds);
  const ended = kinds.has('extinction');
  const settled = kinds.has('deep') || kinds.has('seam') || kinds.has('inlet');
  const drifted = kinds.has('channel');
  if (ended && (settled || drifted)) {
    return 'The shore still remembers an earlier return: a lineage ending, and color that moved.';
  }
  if (ended) return 'The shore still remembers where a lineage ended.';
  if (drifted && settled) return 'The notes still mention a faded path, and a stain from an earlier return.';
  if (drifted) return 'The notes still mention a faded path from an earlier return.';
  return 'The shore still remembers a stain from an earlier return.';
}
