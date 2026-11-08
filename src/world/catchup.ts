import { describeSeasonChange } from './environment/seasons';
import { heldFossilPigment } from './species/fossils';
import { heldRemainPigment } from './species/remains';
import { stepWorld } from './simulation';
import { FIXED_STEP, type World } from './types';

export const CATCH_UP_MAX_SECONDS = 8 * 3600;
export const CATCH_UP_MIN_SECONDS = 30;
export const CATCH_UP_JOURNAL_SECONDS = 10 * 60;
export const CATCH_UP_CHUNK_MS = 12;
export const CATCH_UP_PROGRESS_MS = 250;
export const CATCH_UP_JOURNAL_CAP = 12;

export type CatchUpReason = 'ready' | 'missing' | 'backwards' | 'too-small';

export interface CatchUpPlan {
  reason: CatchUpReason;
  awaySeconds: number;
  simulateSeconds: number;
  sleptSeconds: number;
}

export type CensusSpecies =
  | 'lucents'
  | 'grazers'
  | 'skimmers'
  | 'reedwells'
  | 'rainbells'
  | 'siltstitchers'
  | 'glassLimpets'
  | 'cargoMites'
  | 'marlgrubs';

export interface SpeciesEvents {
  births: number;
  deaths: number;
  extinctAt: number | null;
}

export type CatchUpEvents = Record<CensusSpecies, SpeciesEvents>;

export interface ResourceSnapshot {
  loosePigment: number;
  nestedPigment: number;
  remainPigment: number;
  fossilPigment: number;
  fossils: number;
}

export interface CatchUpJournal {
  awaySeconds: number;
  simulatedSeconds: number;
  sleptSeconds: number;
  lines: string[];
}

export interface CatchUpReport {
  plan: CatchUpPlan;
  steps: number;
  events: CatchUpEvents;
  before: ResourceSnapshot;
  after: ResourceSnapshot;
  journal: CatchUpJournal;
}

const SPECIES: CensusSpecies[] = [
  'lucents',
  'grazers',
  'skimmers',
  'reedwells',
  'rainbells',
  'siltstitchers',
  'glassLimpets',
  'cargoMites',
  'marlgrubs',
];

const SPECIES_LABEL: Record<CensusSpecies, { singular: string; plural: string }> = {
  lucents: { singular: 'lucent', plural: 'lucents' },
  grazers: { singular: 'pigment grazer', plural: 'pigment grazers' },
  skimmers: { singular: 'skimmer', plural: 'skimmers' },
  reedwells: { singular: 'reedwell', plural: 'reedwells' },
  rainbells: { singular: 'rainbell', plural: 'rainbells' },
  siltstitchers: { singular: 'siltstitcher', plural: 'siltstitchers' },
  glassLimpets: { singular: 'glass limpet', plural: 'glass limpets' },
  cargoMites: { singular: 'cargo mite', plural: 'cargo mites' },
  marlgrubs: { singular: 'marlgrub', plural: 'marlgrubs' },
};

const SMALL_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

function emptyEvents(): CatchUpEvents {
  return {
    lucents: { births: 0, deaths: 0, extinctAt: null },
    grazers: { births: 0, deaths: 0, extinctAt: null },
    skimmers: { births: 0, deaths: 0, extinctAt: null },
    reedwells: { births: 0, deaths: 0, extinctAt: null },
    rainbells: { births: 0, deaths: 0, extinctAt: null },
    siltstitchers: { births: 0, deaths: 0, extinctAt: null },
    glassLimpets: { births: 0, deaths: 0, extinctAt: null },
    cargoMites: { births: 0, deaths: 0, extinctAt: null },
    marlgrubs: { births: 0, deaths: 0, extinctAt: null },
  };
}

export function populationCounts(world: World): Record<CensusSpecies, number> {
  return {
    lucents: world.organisms.length,
    grazers: world.grazers.length,
    skimmers: world.skimmers.length,
    reedwells: world.reedwells.length,
    rainbells: world.rainbells.length,
    siltstitchers: world.siltstitchers.length,
    glassLimpets: world.glassLimpets.length,
    cargoMites: world.cargoMites.length,
    marlgrubs: world.marlgrubs.length,
  };
}

export function resourceSnapshot(world: World): ResourceSnapshot {
  return {
    loosePigment: world.sediment.reduce((total, grain) => total + grain.strength, 0),
    nestedPigment: world.nests.reduce((total, nest) => total + nest.pigment, 0),
    remainPigment: heldRemainPigment(world),
    fossilPigment: heldFossilPigment(world),
    fossils: world.fossils.length,
  };
}

export function remainsLedgerBalanced(world: World): boolean {
  return (
    Math.abs(
      world.ecologyLedger.remainsCreated -
        (heldRemainPigment(world) + world.ecologyLedger.remainsConsumed + world.ecologyLedger.remainsDecayed),
    ) < 1e-6
  );
}

export function planCatchUp(lastSeenAt: number | null | undefined, now: number): CatchUpPlan {
  const idle: CatchUpPlan = { reason: 'missing', awaySeconds: 0, simulateSeconds: 0, sleptSeconds: 0 };
  if (!Number.isFinite(now) || now < 0) return idle;
  if (lastSeenAt == null || !Number.isFinite(lastSeenAt) || lastSeenAt < 0) return idle;
  const gapMs = now - lastSeenAt;
  if (gapMs < 0) return { reason: 'backwards', awaySeconds: 0, simulateSeconds: 0, sleptSeconds: 0 };
  const awaySeconds = gapMs / 1000;
  if (awaySeconds < CATCH_UP_MIN_SECONDS) {
    return { reason: 'too-small', awaySeconds, simulateSeconds: 0, sleptSeconds: 0 };
  }
  const simulateSeconds = Math.min(awaySeconds, CATCH_UP_MAX_SECONDS);
  return {
    reason: 'ready',
    awaySeconds,
    simulateSeconds,
    sleptSeconds: Math.max(0, awaySeconds - simulateSeconds),
  };
}

export function catchUpHasExtinction(events: CatchUpEvents): boolean {
  return SPECIES.some((species) => events[species].extinctAt !== null);
}

export function shouldPresentJournal(plan: CatchUpPlan, events: CatchUpEvents): boolean {
  if (plan.reason !== 'ready') return false;
  return plan.awaySeconds >= CATCH_UP_JOURNAL_SECONDS || catchUpHasExtinction(events);
}

export function catchUpShouldShowProgress(elapsedMs: number, done: number, total: number): boolean {
  return elapsedMs > CATCH_UP_PROGRESS_MS && done < total;
}

export function quantityWord(value: number): string {
  const n = Math.round(value);
  if (n >= 0 && n < SMALL_WORDS.length) return SMALL_WORDS[n];
  return String(n);
}

export function describeSpan(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return 'a short while';
  if (seconds < 90) return 'about a minute';
  if (seconds < 45 * 60) {
    const minutes = Math.max(2, Math.round(seconds / 60));
    return `about ${quantityWord(minutes)} minutes`;
  }
  if (seconds < 36 * 3600) {
    const hours = Math.max(1, Math.round(seconds / 3600));
    return hours === 1 ? 'about an hour' : `about ${quantityWord(hours)} hours`;
  }
  if (seconds < 365 * 86400) {
    const days = Math.max(1, Math.round(seconds / 86400));
    return days === 1 ? 'about a day' : `about ${quantityWord(days)} days`;
  }
  const years = Math.max(1, Math.round(seconds / (365.25 * 86400)));
  return years === 1 ? 'about a year' : `about ${quantityWord(years)} years`;
}

function countPhrase(count: number, singular: string): string {
  return `${quantityWord(count)} ${count === 1 ? singular : `${singular}s`}`;
}

function noteEvents(
  events: CatchUpEvents,
  previous: Record<CensusSpecies, number>,
  world: World,
): Record<CensusSpecies, number> {
  const counts = populationCounts(world);
  for (const species of SPECIES) {
    const delta = counts[species] - previous[species];
    if (delta > 0) {
      events[species].births += delta;
      events[species].extinctAt = null;
    } else if (delta < 0) {
      events[species].deaths += -delta;
    }
    if (counts[species] === 0 && previous[species] > 0) {
      events[species].extinctAt = world.elapsed;
    }
  }
  return counts;
}

export function composeJournal(
  plan: CatchUpPlan,
  events: CatchUpEvents,
  before: ResourceSnapshot,
  after: ResourceSnapshot,
  nowElapsed: number,
): CatchUpJournal {
  const lines: string[] = [];
  if (plan.reason === 'ready') {
    lines.push(`You were away for ${describeSpan(plan.awaySeconds)}.`);
    if (plan.sleptSeconds >= CATCH_UP_MIN_SECONDS) {
      lines.push(`The pool lived through ${describeSpan(plan.simulateSeconds)} of that time. The rest, it slept.`);
    }
    const startedAt = Math.max(0, nowElapsed - plan.simulateSeconds);
    const seasonLine = describeSeasonChange(startedAt, nowElapsed);
    if (seasonLine) lines.push(seasonLine);
  }

  for (const species of SPECIES) {
    const event = events[species];
    if (event.extinctAt !== null) {
      const ago = Math.max(0, nowElapsed - event.extinctAt);
      lines.push(`The last ${SPECIES_LABEL[species].singular} died ${describeSpan(ago)} ago.`);
    }
  }

  for (const species of SPECIES) {
    if (species === 'lucents' || species === 'grazers') continue;
    const event = events[species];
    if (event.extinctAt !== null) continue;
    if (event.births === 0 && event.deaths === 0) continue;
    const label = SPECIES_LABEL[species];
    if (event.births > 0 && event.deaths > 0) {
      lines.push(
        `${label.plural.charAt(0).toUpperCase()}${label.plural.slice(1)} kept turning over: ${countPhrase(event.births, 'birth')}, ${countPhrase(event.deaths, 'death')}.`,
      );
    } else if (event.births > 0) {
      lines.push(
        `${label.plural.charAt(0).toUpperCase()}${label.plural.slice(1)} arrived: ${countPhrase(event.births, 'birth')}.`,
      );
    } else {
      lines.push(
        `${label.plural.charAt(0).toUpperCase()}${label.plural.slice(1)} faded: ${countPhrase(event.deaths, 'death')}.`,
      );
    }
  }

  const nestedDelta = after.nestedPigment - before.nestedPigment;
  if (Math.abs(nestedDelta) >= 0.4) {
    lines.push(nestedDelta < 0 ? 'Nested color thinned while you were gone.' : 'Nests gathered more color.');
  }
  const looseDelta = after.loosePigment - before.loosePigment;
  if (Math.abs(looseDelta) >= 0.4) {
    lines.push(looseDelta < 0 ? 'Loose pigment on the floor grew quieter.' : 'Loose pigment spread across the floor.');
  }
  const remainDelta = after.remainPigment - before.remainPigment;
  if (Math.abs(remainDelta) >= 0.2) {
    lines.push(remainDelta > 0 ? 'Death left more remains on the floor.' : 'Remains faded or were eaten.');
  }
  if (after.fossils > before.fossils || after.fossilPigment - before.fossilPigment >= 0.04) {
    lines.push('Old sediment kept an impression of a lineage that ended.');
  }

  if (lines.length <= (plan.reason === 'ready' ? 1 : 0) + (plan.sleptSeconds >= CATCH_UP_MIN_SECONDS ? 1 : 0)) {
    lines.push('The water kept its own counsel. Little changed that I could name.');
  }

  return {
    awaySeconds: plan.awaySeconds,
    simulatedSeconds: plan.simulateSeconds,
    sleptSeconds: plan.sleptSeconds,
    lines: lines.slice(0, CATCH_UP_JOURNAL_CAP),
  };
}

function simulateCatchUp(
  world: World,
  plan: CatchUpPlan,
  onStep?: (done: number, total: number) => void,
): CatchUpReport {
  const before = resourceSnapshot(world);
  const events = emptyEvents();
  const total = plan.reason === 'ready' ? Math.ceil(plan.simulateSeconds / FIXED_STEP) : 0;
  let previous = populationCounts(world);
  for (let step = 0; step < total; step++) {
    stepWorld(world);
    previous = noteEvents(events, previous, world);
    onStep?.(step + 1, total);
  }
  const after = resourceSnapshot(world);
  return {
    plan,
    steps: total,
    events,
    before,
    after,
    journal: composeJournal(plan, events, before, after, world.elapsed),
  };
}

export function catchUpWorld(world: World, plan: CatchUpPlan): CatchUpReport {
  return simulateCatchUp(world, plan);
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
}

export async function catchUpWorldChunked(
  world: World,
  plan: CatchUpPlan,
  options?: {
    now?: () => number;
    yieldToMain?: () => Promise<void>;
    onProgress?: (done: number, total: number) => void;
    chunkMs?: number;
  },
): Promise<CatchUpReport> {
  const before = resourceSnapshot(world);
  const events = emptyEvents();
  const total = plan.reason === 'ready' ? Math.ceil(plan.simulateSeconds / FIXED_STEP) : 0;
  const clock = options?.now ?? (() => performance.now());
  const pause = options?.yieldToMain ?? yieldToMain;
  const chunkMs = options?.chunkMs ?? CATCH_UP_CHUNK_MS;
  let previous = populationCounts(world);
  let step = 0;
  while (step < total) {
    const sliceStart = clock();
    while (step < total && clock() - sliceStart < chunkMs) {
      stepWorld(world);
      step++;
      previous = noteEvents(events, previous, world);
    }
    options?.onProgress?.(step, total);
    if (step < total) await pause();
  }
  const after = resourceSnapshot(world);
  return {
    plan,
    steps: total,
    events,
    before,
    after,
    journal: composeJournal(plan, events, before, after, world.elapsed),
  };
}
