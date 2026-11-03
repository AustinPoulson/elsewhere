#!/usr/bin/env npx tsx
import { addLight, createWorld, getStats, SPRINGS, stepWorld } from '../src/world/simulation';
import { restoreWorld } from '../src/world/persistence';
import { heldRemainPigment } from '../src/world/species/remains';
import { FIXED_STEP, type Traits, type World } from '../src/world/types';
import * as fs from 'node:fs';

const DAY_SECONDS = 360;

interface PopulationSample {
  worldTime: number;
  lucents: number;
  grazers: number;
  skimmers: number;
  reedwells: number;
  rainbells: number;
  siltstitchers: number;
  glassLimpets: number;
  cargoMites: number;
  marlgrubs: number;
  remains: number;
}

interface TraitMeans {
  count: number;
  drive: number;
  bulk: number;
}

interface TraitSample {
  worldTime: number;
  lucents: TraitMeans | null;
  grazers: TraitMeans | null;
  skimmers: TraitMeans | null;
  reedwells: TraitMeans | null;
  rainbells: TraitMeans | null;
  siltstitchers: TraitMeans | null;
  glassLimpets: TraitMeans | null;
  cargoMites: TraitMeans | null;
  marlgrubs: TraitMeans | null;
}

interface SpeciesEvents {
  births: number;
  deaths: number;
  extinctAt: number | null;
}

export interface HarnessReport {
  seed: number;
  simulatedDays: number;
  worldSeconds: number;
  totalSteps: number;
  wallTimeMs: number;
  stepsPerSecond: number;
  visitorLight: boolean;
  populations: PopulationSample[];
  traitDrift: TraitSample[];
  events: Record<string, SpeciesEvents>;
  resources: {
    lightEnergy: number;
    loosePigment: number;
    nestedPigment: number;
    remainPigment: number;
    totalConsumed: number;
    ambientHarvested: number;
  };
  ledger: World['ecologyLedger'];
  conservationCheck: {
    inputLight: number;
    outputPigment: number;
    remainsCreated: number;
    remainsHeld: number;
    remainsConsumed: number;
    remainsDecayed: number;
    remainsBalanced: boolean;
    note: string;
  };
}

export interface HarnessConfig {
  days: number;
  seed: number;
  json?: string;
  load?: string;
  visitorLight: boolean;
}

function traitMeans(list: { traits: Traits }[]): TraitMeans | null {
  if (list.length === 0) return null;
  let drive = 0;
  let bulk = 0;
  for (const entry of list) {
    drive += entry.traits.drive;
    bulk += entry.traits.bulk;
  }
  return { count: list.length, drive: drive / list.length, bulk: bulk / list.length };
}

export function parseHarnessArgs(argv: string[]): HarnessConfig {
  let days = 30;
  let seed = Date.now() >>> 0;
  let json: string | undefined;
  let load: string | undefined;
  let visitorLight = false;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--days' && argv[i + 1]) {
      days = parseInt(argv[++i], 10);
    } else if (argv[i] === '--seed' && argv[i + 1]) {
      seed = parseInt(argv[++i], 10) >>> 0;
    } else if (argv[i] === '--json' && argv[i + 1]) {
      json = argv[++i];
    } else if (argv[i] === '--load' && argv[i + 1]) {
      load = argv[++i];
    } else if (argv[i] === '--visitor-light') {
      visitorLight = true;
    } else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log(`
Elsewhere Headless Simulation Harness

Usage: npm run harness -- [options]

Options:
  --days <n>         Number of world days to simulate (default: 30)
                     One world day = 360 world seconds (one day/night cycle)
  --seed <n>         Random seed for world creation (default: current timestamp)
  --load <file>      Load world from a save JSON file instead of creating fresh
  --json <file>      Output machine-readable JSON to file
  --visitor-light    Place one visitor light at a rotating spring each world day
  --help, -h         Show this help

Examples:
  npm run harness -- --days 30 --seed 1
  npm run harness -- --days 10 --seed 42 --json results.json
  npm run harness -- --load mysave.json --days 5
  npm run harness -- --days 30 --seed 1 --visitor-light
`);
      process.exit(0);
    }
  }

  if (!Number.isFinite(days) || days <= 0) {
    console.error('Error: --days must be a positive number');
    process.exit(1);
  }
  if (!Number.isFinite(seed)) {
    console.error('Error: --seed must be a valid number');
    process.exit(1);
  }

  return { days, seed, json, load, visitorLight };
}

function createOrLoadWorld(seed: number, loadPath?: string): World {
  if (loadPath) {
    const content = fs.readFileSync(loadPath, 'utf-8');
    const world = restoreWorld(content);
    if (!world) {
      console.error(`Error: Could not parse save file: ${loadPath}`);
      process.exit(1);
    }
    console.log(`Loaded world from ${loadPath} (seed: ${world.seed}, elapsed: ${world.elapsed.toFixed(1)}s)`);
    return world;
  }
  return createWorld(seed);
}

export function runHarness(config: HarnessConfig): HarnessReport {
  const world = createOrLoadWorld(config.seed, config.load);
  const actualSeed = world.seed;
  const targetSeconds = config.days * DAY_SECONDS;
  const targetSteps = Math.ceil(targetSeconds / FIXED_STEP);
  const sampleInterval = Math.max(1, Math.floor(targetSteps / 100));

  const populations: PopulationSample[] = [];
  const traitDrift: TraitSample[] = [];
  const events: Record<string, SpeciesEvents> = {
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

  let prevCounts = {
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
  let lastVisitorDay = Math.floor(world.elapsed / DAY_SECONDS);

  function samplePopulation(): PopulationSample {
    return {
      worldTime: world.elapsed,
      lucents: world.organisms.length,
      grazers: world.grazers.length,
      skimmers: world.skimmers.length,
      reedwells: world.reedwells.length,
      rainbells: world.rainbells.length,
      siltstitchers: world.siltstitchers.length,
      glassLimpets: world.glassLimpets.length,
      cargoMites: world.cargoMites.length,
      marlgrubs: world.marlgrubs.length,
      remains: world.remains.length,
    };
  }

  function sampleTraits(): TraitSample {
    return {
      worldTime: world.elapsed,
      lucents: traitMeans(world.organisms),
      grazers: traitMeans(world.grazers),
      skimmers: traitMeans(world.skimmers),
      reedwells: traitMeans(world.reedwells),
      rainbells: traitMeans(world.rainbells),
      siltstitchers: traitMeans(world.siltstitchers),
      glassLimpets: traitMeans(world.glassLimpets),
      cargoMites: traitMeans(world.cargoMites),
      marlgrubs: traitMeans(world.marlgrubs),
    };
  }

  function updateEvents(): void {
    const counts = {
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

    for (const species of Object.keys(events) as (keyof typeof counts)[]) {
      const delta = counts[species] - prevCounts[species];
      if (delta > 0) {
        events[species].births += delta;
        if (events[species].extinctAt !== null) {
          events[species].extinctAt = null;
        }
      } else if (delta < 0) {
        events[species].deaths += -delta;
      }
      if (counts[species] === 0 && prevCounts[species] > 0) {
        events[species].extinctAt = world.elapsed;
      }
    }

    prevCounts = counts;
  }

  populations.push(samplePopulation());
  traitDrift.push(sampleTraits());

  const startTime = performance.now();

  for (let step = 0; step < targetSteps; step++) {
    stepWorld(world);
    updateEvents();
    if (config.visitorLight) {
      const day = Math.floor(world.elapsed / DAY_SECONDS);
      if (day > lastVisitorDay) {
        const spring = SPRINGS[day % SPRINGS.length];
        addLight(world, spring.x, spring.y);
        lastVisitorDay = day;
      }
    }

    if (step % sampleInterval === 0) {
      populations.push(samplePopulation());
      traitDrift.push(sampleTraits());
    }
  }

  populations.push(samplePopulation());
  traitDrift.push(sampleTraits());

  const endTime = performance.now();
  const wallTimeMs = endTime - startTime;

  const stats = getStats(world);

  return {
    seed: actualSeed,
    simulatedDays: config.days,
    worldSeconds: world.elapsed,
    totalSteps: targetSteps,
    wallTimeMs,
    stepsPerSecond: targetSteps / (wallTimeMs / 1000),
    visitorLight: config.visitorLight,
    populations,
    traitDrift,
    events,
    resources: {
      lightEnergy: stats.light,
      loosePigment: stats.pigment,
      nestedPigment: stats.nestPigment,
      remainPigment: stats.remainPigment,
      totalConsumed: world.consumed,
      ambientHarvested: world.ecologyLedger.ambientHarvested,
    },
    ledger: { ...world.ecologyLedger },
    conservationCheck: {
      inputLight: world.consumed + stats.light + world.ecologyLedger.ambientHarvested,
      outputPigment:
        stats.pigment +
        stats.nestPigment +
        stats.remainPigment +
        world.ecologyLedger.mineralizedPigment +
        world.ecologyLedger.maintenancePigment,
      remainsCreated: world.ecologyLedger.remainsCreated,
      remainsHeld: heldRemainPigment(world),
      remainsConsumed: world.ecologyLedger.remainsConsumed,
      remainsDecayed: world.ecologyLedger.remainsDecayed,
      remainsBalanced:
        Math.abs(
          world.ecologyLedger.remainsCreated -
            (heldRemainPigment(world) + world.ecologyLedger.remainsConsumed + world.ecologyLedger.remainsDecayed),
        ) < 1e-6,
      note: 'Remains created equal held plus consumed plus decayed. Daylight and visitor light correlate with pigment rather than matching because of the energy floor, fade, and night.',
    },
  };
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
}

function formatMeans(sample: TraitMeans | null): string {
  if (!sample) return '—';
  return `n=${sample.count} drive ${sample.drive.toFixed(3)} bulk ${sample.bulk.toFixed(3)}`;
}

export function printReport(report: HarnessReport): void {
  console.log('\n' + '═'.repeat(60));
  console.log('  ELSEWHERE HEADLESS SIMULATION REPORT');
  console.log('═'.repeat(60));

  console.log(`\n📊 Run Configuration`);
  console.log(`   Seed: ${report.seed}`);
  console.log(`   Simulated: ${report.simulatedDays} world days (${formatTime(report.worldSeconds)})`);
  console.log(`   Visitor light: ${report.visitorLight ? 'on (one spring light / day)' : 'off'}`);
  console.log(`   Steps: ${report.totalSteps.toLocaleString()}`);
  console.log(`   Wall time: ${(report.wallTimeMs / 1000).toFixed(2)}s`);
  console.log(`   Performance: ${Math.round(report.stepsPerSecond).toLocaleString()} steps/sec`);

  console.log(`\n🌊 Final Population`);
  const final = report.populations[report.populations.length - 1];
  console.log(`   Lucents: ${final.lucents}`);
  console.log(`   Grazers: ${final.grazers}`);
  console.log(`   Skimmers: ${final.skimmers}`);
  console.log(`   Reedwells: ${final.reedwells}`);
  console.log(`   Rainbells: ${final.rainbells}`);
  console.log(`   Siltstitchers: ${final.siltstitchers}`);
  console.log(`   Glass limpets: ${final.glassLimpets}`);
  console.log(`   Cargo mites: ${final.cargoMites}`);
  console.log(`   Marlgrubs: ${final.marlgrubs}`);
  console.log(`   Remains: ${final.remains}`);

  console.log(`\n📈 Population Curves (sampled over time)`);
  const samples = [
    0,
    Math.floor(report.populations.length / 4),
    Math.floor(report.populations.length / 2),
    Math.floor((3 * report.populations.length) / 4),
    report.populations.length - 1,
  ];
  console.log('   Time       | Luc | Grz | Ski | Ree | Rai | Sil | Gla | Car | Mar | Rem');
  console.log('   ' + '-'.repeat(68));
  for (const i of samples) {
    const p = report.populations[i];
    console.log(
      `   ${formatTime(p.worldTime).padEnd(10)} | ${String(p.lucents).padStart(3)} | ${String(p.grazers).padStart(3)} | ${String(p.skimmers).padStart(3)} | ${String(p.reedwells).padStart(3)} | ${String(p.rainbells).padStart(3)} | ${String(p.siltstitchers).padStart(3)} | ${String(p.glassLimpets).padStart(3)} | ${String(p.cargoMites).padStart(3)} | ${String(p.marlgrubs).padStart(3)} | ${String(p.remains).padStart(3)}`,
    );
  }

  console.log(`\n🧬 Trait Drift`);
  const firstTraits = report.traitDrift[0];
  const lastTraits = report.traitDrift[report.traitDrift.length - 1];
  const traitSpecies = [
    'lucents',
    'grazers',
    'skimmers',
    'reedwells',
    'rainbells',
    'siltstitchers',
    'glassLimpets',
    'cargoMites',
    'marlgrubs',
  ] as const;
  for (const species of traitSpecies) {
    const start = firstTraits[species];
    const end = lastTraits[species];
    if (!start && !end) continue;
    console.log(`   ${species.padEnd(14)}: ${formatMeans(start)} → ${formatMeans(end)}`);
  }

  console.log(`\n🔄 Births & Deaths`);
  for (const [species, ev] of Object.entries(report.events)) {
    if (ev.births > 0 || ev.deaths > 0) {
      console.log(`   ${species.padEnd(14)}: +${ev.births} births, -${ev.deaths} deaths`);
    }
  }

  console.log(`\n💀 Extinctions`);
  let anyExtinct = false;
  for (const [species, ev] of Object.entries(report.events)) {
    if (ev.extinctAt !== null) {
      console.log(`   ${species}: went extinct at ${formatTime(ev.extinctAt)}`);
      anyExtinct = true;
    }
  }
  if (!anyExtinct) {
    console.log('   No extinctions observed');
  }

  console.log(`\n💡 Resource Totals`);
  console.log(`   Light energy remaining: ${report.resources.lightEnergy.toFixed(2)}`);
  console.log(`   Loose pigment: ${report.resources.loosePigment.toFixed(2)}`);
  console.log(`   Nested pigment: ${report.resources.nestedPigment.toFixed(2)}`);
  console.log(`   Remain pigment: ${report.resources.remainPigment.toFixed(2)}`);
  console.log(`   Total light consumed: ${report.resources.totalConsumed.toFixed(2)}`);
  console.log(`   Ambient daylight harvested: ${report.resources.ambientHarvested.toFixed(2)}`);

  console.log(`\n📒 Ecology Ledger`);
  console.log(`   Mineralized pigment: ${report.ledger.mineralizedPigment.toFixed(2)}`);
  console.log(`   Maintenance pigment: ${report.ledger.maintenancePigment.toFixed(2)}`);
  console.log(`   Emitted light: ${report.ledger.emittedLight.toFixed(2)}`);
  console.log(`   Pigment converted: ${report.ledger.pigmentConverted.toFixed(2)}`);
  console.log(`   Daylight harvested: ${report.ledger.daylightHarvested.toFixed(2)}`);
  console.log(`   Reedwell emitted light: ${report.ledger.reedwellEmittedLight.toFixed(2)}`);
  console.log(`   Rainbell intake: ${report.ledger.rainbellIntake.toFixed(2)}`);
  console.log(`   Ambient harvested: ${report.ledger.ambientHarvested.toFixed(2)}`);
  console.log(`   Remains created: ${report.ledger.remainsCreated.toFixed(2)}`);
  console.log(`   Remains consumed: ${report.ledger.remainsConsumed.toFixed(2)}`);
  console.log(`   Remains decayed: ${report.ledger.remainsDecayed.toFixed(2)}`);
  console.log(`   Marlgrub intake: ${report.ledger.marlgrubIntake.toFixed(2)}`);

  console.log(`\n⚖️  Conservation Check`);
  console.log(`   Input (consumed + remaining + ambient): ${report.conservationCheck.inputLight.toFixed(2)}`);
  console.log(`   Output (pigment pools + ledger): ${report.conservationCheck.outputPigment.toFixed(2)}`);
  console.log(
    `   Remains (created = held + consumed + decayed): ${report.conservationCheck.remainsCreated.toFixed(3)} = ${report.conservationCheck.remainsHeld.toFixed(3)} + ${report.conservationCheck.remainsConsumed.toFixed(3)} + ${report.conservationCheck.remainsDecayed.toFixed(3)} ${report.conservationCheck.remainsBalanced ? '✓' : '✗'}`,
  );
  console.log(`   Note: ${report.conservationCheck.note}`);

  console.log('\n' + '═'.repeat(60) + '\n');
}

function invokedAsCli(): boolean {
  const entry = process.argv[1] ?? '';
  return entry.endsWith('harness.ts') || entry.endsWith('harness');
}

if (invokedAsCli()) {
  const config = parseHarnessArgs(process.argv.slice(2));
  console.log(
    `Starting headless simulation: ${config.days} world days, seed ${config.seed}${config.load ? ` (loading from ${config.load})` : ''}${config.visitorLight ? ', visitor light on' : ''}`,
  );

  const report = runHarness(config);
  printReport(report);

  if (config.json) {
    fs.writeFileSync(config.json, JSON.stringify(report, null, 2));
    console.log(`JSON report written to: ${config.json}`);
  }
}
