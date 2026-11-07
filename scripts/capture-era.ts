#!/usr/bin/env npx tsx
import * as fs from 'node:fs';
import * as path from 'node:path';
import { captureNamedEra, parseEraFile, type CaptureEraOptions } from '../src/world/eras';
import { inInletPool, inOpeningPool } from '../src/world/habitat';
import { getStats } from '../src/world/simulation';

interface CaptureCli {
  options: CaptureEraOptions;
  out: string;
}

function parseArgs(argv: string[]): CaptureCli {
  let id = '';
  let name = '';
  let note = '';
  let seed = 1;
  let worldDays = 1;
  let visitorLight = false;
  let source = '';
  let out = '';

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--id' && value) id = argv[++i];
    else if (flag === '--name' && value) name = argv[++i];
    else if (flag === '--note' && value) note = argv[++i];
    else if (flag === '--seed' && value) seed = parseInt(argv[++i], 10) >>> 0;
    else if (flag === '--days' && value) worldDays = Number(argv[++i]);
    else if (flag === '--source' && value) source = argv[++i];
    else if (flag === '--out' && value) out = argv[++i];
    else if (flag === '--visitor-light') visitorLight = true;
    else if (flag === '--help' || flag === '-h') {
      console.log(`
Capture a reviewed named era snapshot.

Usage: npm run capture-era -- --id <slug> --name <title> --note <text> --days <n> --seed <n> --out <file>

Options:
  --id <slug>        Lowercase hyphenated id
  --name <title>     Display name
  --note <text>      Field note about the experiment
  --days <n>         World days to simulate (day = 360s)
  --seed <n>         World seed
  --source <text>    How the snapshot was made
  --out <file>       JSON path to write
  --visitor-light    Place one spring light each world day
`);
      process.exit(0);
    }
  }

  if (!id || !name || !note || !out || !Number.isFinite(worldDays) || worldDays <= 0) {
    console.error('Error: --id, --name, --note, --days and --out are required.');
    process.exit(1);
  }

  return {
    out,
    options: {
      id,
      name,
      note,
      seed,
      worldDays,
      visitorLight,
      source:
        source ||
        `createWorld(${seed}), ${worldDays} world day${worldDays === 1 ? '' : 's'} of stepWorld at 1/30 second; visitor light ${visitorLight ? 'on' : 'off'}.`,
    },
  };
}

function invokedAsCli(): boolean {
  const entry = process.argv[1] ?? '';
  return entry.endsWith('capture-era.ts') || entry.endsWith('capture-era');
}

if (invokedAsCli()) {
  const { options, out } = parseArgs(process.argv.slice(2));
  console.log(`Capturing era ${options.id}: ${options.worldDays} world days, seed ${options.seed}`);
  const started = performance.now();
  const { file, era } = captureNamedEra(options);
  const stats = getStats(era.world);
  const encoded = JSON.stringify(file);
  const checked = parseEraFile(encoded);
  if (!checked) {
    console.error('Error: captured file failed named-era validation.');
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, encoded);
  const inletPigment = era.world.sediment.reduce(
    (total, grain) => total + (inInletPool(grain.x, grain.y) ? grain.strength : 0),
    0,
  );
  const openingPigment = era.world.sediment.reduce(
    (total, grain) => total + (inOpeningPool(grain.x, grain.y) ? grain.strength : 0),
    0,
  );
  console.log(
    JSON.stringify(
      {
        out,
        bytes: encoded.length,
        wallMs: Math.round(performance.now() - started),
        elapsed: era.world.elapsed,
        lastSeenAt: era.world.lastSeenAt,
        lucents: stats.population,
        grazers: stats.grazers,
        skimmers: stats.skimmers,
        reedwells: stats.reedwells,
        rainbells: stats.rainbells,
        siltstitchers: stats.siltstitchers,
        glassLimpets: stats.glassLimpets,
        cargoMites: stats.cargoMites,
        marlgrubs: stats.marlgrubs,
        remains: stats.remains,
        fossils: stats.fossils,
        nestedPigment: stats.nestPigment,
        openingPigment,
        inletPigment,
      },
      null,
      2,
    ),
  );
}
