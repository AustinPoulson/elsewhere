import { MINERAL_SEAM } from '../world/environment/mineral-seam';
import { channelSegment, INLET_POOL, OPENING_POOL, poolCoastPoint } from '../world/habitat';
import { WORLD_HEIGHT, WORLD_WIDTH, type HabitatPool } from '../world/types';

const TAU = Math.PI * 2;

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function poolPoint(angle: number, scale = 1): { x: number; y: number } {
  return poolCoastPoint(OPENING_POOL, angle, scale);
}

function coastline(ctx: CanvasRenderingContext2D, scale = 1, depth = 0, pool: HabitatPool = OPENING_POOL): void {
  ctx.beginPath();
  const steps = pool.id === 1 ? 256 : 160;
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * TAU;
    const variation = depth * (Math.sin(angle * 4 + scale * 5) * 0.009 + Math.cos(angle * 7) * 0.005);
    const point = poolCoastPoint(pool, angle, scale + variation);
    if (i === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  }
  ctx.closePath();
}

function channelWater(ctx: CanvasRenderingContext2D, scale = 1): void {
  const link = channelSegment();
  const half = (link.width / 2) * scale;
  const nx = link.uy;
  const ny = -link.ux;
  const start = Math.atan2(ny, nx);
  ctx.beginPath();
  ctx.moveTo(link.ax + nx * half, link.ay + ny * half);
  ctx.lineTo(link.bx + nx * half, link.by + ny * half);
  ctx.arc(link.bx, link.by, half, start, start + Math.PI);
  ctx.lineTo(link.ax - nx * half, link.ay - ny * half);
  ctx.arc(link.ax, link.ay, half, start + Math.PI, start);
  ctx.closePath();
}

function canvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const source = document.createElement('canvas');
  source.width = width;
  source.height = height;
  const ctx = source.getContext('2d');
  if (!ctx) throw new Error('Your browser could not create the tidepool artwork.');
  return [source, ctx];
}

/** Static geology is baked once; none of its thousands of marks enter the frame loop. */
export function createTerrain(): HTMLCanvasElement {
  const [source, ctx] = canvas(WORLD_WIDTH, WORLD_HEIGHT);
  const random = seededRandom(710612);
  const background = ctx.createRadialGradient(680, 440, 200, 720, 500, 910);
  background.addColorStop(0, '#17302d');
  background.addColorStop(0.66, '#142623');
  background.addColorStop(1, '#071719');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Weathered, offset stone strata curl around the same shoreline as the simulation.
  for (let layer = 20; layer >= 0; layer--) {
    const scale = 1.014 + layer * 0.017;
    coastline(ctx, scale, layer / 20);
    ctx.strokeStyle = layer % 3 === 0 ? 'rgba(150,160,133,.105)' : 'rgba(91,121,105,.11)';
    ctx.lineWidth = layer % 4 === 0 ? 1.3 : 0.65;
    ctx.stroke();
  }

  // Small angular stones soften the regularity of the contour map.
  for (let stone = 0; stone < 125; stone++) {
    const angle = random() * TAU;
    const position = poolPoint(angle, 1.055 + random() * 0.32);
    const radius = 4 + random() * 19;
    ctx.save();
    ctx.translate(position.x, position.y);
    ctx.rotate(random() * TAU);
    ctx.beginPath();
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * TAU;
      const r = radius * (0.7 + random() * 0.35);
      const x = Math.cos(a) * r * 1.4;
      const y = Math.sin(a) * r * 0.7;
      if (j === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = `rgba(25,42,36,${0.15 + random() * 0.5})`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(137,150,119,.17)';
    ctx.lineWidth = 0.65;
    ctx.stroke();
    ctx.restore();
  }

  coastline(ctx);
  const water = ctx.createRadialGradient(650, 445, 70, 750, 510, 700);
  water.addColorStop(0, '#081d25');
  water.addColorStop(0.44, '#0b282d');
  water.addColorStop(0.8, '#153e3d');
  water.addColorStop(1, '#284c42');
  ctx.fillStyle = water;
  ctx.fill();

  ctx.save();
  coastline(ctx);
  ctx.clip();
  const veil = ctx.createLinearGradient(180, 0, 1060, 960);
  veil.addColorStop(0, 'rgba(99,145,114,.09)');
  veil.addColorStop(0.5, 'rgba(27,49,52,0)');
  veil.addColorStop(1, 'rgba(46,102,93,.06)');
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Submerged bathymetry: thin contours become quieter toward the deep center.
  for (let layer = 0; layer < 22; layer++) {
    const scale = 0.94 - layer * 0.0305;
    coastline(ctx, scale, (1 - scale) * 1.8);
    ctx.strokeStyle = `rgba(94,153,137,${0.025 + scale * 0.063})`;
    ctx.lineWidth = layer % 4 === 0 ? 0.85 : 0.5;
    ctx.stroke();
  }

  // Fine river-like threads lie just under the water, with occasional brighter knots.
  for (let strand = 0; strand < 36; strand++) {
    const x = 130 + random() * 1100;
    const y = 170 + random() * 670;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + 22, y - 7, x + 60, y + 12, x + 110 + random() * 70, y - 25);
    ctx.strokeStyle = 'rgba(114,176,147,.035)';
    ctx.lineWidth = 0.65;
    ctx.stroke();
  }
  for (let grain = 0; grain < 5500; grain++) {
    const x = random() * WORLD_WIDTH;
    const y = random() * WORLD_HEIGHT;
    ctx.fillStyle = grain % 5 === 0 ? 'rgba(177,180,127,.11)' : 'rgba(105,156,134,.07)';
    const radius = random() * 0.7 + 0.2;
    ctx.fillRect(x, y, radius, radius);
  }
  ctx.beginPath();
  ctx.moveTo(MINERAL_SEAM.ax, MINERAL_SEAM.ay);
  ctx.quadraticCurveTo(MINERAL_SEAM.x - 12, MINERAL_SEAM.y + 18, MINERAL_SEAM.bx, MINERAL_SEAM.by);
  ctx.strokeStyle = 'rgba(168,112,58,.28)';
  ctx.lineWidth = 5.5;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(196,138,74,.18)';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  for (let grain = 0; grain < 70; grain++) {
    const t = random();
    const x = MINERAL_SEAM.ax + (MINERAL_SEAM.bx - MINERAL_SEAM.ax) * t + (random() - 0.5) * 18;
    const y = MINERAL_SEAM.ay + (MINERAL_SEAM.by - MINERAL_SEAM.ay) * t + (random() - 0.5) * 10;
    ctx.fillStyle = `rgba(186,124,62,${0.12 + random() * 0.22})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.6 + random() * 1.4, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // The shore is a soft mineral seam, never a heavy outline.
  coastline(ctx, 1.001);
  ctx.strokeStyle = 'rgba(137,162,126,.33)';
  ctx.lineWidth = 1;
  ctx.stroke();
  coastline(ctx, 1.018);
  ctx.strokeStyle = 'rgba(130,146,119,.16)';
  ctx.lineWidth = 0.7;
  ctx.stroke();
  for (let grain = 0; grain < 2400; grain++) {
    const angle = random() * TAU;
    const distance = 1.006 + Math.pow(random(), 2.7) * 0.19;
    const position = poolPoint(angle, distance);
    const size = 0.25 + random() * 1.15;
    ctx.fillStyle = `rgba(202,190,147,${0.08 + random() * 0.27})`;
    ctx.beginPath();
    ctx.arc(position.x, position.y, size, 0, TAU);
    ctx.fill();
  }

  // A few quiet vein formations give the geology a hand-drawn character.
  for (let formation = 0; formation < 14; formation++) {
    const a = random() * TAU;
    const position = poolPoint(a, 1.08 + random() * 0.12);
    for (let branch = 0; branch < 5; branch++) {
      const length = 12 + random() * 25;
      const direction = a + (branch - 2) * 0.3;
      ctx.beginPath();
      ctx.moveTo(position.x, position.y);
      ctx.quadraticCurveTo(
        position.x + Math.cos(direction - 0.15) * length * 0.6,
        position.y + Math.sin(direction - 0.15) * length * 0.6,
        position.x + Math.cos(direction) * length,
        position.y + Math.sin(direction) * length,
      );
      ctx.lineWidth = 0.55;
      ctx.strokeStyle = 'rgba(181,158,112,.19)';
      ctx.stroke();
    }
  }

  for (let layer = 12; layer >= 0; layer--) {
    const scale = 1.014 + layer * 0.017;
    coastline(ctx, scale, layer / 20, INLET_POOL);
    ctx.strokeStyle = layer % 3 === 0 ? 'rgba(150,160,133,.09)' : 'rgba(91,121,105,.1)';
    ctx.lineWidth = layer % 4 === 0 ? 1.1 : 0.55;
    ctx.stroke();
  }
  for (let stone = 0; stone < 40; stone++) {
    const angle = random() * TAU;
    const position = poolCoastPoint(INLET_POOL, angle, 1.055 + random() * 0.32);
    const radius = 3 + random() * 14;
    ctx.save();
    ctx.translate(position.x, position.y);
    ctx.rotate(random() * TAU);
    ctx.beginPath();
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * TAU;
      const r = radius * (0.7 + random() * 0.35);
      const x = Math.cos(a) * r * 1.4;
      const y = Math.sin(a) * r * 0.7;
      if (j === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = `rgba(25,42,36,${0.15 + random() * 0.5})`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(137,150,119,.15)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.restore();
  }

  const inletWater = ctx.createRadialGradient(730, 1240, 40, 760, 1290, 320);
  inletWater.addColorStop(0, '#071a22');
  inletWater.addColorStop(0.55, '#0c2a2f');
  inletWater.addColorStop(1, '#1d403c');
  channelWater(ctx);
  ctx.fillStyle = inletWater;
  ctx.fill();
  coastline(ctx, 1, 0, INLET_POOL);
  ctx.fillStyle = inletWater;
  ctx.fill();

  ctx.save();
  coastline(ctx, 1, 0, INLET_POOL);
  ctx.clip();
  for (let layer = 0; layer < 12; layer++) {
    const scale = 0.92 - layer * 0.042;
    coastline(ctx, scale, (1 - scale) * 1.8, INLET_POOL);
    ctx.strokeStyle = `rgba(94,153,137,${0.02 + scale * 0.055})`;
    ctx.lineWidth = layer % 4 === 0 ? 0.8 : 0.45;
    ctx.stroke();
  }
  for (let grain = 0; grain < 1600; grain++) {
    const x = INLET_POOL.x - 280 + random() * 560;
    const y = INLET_POOL.y - 220 + random() * 440;
    ctx.fillStyle = grain % 5 === 0 ? 'rgba(177,180,127,.1)' : 'rgba(105,156,134,.06)';
    ctx.fillRect(x, y, random() * 0.7 + 0.2, random() * 0.7 + 0.2);
  }
  ctx.restore();

  coastline(ctx, 1.001, 0, INLET_POOL);
  ctx.strokeStyle = 'rgba(137,162,126,.3)';
  ctx.lineWidth = 1;
  ctx.stroke();
  coastline(ctx, 1.018, 0, INLET_POOL);
  ctx.strokeStyle = 'rgba(130,146,119,.14)';
  ctx.lineWidth = 0.7;
  ctx.stroke();
  for (let grain = 0; grain < 800; grain++) {
    const angle = random() * TAU;
    const position = poolCoastPoint(INLET_POOL, angle, 1.006 + Math.pow(random(), 2.7) * 0.19);
    ctx.fillStyle = `rgba(202,190,147,${0.08 + random() * 0.24})`;
    ctx.beginPath();
    ctx.arc(position.x, position.y, 0.25 + random() * 1.1, 0, TAU);
    ctx.fill();
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, WORLD_WIDTH, 1040);
  ctx.clip();
  const vignette = ctx.createRadialGradient(720, 480, 350, 720, 480, 780);
  vignette.addColorStop(0, 'rgba(2,13,16,0)');
  vignette.addColorStop(1, 'rgba(2,13,16,.47)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WORLD_WIDTH, 1040);
  ctx.restore();
  const inletVignette = ctx.createRadialGradient(745, 1260, 90, 745, 1275, 420);
  inletVignette.addColorStop(0, 'rgba(2,13,16,0)');
  inletVignette.addColorStop(1, 'rgba(2,13,16,.34)');
  ctx.fillStyle = inletVignette;
  ctx.fillRect(400, 1040, 700, 520);

  // Fade into the renderer clear color on every edge, including portrait letterboxing.
  const fade = 80;
  const edges = [
    { from: [0, 0], to: [fade, 0], rect: [0, 0, fade, WORLD_HEIGHT] },
    { from: [WORLD_WIDTH, 0], to: [WORLD_WIDTH - fade, 0], rect: [WORLD_WIDTH - fade, 0, fade, WORLD_HEIGHT] },
    { from: [0, 0], to: [0, fade], rect: [0, 0, WORLD_WIDTH, fade] },
    { from: [0, WORLD_HEIGHT], to: [0, WORLD_HEIGHT - fade], rect: [0, WORLD_HEIGHT - fade, WORLD_WIDTH, fade] },
  ];
  for (const edge of edges) {
    const gradient = ctx.createLinearGradient(edge.from[0], edge.from[1], edge.to[0], edge.to[1]);
    gradient.addColorStop(0, '#071719');
    gradient.addColorStop(1, 'rgba(7,23,25,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(edge.rect[0], edge.rect[1], edge.rect[2], edge.rect[3]);
  }
  return source;
}

export function createBloom(): HTMLCanvasElement {
  const [source, ctx] = canvas(128, 128);
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,.95)');
  gradient.addColorStop(0.12, 'rgba(255,255,255,.62)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,.23)');
  gradient.addColorStop(0.65, 'rgba(255,255,255,.045)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return source;
}

export function createBody(): HTMLCanvasElement {
  const [source, ctx] = canvas(128, 128);
  const fill = ctx.createRadialGradient(64, 52, 1, 64, 64, 47);
  fill.addColorStop(0, 'rgba(255,255,255,.7)');
  fill.addColorStop(0.3, 'rgba(240,255,245,.25)');
  fill.addColorStop(0.85, 'rgba(255,255,255,.025)');
  fill.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(64, 60, 34, 43, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(231,255,241,.37)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(64, 60, 30, 38, 0, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(240,255,244,.21)';
  for (let vein = 0; vein < 7; vein++) {
    const a = (vein / 7) * TAU;
    ctx.beginPath();
    ctx.moveTo(64, 58);
    ctx.quadraticCurveTo(
      64 + Math.sin(a + 0.3) * 11,
      60 + Math.cos(a + 0.3) * 16,
      64 + Math.sin(a) * 28,
      60 + Math.cos(a) * 35,
    );
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,241,.95)';
  ctx.beginPath();
  ctx.arc(64, 54, 3.3, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(247,255,230,.6)';
  ctx.beginPath();
  ctx.arc(60, 65, 1.2, 0, TAU);
  ctx.arc(67, 69, 1, 0, TAU);
  ctx.fill();
  return source;
}
