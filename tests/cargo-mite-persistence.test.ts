import { describe, expect, it } from 'vitest';
import { restoreWorld, serializeWorld } from '../src/world/persistence';
import { createWorld, stepWorld } from '../src/world/simulation';
import { isInPool, type World } from '../src/world/types';

function previousRevision(world: World): Record<string, any> {
  const previous = structuredClone(world) as Record<string, any>;
  previous.schemaRevision = 7;
  delete previous.cargoMites;
  delete previous.cargoMiteAdmissionAt;
  delete previous.cargoMiteCandidateAfterId;
  delete previous.ecologyLedger.cargoMiteIntake;
  delete previous.ecologyLedger.cargoMiteMaintenancePigment;
  return previous;
}

function hosted(): World {
  const world = createWorld(743);
  world.elapsed = 50;
  world.tick = 1500;
  const host = world.grazers[0];
  host.cargo = .7;
  host.returning = true;
  world.cargoMites.push({ id: world.nextId++, species: 'cargoMite', x: host.x, y: host.y,
    vx: host.vx, vy: host.vy, body: .1, reserve: .4, age: 0, hue: host.hue, starvedFor: 0,
    mode: 'attached', hostId: host.id, targetHostId: null, parentId: null, nextBirthAt: 80 });
  world.cargoMiteAdmissionAt = 110;
  world.cargoMiteCandidateAfterId = host.id;
  world.foundingTypeCursor = 5;
  return world;
}

describe('cargo mite snapshot revision', () => {
  it('migrates revision 7 without inventing mites, pigment, or altered historical state', () => {
    const before = createWorld(743);
    before.elapsed = 50; before.tick = 1500;
    const old = previousRevision(before);
    const source = JSON.stringify(old);
    const migrated = restoreWorld(source)!;
    expect(migrated).not.toBeNull();
    expect(migrated).toMatchObject({ schemaRevision: 8, cargoMites: [],
      cargoMiteAdmissionAt: old.elapsed, cargoMiteCandidateAfterId: 0,
      nextId: old.nextId, tick: old.tick, elapsed: old.elapsed,
      randomState: old.randomState, sediment: old.sediment,
      grazers: old.grazers, nests: old.nests });
    expect(migrated.ecologyLedger.cargoMiteIntake).toBe(0);
    expect(migrated.ecologyLedger.cargoMiteMaintenancePigment).toBe(0);
    expect(JSON.stringify(old)).toBe(source);
    expect(restoreWorld(serializeWorld(migrated))).toEqual(migrated);
  });

  it('continues hosted and seeking state from arbitrary simulation phases', () => {
    for (const offset of [0, 1, 4, 17]) {
      const world = hosted();
      for (let step = 0; step < offset; step++) stepWorld(world);
      const resumed = restoreWorld(serializeWorld(world))!;
      expect(resumed, `offset ${offset}`).not.toBeNull();
      expect(resumed).toEqual(world);
      for (let step = 0; step < 120; step++) { stepWorld(world); stepWorld(resumed); }
      expect(resumed).toEqual(world);
    }
  });

  it('restores an attached mite on a small grazer at its legal coast edge', () => {
    const world = hosted();
    const host = world.grazers[0];
    host.size = 7.5;
    let edge = 0;
    for (let x = 1200; x < 1400; x += .01) {
      if (isInPool(x, 500, host.size + 3) && !isInPool(x, 500, 11)) edge = x;
    }
    expect(edge).toBeGreaterThan(0);
    host.x = edge; host.y = 500;
    world.cargoMites[0].x = edge; world.cargoMites[0].y = 500;
    expect(restoreWorld(serializeWorld(world))).toEqual(world);
  });

  it('rejects malformed modes, references, host crowding, budgets and hybrid schema', () => {
    const edits: ((world: Record<string, any>) => void)[] = [
      w => { delete w.cargoMites; },
      w => { w.cargoMites[0].body = .2; },
      w => { w.cargoMites[0].reserve = .6; },
      w => { w.cargoMites[0].hostId = null; },
      w => { w.cargoMites[0].targetHostId = w.grazers[0].id; },
      w => { w.cargoMites[0].hostId = w.organisms[0].id; },
      w => { w.cargoMites[0].parentId = w.organisms[0].id; },
      w => { w.cargoMites[0].parentId = w.cargoMites[0].id; },
      w => { w.cargoMites[0].mode = 'seeking'; },
      w => { w.cargoMites[0].x += 50; },
      w => { w.cargoMites[0].vx += 1; },
      w => { w.cargoMites[0].age = w.elapsed + 1; },
      w => { w.cargoMites[0].nextBirthAt = w.elapsed; },
      w => { w.cargoMites[0].nextBirthAt = w.elapsed + 61; },
      w => { w.cargoMiteCandidateAfterId = w.nextId; },
      w => { w.cargoMiteAdmissionAt = w.elapsed + 61; },
      w => { w.cargoMites.push(...Array.from({ length: 4 }, () => ({ ...w.cargoMites[0], id: w.nextId++ }))); },
      w => { w.foundingTypeCursor = 6; },
      w => { delete w.ecologyLedger.cargoMiteIntake; },
      w => { w.schemaRevision = 7; },
    ];
    for (const edit of edits) {
      const world = hosted() as unknown as Record<string, any>;
      edit(world);
      expect(restoreWorld(JSON.stringify(world))).toBeNull();
    }
    const old = previousRevision(hosted());
    old.cargoMites = [];
    expect(restoreWorld(JSON.stringify(old))).toBeNull();
  });
});
