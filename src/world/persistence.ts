import {
  GRAZER_CAPACITY,
  LIMITS,
  NEST_CAPACITY,
  isInPool,
  poolRadius,
  type Current,
  type Grazer,
  type LightSource,
  type Nest,
  type Organism,
  type Sediment,
  type Skimmer,
  type Reedwell,
  type Rainbell,
  type Siltstitcher,
  type GlassLimpet,
  type CargoMite,
  type EcologyLedger,
  type World,
} from './types';
import { initializeGrazers } from './simulation';
import { RAIN_CALL_COOLDOWN } from './weather';
import { CURRENT_DURATION, CURRENT_RADIUS, MAX_CURRENTS, currentStrength } from './actions/current';
import {
  CARGO_MITE_CAP,
  GLASS_LIMPET_CAP,
  NEW_TYPE_POPULATION_CAP,
  RAINBELL_CAP,
  REEDWELL_CAP,
  SILTSTITCHER_CAP,
  SKIMMER_CAP,
  SPECIES_CATALOG,
} from './species/catalog';

const MAX_SAVE_LENGTH = 1_000_000;
const MAX_NUMBER = Number.MAX_SAFE_INTEGER;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function range(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function integer(value: unknown, min = 0, max = MAX_NUMBER): value is number {
  return range(value, min, max) && Number.isSafeInteger(value);
}

function point(value: unknown, margin = 0): value is Record<string, unknown> & { x: number; y: number } {
  return (
    record(value) &&
    range(value.x, -10000, 10000) &&
    range(value.y, -10000, 10000) &&
    isInPool(value.x, value.y, margin)
  );
}

function organism(value: unknown): boolean {
  if (!record(value) || !range(value.size, 1, 24) || !point(value, value.size + 3)) return false;
  return (
    integer(value.id, 1) &&
    value.species === 'lucent' &&
    range(value.vx, -200, 200) &&
    range(value.vy, -200, 200) &&
    range(value.energy, 0.12, 2) &&
    range(value.age, 0, MAX_NUMBER) &&
    range(value.hue, 0, 360) &&
    value.hue < 360 &&
    range(value.phase, 0, Math.PI * 2) &&
    Array.isArray(value.trail) &&
    value.trail.length <= LIMITS.trail &&
    value.trail.every((entry: unknown) => point(entry))
  );
}

function light(value: unknown): boolean {
  return (
    point(value) &&
    integer(value.id, 1) &&
    range(value.initialEnergy, 0.001, 300) &&
    range(value.energy, 0, value.initialEnergy) &&
    range(value.age, 0, MAX_NUMBER)
  );
}

function sediment(value: unknown): boolean {
  return (
    point(value) &&
    integer(value.id, 1) &&
    range(value.radius, 0.1, 32) &&
    range(value.hue, 0, 360) &&
    value.hue < 360 &&
    range(value.strength, 0.001, 1) &&
    range(value.age, 0, MAX_NUMBER)
  );
}

function grazer(value: unknown): boolean {
  if (!record(value) || !range(value.size, 1, 24) || !point(value, value.size + 3)) return false;
  return (
    integer(value.id, 1) &&
    value.species === 'grazer' &&
    range(value.vx, -80, 80) &&
    range(value.vy, -80, 80) &&
    range(value.age, 0, MAX_NUMBER) &&
    range(value.phase, 0, Math.PI * 2) &&
    range(value.hue, 0, 360) &&
    value.hue < 360 &&
    range(value.cargo, 0, GRAZER_CAPACITY) &&
    integer(value.nestId, 1) &&
    typeof value.returning === 'boolean' &&
    (!value.returning || value.cargo > 0) &&
    (value.cargo < GRAZER_CAPACITY || value.returning)
  );
}

function nest(value: unknown): boolean {
  return (
    point(value, 18) &&
    integer(value.id, 1) &&
    range(value.hue, 0, 360) &&
    value.hue < 360 &&
    range(value.pigment, 0, NEST_CAPACITY) &&
    range(value.age, 0, MAX_NUMBER)
  );
}

function weatherCall(value: unknown, elapsed: number): value is World['weatherCall'] {
  if (!record(value) || !range(value.nextAllowedAt, 0, MAX_NUMBER)) return false;
  if (value.startedAt === null) return value.nextAllowedAt === 0;
  return (
    range(value.startedAt, 0, Math.min(elapsed, MAX_NUMBER - RAIN_CALL_COOLDOWN)) &&
    value.nextAllowedAt === value.startedAt + RAIN_CALL_COOLDOWN
  );
}

function current(value: unknown, elapsed: number): boolean {
  return (
    point(value) &&
    integer(value.id, 1) &&
    range(value.dx, -1, 1) &&
    range(value.dy, -1, 1) &&
    Math.abs(Math.hypot(value.dx, value.dy) - 1) < 1e-9 &&
    value.radius === CURRENT_RADIUS &&
    value.duration === CURRENT_DURATION &&
    range(value.startedAt, 0, Math.min(elapsed, MAX_NUMBER - CURRENT_DURATION))
  );
}

function skimmer(value: unknown, elapsed: number, nextId: number): boolean {
  return (
    point(value, 11) &&
    integer(value.id, 1) &&
    value.species === 'skimmer' &&
    value.size === 8 &&
    value.body === 0.2 &&
    range(value.vx, -80, 80) &&
    range(value.vy, -80, 80) &&
    range(value.hue, 0, 360) &&
    value.hue < 360 &&
    range(value.reserve, 0, 1) &&
    range(value.age, 0, MAX_NUMBER) &&
    range(value.phase, 0, Math.PI * 2) &&
    integer(value.homeNestId, 1) &&
    (value.targetSedimentId === null || integer(value.targetSedimentId, 1, nextId - 1)) &&
    range(value.starvedFor, 0, 60) &&
    range(value.emissionNextAllowedAt, 0, Math.min(MAX_NUMBER, elapsed + 15)) &&
    (value.lastEmissionAt === null
      ? (value.emissionNextAllowedAt as number) <= elapsed
      : range(value.lastEmissionAt, 0, elapsed) && value.emissionNextAllowedAt === value.lastEmissionAt + 15)
  );
}

const PRISM_LEDGER_KEYS = [
  'mineralizedPigment',
  'maintenancePigment',
  'emittedLight',
  'pigmentConverted',
  'feedingCreditLost',
] as const;
const REEDWELL_LEDGER_KEYS = [
  'daylightHarvested',
  'daylightUnharvested',
  'reedwellEmittedLight',
  'reedwellDissipatedLight',
] as const;
const RAINBELL_LEDGER_KEYS = ['rainbellIntake', 'rainbellPumpingPigment', 'rainbellMaintenancePigment'] as const;
const SILTSTITCHER_LEDGER_KEYS = [
  'siltstitcherNestReserve',
  'siltstitcherNestCargo',
  'siltstitcherOutwardPigment',
  'siltstitcherMaintenancePigment',
] as const;
const GLASS_LIMPET_LEDGER_KEYS = ['glassLimpetIntake', 'glassLimpetMaintenancePigment'] as const;
const CARGO_MITE_LEDGER_KEYS = ['cargoMiteIntake', 'cargoMiteMaintenancePigment'] as const;

function ledger(
  value: unknown,
  reedwells: boolean,
  rainbells: boolean,
  siltstitchers: boolean,
  glassLimpets: boolean,
  cargoMites: boolean,
): boolean {
  return (
    record(value) &&
    PRISM_LEDGER_KEYS.every((key) => range(value[key], 0, MAX_NUMBER)) &&
    (reedwells
      ? REEDWELL_LEDGER_KEYS.every((key) => range(value[key], 0, MAX_NUMBER))
      : REEDWELL_LEDGER_KEYS.every((key) => !(key in value))) &&
    (rainbells
      ? RAINBELL_LEDGER_KEYS.every((key) => range(value[key], 0, MAX_NUMBER))
      : RAINBELL_LEDGER_KEYS.every((key) => !(key in value))) &&
    (siltstitchers
      ? SILTSTITCHER_LEDGER_KEYS.every((key) => range(value[key], 0, MAX_NUMBER))
      : SILTSTITCHER_LEDGER_KEYS.every((key) => !(key in value))) &&
    (glassLimpets
      ? GLASS_LIMPET_LEDGER_KEYS.every((key) => range(value[key], 0, MAX_NUMBER))
      : GLASS_LIMPET_LEDGER_KEYS.every((key) => !(key in value))) &&
    (cargoMites
      ? CARGO_MITE_LEDGER_KEYS.every((key) => range(value[key], 0, MAX_NUMBER))
      : CARGO_MITE_LEDGER_KEYS.every((key) => !(key in value)))
  );
}

function reedwell(value: unknown, elapsed: number): boolean {
  const policy = SPECIES_CATALOG.reedwell;
  return (
    point(value, policy.margin) &&
    integer(value.id, 1) &&
    value.species === 'reedwell' &&
    value.body === policy.bodyPigment &&
    range(value.age, 0, policy.lifespan) &&
    range(value.hue, 0, 360) &&
    value.hue < 360 &&
    range(value.lightStore, 0, policy.lightCapacity) &&
    range(value.emissionNextAllowedAt, 0, Math.min(MAX_NUMBER, elapsed + policy.emissionRest)) &&
    (value.lastEmissionAt === null
      ? (value.emissionNextAllowedAt as number) <= elapsed
      : range(value.lastEmissionAt, 0, elapsed) &&
        value.emissionNextAllowedAt === value.lastEmissionAt + policy.emissionRest)
  );
}

function rainbell(value: unknown, elapsed: number, nextId: number): boolean {
  const policy = SPECIES_CATALOG.rainbell;
  return (
    point(value, policy.margin) &&
    integer(value.id, 1) &&
    value.species === 'rainbell' &&
    value.body === policy.bodyPigment &&
    range(value.age, 0, policy.lifespan) &&
    range(value.hue, 0, 360) &&
    value.hue < 360 &&
    range(value.reserve, 0, policy.reserveCapacity) &&
    range(value.starvedFor, 0, policy.starvationLimit) &&
    (value.feedTargetSedimentId === null || integer(value.feedTargetSedimentId, 1, nextId - 1)) &&
    (value.pumpTargetSedimentId === null || integer(value.pumpTargetSedimentId, 1, nextId - 1)) &&
    range(value.pulseNextAllowedAt, 0, Math.min(MAX_NUMBER, elapsed + policy.pulseRest)) &&
    (value.lastPulseAt === null
      ? (value.pulseNextAllowedAt as number) <= elapsed
      : range(value.lastPulseAt, 0, elapsed) && value.pulseNextAllowedAt === value.lastPulseAt + policy.pulseRest)
  );
}

function siltstitcher(value: unknown, nextId: number): boolean {
  const policy = SPECIES_CATALOG.siltstitcher;
  if (
    !point(value, policy.margin) ||
    !integer(value.id, 1) ||
    value.species !== 'siltstitcher' ||
    value.body !== policy.bodyPigment ||
    !range(value.age, 0, policy.lifespan) ||
    !range(value.vx, -policy.speed, policy.speed) ||
    !range(value.vy, -policy.speed, policy.speed) ||
    Math.hypot(value.vx, value.vy) > policy.speed + 1e-9 ||
    !range(value.hue, 0, 360) ||
    value.hue >= 360 ||
    !range(value.reserve, 0, policy.reserveCapacity) ||
    !range(value.cargo, 0, policy.cargoCapacity) ||
    !range(value.starvedFor, 0, policy.starvationLimit) ||
    !range(value.blockedFor, 0, policy.blockedLimit) ||
    !integer(value.homeNestId, 1, nextId - 1)
  )
    return false;
  if (value.mode === 'home' || value.mode === 'returning') return value.destination === null && value.blockedFor === 0;
  return (
    ((value.mode === 'outbound' && value.blockedFor === 0) || value.mode === 'blocked') &&
    value.cargo >= policy.minimumPartialCargo &&
    point(value.destination, policy.margin)
  );
}

function glassLimpet(value: unknown, nextId: number): boolean {
  const policy = SPECIES_CATALOG.glassLimpet;
  if (
    !point(value, policy.margin) ||
    !integer(value.id, 1) ||
    value.species !== 'glassLimpet' ||
    value.body !== policy.bodyPigment ||
    !range(value.age, 0, policy.lifespan) ||
    !range(value.hue, 0, 360) ||
    value.hue >= 360 ||
    !range(value.reserve, 0, policy.reserveCapacity) ||
    !range(value.cargo, 0, policy.cargoCapacity) ||
    !range(value.starvedFor, 0, policy.starvationLimit) ||
    (value.targetSedimentId !== null && !integer(value.targetSedimentId, 1, nextId - 1))
  )
    return false;
  const nx = (value.x - 720) / 610;
  const ny = (value.y - 500) / 400;
  const rho = Math.hypot(nx, ny) / poolRadius(Math.atan2(ny, nx));
  return range(rho, policy.shoreMin, policy.shoreMax);
}

function cargoMite(value: unknown, elapsed: number, nextId: number): boolean {
  const policy = SPECIES_CATALOG.cargoMite;
  const birthAt = elapsed - (record(value) && typeof value.age === 'number' ? value.age : 0);
  if (
    !point(value, 0) ||
    !integer(value.id, 1) ||
    value.species !== 'cargoMite' ||
    value.body !== policy.bodyPigment ||
    !range(value.age, 0, policy.lifespan) ||
    value.age > elapsed + 1e-6 ||
    !range(value.vx, -80, 80) ||
    !range(value.vy, -80, 80) ||
    !range(value.hue, 0, 360) ||
    value.hue >= 360 ||
    !range(value.reserve, 0, policy.reserveCapacity) ||
    !range(value.starvedFor, 0, policy.starvationLimit) ||
    (value.parentId !== null && !integer(value.parentId, 1, (value.id as number) - 1)) ||
    !range(value.nextBirthAt, 0, Math.min(MAX_NUMBER, elapsed + policy.breedingRest)) ||
    value.nextBirthAt < birthAt + policy.maturityAge - 1e-6 ||
    (value.age < policy.maturityAge - 1e-6 && Math.abs(value.nextBirthAt - (birthAt + policy.maturityAge)) > 1e-6)
  )
    return false;
  if (value.mode === 'attached') return integer(value.hostId, 1, nextId - 1) && value.targetHostId === null;
  return (
    value.mode === 'seeking' &&
    point(value, policy.margin) &&
    value.hostId === null &&
    Math.hypot(value.vx, value.vy) <= policy.speed + 1e-9 &&
    (value.targetHostId === null || integer(value.targetHostId, 1, nextId - 1))
  );
}

type PrePrismOrganism = Omit<Organism, 'pigmentCredit'>;
type Revision7Ledger = Omit<EcologyLedger, (typeof CARGO_MITE_LEDGER_KEYS)[number]>;
type Revision6Ledger = Omit<Revision7Ledger, (typeof GLASS_LIMPET_LEDGER_KEYS)[number]>;
type RainbellLedger = Omit<Revision6Ledger, (typeof SILTSTITCHER_LEDGER_KEYS)[number]>;
type ReedwellLedger = Omit<RainbellLedger, (typeof RAINBELL_LEDGER_KEYS)[number]>;
type PrismLedger = Omit<ReedwellLedger, (typeof REEDWELL_LEDGER_KEYS)[number]>;
type Revision7World = Omit<
  World,
  'schemaRevision' | 'cargoMites' | 'cargoMiteAdmissionAt' | 'cargoMiteCandidateAfterId' | 'ecologyLedger'
> & { schemaRevision: 7; ecologyLedger: Revision7Ledger };
type Revision6World = Omit<
  Revision7World,
  | 'schemaRevision'
  | 'glassLimpets'
  | 'glassLimpetAdmissionAt'
  | 'glassLimpetCandidateAfterId'
  | 'skimmerCandidateAfterId'
  | 'nextFoundingTick'
  | 'foundingTypeCursor'
  | 'ecologyLedger'
> & { schemaRevision: 6; ecologyLedger: Revision6Ledger };
type Revision5World = Omit<
  Revision6World,
  'schemaRevision' | 'siltstitchers' | 'siltstitcherAdmissionAt' | 'siltstitcherCandidateAfterId' | 'ecologyLedger'
> & { schemaRevision: 5; ecologyLedger: RainbellLedger };
type Revision4World = Omit<
  Revision5World,
  'schemaRevision' | 'rainbells' | 'rainbellAdmissionAt' | 'rainbellCandidateAfterId' | 'ecologyLedger'
> & { schemaRevision: 4; ecologyLedger: ReedwellLedger };
type Revision3World = Omit<
  Revision4World,
  'schemaRevision' | 'reedwells' | 'reedwellAdmissionAt' | 'reedwellCandidateAfterId' | 'ecologyLedger'
> & { schemaRevision: 3; ecologyLedger: PrismLedger };
type Revision2World = Omit<
  Revision3World,
  'schemaRevision' | 'skimmers' | 'skimmerAdmissionAt' | 'ecologyLedger' | 'organisms'
> & { schemaRevision: 2; organisms: PrePrismOrganism[] };
type LegacyWorld = Omit<Revision2World, 'version' | 'schemaRevision' | 'weatherCall' | 'currents'> & { version: 1 | 2 };
type Revision1World = Omit<Revision2World, 'schemaRevision' | 'currents'> & { schemaRevision: 1 };

// Ordered, pure migrations operate on validated data, without touching old ecology.
function migrateV1ToV2(previous: LegacyWorld): LegacyWorld {
  const next = { ...previous, version: 2 as const, grazers: [], nests: [] };
  initializeGrazers(next as unknown as World);
  return next;
}

function migrateV2ToV3(previous: LegacyWorld): Revision1World {
  return { ...previous, version: 3, schemaRevision: 1, weatherCall: { startedAt: null, nextAllowedAt: 0 } };
}

function migrateRevision1To2(previous: Revision1World): Revision2World {
  return { ...previous, schemaRevision: 2, currents: [] };
}

function migrateRevision2To3(previous: Revision2World): Revision3World {
  return {
    ...previous,
    schemaRevision: 3,
    skimmers: [],
    skimmerAdmissionAt: previous.elapsed,
    organisms: previous.organisms.map((entry) => ({ ...entry, pigmentCredit: 0 })),
    ecologyLedger: {
      mineralizedPigment: 0,
      maintenancePigment: 0,
      emittedLight: 0,
      pigmentConverted: 0,
      feedingCreditLost: 0,
    },
  };
}

function migrateRevision3To4(previous: Revision3World): Revision4World {
  return {
    ...previous,
    schemaRevision: 4,
    reedwells: [],
    reedwellAdmissionAt: previous.elapsed,
    reedwellCandidateAfterId: 0,
    ecologyLedger: {
      ...previous.ecologyLedger,
      daylightHarvested: 0,
      daylightUnharvested: 0,
      reedwellEmittedLight: 0,
      reedwellDissipatedLight: 0,
    },
  };
}

function migrateRevision4To5(previous: Revision4World): Revision5World {
  return {
    ...previous,
    schemaRevision: 5,
    rainbells: [],
    rainbellAdmissionAt: previous.elapsed,
    rainbellCandidateAfterId: 0,
    ecologyLedger: {
      ...previous.ecologyLedger,
      rainbellIntake: 0,
      rainbellPumpingPigment: 0,
      rainbellMaintenancePigment: 0,
    },
  };
}

function migrateRevision5To6(previous: Revision5World): Revision6World {
  return {
    ...previous,
    schemaRevision: 6,
    siltstitchers: [],
    siltstitcherAdmissionAt: previous.elapsed,
    siltstitcherCandidateAfterId: 0,
    ecologyLedger: {
      ...previous.ecologyLedger,
      siltstitcherNestReserve: 0,
      siltstitcherNestCargo: 0,
      siltstitcherOutwardPigment: 0,
      siltstitcherMaintenancePigment: 0,
    },
  };
}

function migrateRevision6To7(previous: Revision6World): Revision7World {
  return {
    ...previous,
    schemaRevision: 7,
    glassLimpets: [],
    skimmerCandidateAfterId: 0,
    glassLimpetAdmissionAt: previous.elapsed,
    glassLimpetCandidateAfterId: 0,
    nextFoundingTick: previous.tick,
    foundingTypeCursor: 0,
    ecologyLedger: { ...previous.ecologyLedger, glassLimpetIntake: 0, glassLimpetMaintenancePigment: 0 },
  };
}

function migrateRevision7To8(previous: Revision7World): World {
  return {
    ...previous,
    schemaRevision: 8,
    cargoMites: [],
    cargoMiteAdmissionAt: previous.elapsed,
    cargoMiteCandidateAfterId: 0,
    ecologyLedger: { ...previous.ecologyLedger, cargoMiteIntake: 0, cargoMiteMaintenancePigment: 0 },
  };
}

export function serializeWorld(world: World): string {
  return JSON.stringify(world);
}

export function restoreWorld(input: string): World | null {
  if (typeof input !== 'string' || input.length === 0 || input.length > MAX_SAVE_LENGTH) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(input) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
  if (
    !record(parsed) ||
    (parsed.version !== 1 && parsed.version !== 2 && parsed.version !== 3) ||
    !integer(parsed.seed, 0, 0xffffffff) ||
    !integer(parsed.randomState, 0, 0xffffffff) ||
    !range(parsed.elapsed, 0, MAX_NUMBER) ||
    !integer(parsed.tick) ||
    !integer(parsed.nextId, 1) ||
    !range(parsed.consumed, 0, MAX_NUMBER)
  )
    return null;

  if (
    (parsed.version === 3 &&
      (!integer(parsed.schemaRevision, 1, 8) || !weatherCall(parsed.weatherCall, parsed.elapsed))) ||
    (parsed.version !== 3 && ('schemaRevision' in parsed || 'weatherCall' in parsed || 'currents' in parsed))
  )
    return null;
  let currents: Current[] = [];
  if (parsed.version === 3 && integer(parsed.schemaRevision, 2, 8)) {
    if (
      !Array.isArray(parsed.currents) ||
      parsed.currents.length > MAX_CURRENTS ||
      !parsed.currents.every((entry: unknown) => current(entry, parsed.elapsed as number))
    )
      return null;
    currents = parsed.currents as Current[];
  } else if ('currents' in parsed) return null;

  const { organisms, lights, sediment: deposits } = parsed;
  if (
    !Array.isArray(organisms) ||
    organisms.length < 1 ||
    organisms.length > LIMITS.organisms ||
    !Array.isArray(lights) ||
    lights.length > LIMITS.lights ||
    !Array.isArray(deposits) ||
    deposits.length > LIMITS.sediment
  )
    return null;
  if (!organisms.every(organism) || !lights.every(light) || !deposits.every(sediment)) return null;
  const miteRevision = parsed.version === 3 && parsed.schemaRevision === 8;
  const limpetRevision = parsed.version === 3 && (parsed.schemaRevision === 7 || miteRevision);
  const stitching = parsed.version === 3 && (parsed.schemaRevision === 6 || limpetRevision);
  const pumping = parsed.version === 3 && (parsed.schemaRevision === 5 || stitching);
  const planted = parsed.version === 3 && (parsed.schemaRevision === 4 || pumping);
  const prism = parsed.version === 3 && (parsed.schemaRevision === 3 || planted);
  let skimmers: Skimmer[] = [];
  if (prism) {
    if (
      !organisms.every((entry) => record(entry) && range(entry.pigmentCredit, 0, 1)) ||
      !Array.isArray(parsed.skimmers) ||
      parsed.skimmers.length > SKIMMER_CAP ||
      parsed.skimmers.length > NEW_TYPE_POPULATION_CAP ||
      !parsed.skimmers.every((entry) => skimmer(entry, parsed.elapsed as number, parsed.nextId as number)) ||
      !range(parsed.skimmerAdmissionAt, 0, Math.min(MAX_NUMBER, parsed.elapsed + 60)) ||
      !ledger(parsed.ecologyLedger, planted, pumping, stitching, limpetRevision, miteRevision)
    )
      return null;
    if (
      limpetRevision
        ? !integer(parsed.skimmerCandidateAfterId, 0, parsed.nextId - 1)
        : 'skimmerCandidateAfterId' in parsed
    )
      return null;
    skimmers = parsed.skimmers as Skimmer[];
  } else if (
    'skimmers' in parsed ||
    'skimmerAdmissionAt' in parsed ||
    'skimmerCandidateAfterId' in parsed ||
    'ecologyLedger' in parsed ||
    organisms.some((entry) => record(entry) && 'pigmentCredit' in entry)
  )
    return null;

  let reedwells: Reedwell[] = [];
  if (planted) {
    if (
      !Array.isArray(parsed.reedwells) ||
      parsed.reedwells.length > REEDWELL_CAP ||
      parsed.reedwells.length + skimmers.length > NEW_TYPE_POPULATION_CAP ||
      !parsed.reedwells.every((entry) => reedwell(entry, parsed.elapsed as number)) ||
      !integer(parsed.reedwellCandidateAfterId, 0, parsed.nextId - 1) ||
      !range(
        parsed.reedwellAdmissionAt,
        0,
        Math.min(MAX_NUMBER, parsed.elapsed + SPECIES_CATALOG.reedwell.admissionRest),
      )
    )
      return null;
    reedwells = parsed.reedwells as Reedwell[];
  } else if ('reedwells' in parsed || 'reedwellAdmissionAt' in parsed || 'reedwellCandidateAfterId' in parsed)
    return null;

  let rainbells: Rainbell[] = [];
  if (pumping) {
    if (
      !Array.isArray(parsed.rainbells) ||
      parsed.rainbells.length > RAINBELL_CAP ||
      skimmers.length + reedwells.length + parsed.rainbells.length > NEW_TYPE_POPULATION_CAP ||
      !parsed.rainbells.every((entry) => rainbell(entry, parsed.elapsed as number, parsed.nextId as number)) ||
      !integer(parsed.rainbellCandidateAfterId, 0, parsed.nextId - 1) ||
      !range(
        parsed.rainbellAdmissionAt,
        0,
        Math.min(MAX_NUMBER, parsed.elapsed + SPECIES_CATALOG.rainbell.admissionRest),
      )
    )
      return null;
    rainbells = parsed.rainbells as Rainbell[];
  } else if ('rainbells' in parsed || 'rainbellAdmissionAt' in parsed || 'rainbellCandidateAfterId' in parsed)
    return null;

  let siltstitchers: Siltstitcher[] = [];
  if (stitching) {
    if (
      !Array.isArray(parsed.siltstitchers) ||
      parsed.siltstitchers.length > SILTSTITCHER_CAP ||
      skimmers.length + reedwells.length + rainbells.length + parsed.siltstitchers.length > NEW_TYPE_POPULATION_CAP ||
      !parsed.siltstitchers.every((entry) => siltstitcher(entry, parsed.nextId as number)) ||
      !integer(parsed.siltstitcherCandidateAfterId, 0, parsed.nextId - 1) ||
      !range(
        parsed.siltstitcherAdmissionAt,
        0,
        Math.min(MAX_NUMBER, parsed.elapsed + SPECIES_CATALOG.siltstitcher.admissionRest),
      )
    )
      return null;
    siltstitchers = parsed.siltstitchers as Siltstitcher[];
  } else if (
    'siltstitchers' in parsed ||
    'siltstitcherAdmissionAt' in parsed ||
    'siltstitcherCandidateAfterId' in parsed
  )
    return null;

  let glassLimpets: GlassLimpet[] = [];
  if (limpetRevision) {
    if (
      !Array.isArray(parsed.glassLimpets) ||
      parsed.glassLimpets.length > GLASS_LIMPET_CAP ||
      skimmers.length + reedwells.length + rainbells.length + siltstitchers.length + parsed.glassLimpets.length >
        NEW_TYPE_POPULATION_CAP ||
      !parsed.glassLimpets.every((entry) => glassLimpet(entry, parsed.nextId as number)) ||
      !integer(parsed.glassLimpetCandidateAfterId, 0, parsed.nextId - 1) ||
      !range(
        parsed.glassLimpetAdmissionAt,
        0,
        Math.min(MAX_NUMBER, parsed.elapsed + SPECIES_CATALOG.glassLimpet.admissionRest),
      ) ||
      !integer(parsed.nextFoundingTick, 0, Math.min(MAX_NUMBER, (parsed.tick as number) + 6)) ||
      !integer(parsed.foundingTypeCursor, 0, miteRevision ? 5 : 4)
    )
      return null;
    glassLimpets = parsed.glassLimpets as GlassLimpet[];
    if (
      glassLimpets.some((entry, index) =>
        glassLimpets
          .slice(index + 1)
          .some((other) => Math.hypot(entry.x - other.x, entry.y - other.y) < SPECIES_CATALOG.glassLimpet.spacing),
      )
    )
      return null;
  } else if (
    'glassLimpets' in parsed ||
    'glassLimpetAdmissionAt' in parsed ||
    'glassLimpetCandidateAfterId' in parsed ||
    'nextFoundingTick' in parsed ||
    'foundingTypeCursor' in parsed
  )
    return null;

  let cargoMites: CargoMite[] = [];
  if (miteRevision) {
    if (
      !Array.isArray(parsed.cargoMites) ||
      parsed.cargoMites.length > CARGO_MITE_CAP ||
      skimmers.length +
        reedwells.length +
        rainbells.length +
        siltstitchers.length +
        glassLimpets.length +
        parsed.cargoMites.length >
        NEW_TYPE_POPULATION_CAP ||
      !parsed.cargoMites.every((entry: unknown) =>
        cargoMite(entry, parsed.elapsed as number, parsed.nextId as number),
      ) ||
      !integer(parsed.cargoMiteCandidateAfterId, 0, (parsed.nextId as number) - 1) ||
      !range(
        parsed.cargoMiteAdmissionAt,
        0,
        Math.min(MAX_NUMBER, (parsed.elapsed as number) + SPECIES_CATALOG.cargoMite.admissionRest),
      )
    )
      return null;
    cargoMites = parsed.cargoMites as CargoMite[];
  } else if ('cargoMites' in parsed || 'cargoMiteAdmissionAt' in parsed || 'cargoMiteCandidateAfterId' in parsed)
    return null;

  let grazers: Grazer[] = [];
  let nests: Nest[] = [];
  if (parsed.version >= 2) {
    if (
      !Array.isArray(parsed.grazers) ||
      parsed.grazers.length > LIMITS.grazers ||
      !Array.isArray(parsed.nests) ||
      parsed.nests.length > LIMITS.nests ||
      !parsed.grazers.every(grazer) ||
      !parsed.nests.every(nest)
    )
      return null;
    grazers = parsed.grazers as Grazer[];
    nests = parsed.nests as Nest[];
    const nestIds = new Set(nests.map((entry) => entry.id));
    if (grazers.some((entry) => !nestIds.has(entry.nestId))) return null;
  } else if (parsed.nextId > MAX_NUMBER - 8) return null;

  const nestIds = new Set(nests.map((entry) => entry.id));
  if (skimmers.some((entry) => !nestIds.has(entry.homeNestId))) return null;
  const ids = new Set<number>();
  let largestId = 0;
  for (const entry of [
    ...organisms,
    ...lights,
    ...deposits,
    ...grazers,
    ...nests,
    ...currents,
    ...skimmers,
    ...reedwells,
    ...rainbells,
    ...siltstitchers,
    ...glassLimpets,
    ...cargoMites,
  ]) {
    const id = (entry as Record<string, unknown>).id as number;
    if (ids.has(id)) return null;
    ids.add(id);
    largestId = Math.max(largestId, id);
  }
  if (parsed.nextId <= largestId) return null;
  const sedimentIds = new Set(deposits.map((entry) => (entry as Sediment).id));
  if (
    skimmers.some(
      (entry) =>
        entry.targetSedimentId !== null && ids.has(entry.targetSedimentId) && !sedimentIds.has(entry.targetSedimentId),
    )
  )
    return null;
  if (
    rainbells.some((entry) =>
      [entry.feedTargetSedimentId, entry.pumpTargetSedimentId].some(
        (id) => id !== null && ids.has(id) && !sedimentIds.has(id),
      ),
    )
  )
    return null;
  if (
    glassLimpets.some(
      (entry) =>
        entry.targetSedimentId !== null && ids.has(entry.targetSedimentId) && !sedimentIds.has(entry.targetSedimentId),
    )
  )
    return null;
  const grazerIds = new Set(grazers.map((entry) => entry.id));
  const miteIds = new Set(cargoMites.map((entry) => entry.id));
  if (
    cargoMites.some(
      (entry) =>
        (entry.hostId !== null && !grazerIds.has(entry.hostId)) ||
        (entry.targetHostId !== null && ids.has(entry.targetHostId) && !grazerIds.has(entry.targetHostId)) ||
        (entry.parentId !== null && ids.has(entry.parentId) && !miteIds.has(entry.parentId)),
    )
  )
    return null;
  const miteHostCounts = new Map<number, number>();
  for (const entry of cargoMites)
    if (entry.hostId !== null) {
      const count = (miteHostCounts.get(entry.hostId) ?? 0) + 1;
      if (count > SPECIES_CATALOG.cargoMite.hostCap) return null;
      miteHostCounts.set(entry.hostId, count);
    }
  if (
    cargoMites.some(
      (entry) =>
        entry.hostId !== null &&
        !grazers.some(
          (host) =>
            host.id === entry.hostId &&
            Math.hypot(entry.x - host.x, entry.y - host.y) <= 1e-6 &&
            Math.hypot(entry.vx - host.vx, entry.vy - host.vy) <= 1e-6,
        ),
    )
  )
    return null;
  if (siltstitchers.some((entry) => ids.has(entry.homeNestId) && !nestIds.has(entry.homeNestId))) return null;
  if (new Set(siltstitchers.map((entry) => entry.homeNestId)).size !== siltstitchers.length) return null;
  const homes = new Map(nests.map((entry) => [entry.id, entry]));
  const stitcherPolicy = SPECIES_CATALOG.siltstitcher;
  if (
    siltstitchers.some((entry) => {
      const home = homes.get(entry.homeNestId);
      if (!home || entry.destination === null) return false;
      const reach = Math.hypot(entry.destination.x - home.x, entry.destination.y - home.y);
      return reach < stitcherPolicy.destinationMinReach - 1e-9 || reach > stitcherPolicy.destinationMaxReach + 1e-9;
    })
  )
    return null;

  // Only the versioned contract enters the simulation; storage is a UI concern.
  const ecology = {
    seed: parsed.seed,
    randomState: parsed.randomState,
    elapsed: parsed.elapsed,
    tick: parsed.tick,
    nextId: parsed.nextId,
    organisms: organisms as Organism[],
    lights: lights as LightSource[],
    sediment: deposits as Sediment[],
    grazers,
    nests,
    consumed: parsed.consumed,
  };
  if (parsed.version === 3) {
    const revision1: Revision1World = {
      ...ecology,
      version: 3,
      schemaRevision: 1,
      weatherCall: { ...(parsed.weatherCall as World['weatherCall']) },
    };
    const revision2: Revision2World =
      parsed.schemaRevision === 1
        ? migrateRevision1To2(revision1)
        : {
            ...revision1,
            schemaRevision: 2,
            currents: currents.filter((entry) => currentStrength(entry, parsed.elapsed as number) > 0),
          };
    const revision3: Revision3World = prism
      ? {
          ...revision2,
          schemaRevision: 3,
          organisms: organisms as Organism[],
          skimmers,
          skimmerAdmissionAt: parsed.skimmerAdmissionAt as number,
          ecologyLedger: { ...(parsed.ecologyLedger as PrismLedger) },
        }
      : migrateRevision2To3(revision2);
    const revision4: Revision4World = planted
      ? {
          ...revision3,
          schemaRevision: 4,
          reedwells,
          reedwellAdmissionAt: parsed.reedwellAdmissionAt as number,
          reedwellCandidateAfterId: parsed.reedwellCandidateAfterId as number,
          ecologyLedger: { ...(parsed.ecologyLedger as ReedwellLedger) },
        }
      : migrateRevision3To4(revision3);
    const revision5: Revision5World = pumping
      ? {
          ...revision4,
          schemaRevision: 5,
          rainbells,
          rainbellAdmissionAt: parsed.rainbellAdmissionAt as number,
          rainbellCandidateAfterId: parsed.rainbellCandidateAfterId as number,
          ecologyLedger: { ...(parsed.ecologyLedger as RainbellLedger) },
        }
      : migrateRevision4To5(revision4);
    const revision6: Revision6World = stitching
      ? {
          ...revision5,
          schemaRevision: 6,
          siltstitchers,
          siltstitcherAdmissionAt: parsed.siltstitcherAdmissionAt as number,
          siltstitcherCandidateAfterId: parsed.siltstitcherCandidateAfterId as number,
          ecologyLedger: { ...(parsed.ecologyLedger as Revision6Ledger) },
        }
      : migrateRevision5To6(revision5);
    const revision7: Revision7World = limpetRevision
      ? {
          ...revision6,
          schemaRevision: 7,
          glassLimpets,
          skimmerCandidateAfterId: parsed.skimmerCandidateAfterId as number,
          glassLimpetAdmissionAt: parsed.glassLimpetAdmissionAt as number,
          glassLimpetCandidateAfterId: parsed.glassLimpetCandidateAfterId as number,
          nextFoundingTick: parsed.nextFoundingTick as number,
          foundingTypeCursor: parsed.foundingTypeCursor as number,
          ecologyLedger: { ...(parsed.ecologyLedger as Revision7Ledger) },
        }
      : migrateRevision6To7(revision6);
    return miteRevision
      ? {
          ...revision7,
          schemaRevision: 8,
          cargoMites,
          cargoMiteAdmissionAt: parsed.cargoMiteAdmissionAt as number,
          cargoMiteCandidateAfterId: parsed.cargoMiteCandidateAfterId as number,
          ecologyLedger: { ...(parsed.ecologyLedger as EcologyLedger) },
        }
      : migrateRevision7To8(revision7);
  }
  let legacy: LegacyWorld = { ...ecology, version: parsed.version };
  if (legacy.version === 1) legacy = migrateV1ToV2(legacy);
  return migrateRevision7To8(
    migrateRevision6To7(
      migrateRevision5To6(
        migrateRevision4To5(migrateRevision3To4(migrateRevision2To3(migrateRevision1To2(migrateV2ToV3(legacy))))),
      ),
    ),
  );
}
