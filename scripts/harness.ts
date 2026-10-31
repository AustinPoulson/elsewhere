#!/usr/bin/env npx tsx
import { createWorld, stepWorld, getStats } from '../src/world/simulation';
import { restoreWorld } from '../src/world/persistence';
import { FIXED_STEP, type World } from '../src/world/types';
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
}

interface SpeciesEvents {
  births: number;
  deaths: number;
  extinctAt: number | null;
}

interface HarnessReport {
  seed: number;
  simulatedDays: number;
  worldSeconds: number;
  totalSteps: number;
  wallTimeMs: number;
  stepsPerSecond: number;
  populations: PopulationSample[];
  events: Record<string, SpeciesEvents>;
  resources: {
    lightEnergy: number;
    loosePigment: number;
    nestedPigment: number;
    totalConsumed: number;
  };
  ledger: World['ecologyLedger'];
  conservationCheck: {
    inputLight: number;
    outputPigment: number;
    note: string;
  };
}

function parseArgs(): { days: number; seed: number; json?: string; load?: string } {
  const args = process.argv.slice(2);
  let days = 30;
  let seed = Date.now() >>> 0;
  let json: string | undefined;
  let load: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days' && args[i + 1]) {
      days = parseInt(args[++i], 10);
    } else if (args[i] === '--seed' && args[i + 1]) {
      seed = parseInt(args[++i], 10) >>> 0;
    } else if (args[i] === '--json' && args[i + 1]) {
      json = args[++i];
    } else if (args[i] === '--load' && args[i + 1]) {
      load = args[++i];
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Elsewhere Headless Simulation Harness

Usage: npm run harness -- [options]

Options:
  --days <n>      Number of world days to simulate (default: 30)
                  One world day = 360 world seconds (one day/night cycle)
  --seed <n>      Random seed for world creation (default: current timestamp)
  --load <file>   Load world from a save JSON file instead of creating fresh
  --json <file>   Output machine-readable JSON to file
  --help, -h      Show this help

Examples:
  npm run harness -- --days 30 --seed 1
  npm run harness -- --days 10 --seed 42 --json results.json
  npm run harness -- --load mysave.json --days 5
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

  return { days, seed, json, load };
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

function runHarness(config: { days: number; seed: number; load?: string }): HarnessReport {
  const world = createOrLoadWorld(config.seed, config.load);
  const actualSeed = world.seed;
  const targetSeconds = config.days * DAY_SECONDS;
  const targetSteps = Math.ceil(targetSeconds / FIXED_STEP);
  const sampleInterval = Math.max(1, Math.floor(targetSteps / 100));

  const populations: PopulationSample[] = [];
  const events: Record<string, SpeciesEvents> = {
    lucents: { births: 0, deaths: 0, extinctAt: null },
    grazers: { births: 0, deaths: 0, extinctAt: null },
    skimmers: { births: 0, deaths: 0, extinctAt: null },
    reedwells: { births: 0, deaths: 0, extinctAt: null },
    rainbells: { births: 0, deaths: 0, extinctAt: null },
    siltstitchers: { births: 0, deaths: 0, extinctAt: null },
    glassLimpets: { births: 0, deaths: 0, extinctAt: null },
    cargoMites: { births: 0, deaths: 0, extinctAt: null },
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
  };

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

  const startTime = performance.now();

  for (let step = 0; step < targetSteps; step++) {
    stepWorld(world);
    updateEvents();

    if (step % sampleInterval === 0) {
      populations.push(samplePopulation());
    }
  }

  populations.push(samplePopulation());

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
    populations,
    events,
    resources: {
      lightEnergy: stats.light,
      loosePigment: stats.pigment,
      nestedPigment: stats.nestPigment,
      totalConsumed: world.consumed,
    },
    ledger: { ...world.ecologyLedger },
    conservationCheck: {
      inputLight: world.consumed + stats.light,
      outputPigment:
        stats.pigment +
        stats.nestPigment +
        world.ecologyLedger.mineralizedPigment +
        world.ecologyLedger.maintenancePigment,
      note: 'Light consumed becomes pigment through feeding; values should correlate but not match exactly due to energy floor and decay.',
    },
  };
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
}

function printReport(report: HarnessReport): void {
  console.log('\n' + '═'.repeat(60));
  console.log('  ELSEWHERE HEADLESS SIMULATION REPORT');
  console.log('═'.repeat(60));

  console.log(`\n📊 Run Configuration`);
  console.log(`   Seed: ${report.seed}`);
  console.log(`   Simulated: ${report.simulatedDays} world days (${formatTime(report.worldSeconds)})`);
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

  console.log(`\n📈 Population Curves (sampled over time)`);
  const samples = [
    0,
    Math.floor(report.populations.length / 4),
    Math.floor(report.populations.length / 2),
    Math.floor((3 * report.populations.length) / 4),
    report.populations.length - 1,
  ];
  console.log('   Time       | Luc | Grz | Ski | Ree | Rai | Sil | Gla | Car');
  console.log('   ' + '-'.repeat(56));
  for (const i of samples) {
    const p = report.populations[i];
    console.log(
      `   ${formatTime(p.worldTime).padEnd(10)} | ${String(p.lucents).padStart(3)} | ${String(p.grazers).padStart(3)} | ${String(p.skimmers).padStart(3)} | ${String(p.reedwells).padStart(3)} | ${String(p.rainbells).padStart(3)} | ${String(p.siltstitchers).padStart(3)} | ${String(p.glassLimpets).padStart(3)} | ${String(p.cargoMites).padStart(3)}`,
    );
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
  console.log(`   Total light consumed: ${report.resources.totalConsumed.toFixed(2)}`);

  console.log(`\n📒 Ecology Ledger`);
  console.log(`   Mineralized pigment: ${report.ledger.mineralizedPigment.toFixed(2)}`);
  console.log(`   Maintenance pigment: ${report.ledger.maintenancePigment.toFixed(2)}`);
  console.log(`   Emitted light: ${report.ledger.emittedLight.toFixed(2)}`);
  console.log(`   Pigment converted: ${report.ledger.pigmentConverted.toFixed(2)}`);
  console.log(`   Daylight harvested: ${report.ledger.daylightHarvested.toFixed(2)}`);
  console.log(`   Reedwell emitted light: ${report.ledger.reedwellEmittedLight.toFixed(2)}`);
  console.log(`   Rainbell intake: ${report.ledger.rainbellIntake.toFixed(2)}`);

  console.log(`\n⚖️  Conservation Check`);
  console.log(`   Input (consumed + remaining light): ${report.conservationCheck.inputLight.toFixed(2)}`);
  console.log(`   Output (pigment pools + ledger): ${report.conservationCheck.outputPigment.toFixed(2)}`);
  console.log(`   Note: ${report.conservationCheck.note}`);

  console.log('\n' + '═'.repeat(60) + '\n');
}

const config = parseArgs();
console.log(
  `Starting headless simulation: ${config.days} world days, seed ${config.seed}${config.load ? ` (loading from ${config.load})` : ''}`,
);

const report = runHarness(config);
printReport(report);

if (config.json) {
  fs.writeFileSync(config.json, JSON.stringify(report, null, 2));
  console.log(`JSON report written to: ${config.json}`);
}
