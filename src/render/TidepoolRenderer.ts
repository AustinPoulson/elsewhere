import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import {
  GRAZER_CAPACITY, NEST_CAPACITY, WORLD_HEIGHT, WORLD_WIDTH, isInPool,
  type Point, type Tool, type World,
} from '../world/types';
import { createBloom, createBody, createTerrain, poolPoint } from './terrain';
import { fitHabitatCamera, viewportToWorld, type HabitatCamera } from './camera';
import { CALM_LIGHT_REACH, getLightReach, getWeather } from '../world/weather';

interface SpriteVisual {
  sprite: Sprite;
  frame: number;
}

interface OrganismVisual {
  node: Container;
  glow: Sprite;
  body: Sprite;
  frame: number;
}

interface GrazerVisual {
  node: Container;
  glow: Sprite;
  limbs: Graphics;
  payload: Sprite;
  cargo: Graphics;
  cargoBucket: number;
  cargoHue: number;
  frame: number;
}

interface NestVisual {
  node: Container;
  glow: Sprite;
  weaving: Graphics;
  pigmentBucket: number;
  pigmentHue: number;
  frame: number;
}

const TAU = Math.PI * 2;
const RAIN_RING_COUNT = 48;

function hueColor(hue: number, saturation = 0.38, lightness = 0.68): number {
  const h = ((hue % 360) + 360) % 360 / 360;
  const channel = (n: number) => {
    const k = (n + h * 12) % 12;
    return Math.round((lightness - saturation * Math.min(lightness, 1 - lightness)
      * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255);
  };
  return (channel(0) << 16) | (channel(8) << 8) | channel(4);
}

/** Pixi owns presentation only. All positions and behavior belong to the world model. */
export class TidepoolRenderer {
  private readonly root = new Container();
  private readonly water = new Container();
  private readonly sedimentLayer = new Container();
  private readonly nestLayer = new Container();
  private readonly lightLayer = new Container();
  private readonly organismLayer = new Container();
  private readonly grazerLayer = new Container();
  private readonly tendrils = new Graphics();
  private readonly trails = new Graphics();
  private readonly caustics = new Graphics();
  private readonly rain = new Graphics();
  private readonly indicator = new Graphics();
  private readonly mask = new Graphics();
  private readonly sediments = new Map<number, SpriteVisual>();
  private readonly lights = new Map<number, SpriteVisual>();
  private readonly organisms = new Map<number, OrganismVisual>();
  private readonly grazers = new Map<number, GrazerVisual>();
  private readonly nests = new Map<number, NestVisual>();
  private readonly textures: Texture[] = [];
  private readonly glowTexture: Texture;
  private readonly bodyTexture: Texture;
  private readonly resizeObserver: ResizeObserver;
  private readonly colors = new Map<number, number>();
  private reducedMotion = false;
  private destroyed = false;
  private frame = 0;
  private camera: HabitatCamera = fitHabitatCamera(WORLD_WIDTH, WORLD_HEIGHT);

  private constructor(private readonly app: Application, private readonly host: HTMLElement) {
    const terrainTexture = Texture.from(createTerrain());
    this.glowTexture = Texture.from(createBloom());
    this.bodyTexture = Texture.from(createBody());
    this.textures.push(terrainTexture, this.glowTexture, this.bodyTexture);
    this.app.canvas.style.display = 'block';
    this.app.canvas.style.pointerEvents = 'none';
    this.app.canvas.setAttribute('aria-hidden', 'true');
    this.app.stage.eventMode = 'none';
    this.app.stage.addChild(this.root);
    this.root.addChild(new Sprite(terrainTexture));

    for (let i = 0; i <= 256; i++) {
      const point = poolPoint(i / 256 * TAU);
      if (i === 0) this.mask.moveTo(point.x, point.y);
      else this.mask.lineTo(point.x, point.y);
    }
    this.mask.closePath().fill(0xffffff);
    this.root.addChild(this.water, this.mask);
    this.water.mask = this.mask;
    this.water.addChild(this.sedimentLayer, this.nestLayer, this.caustics, this.trails, this.lightLayer,
      this.tendrils, this.organismLayer, this.grazerLayer, this.rain, this.indicator);
    this.caustics.blendMode = 'add';
    this.trails.blendMode = 'add';
    this.tendrils.blendMode = 'add';
    this.rain.blendMode = 'add';
    this.host.appendChild(this.app.canvas);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.host);
    this.resize();
  }

  static async create(host: HTMLElement): Promise<TidepoolRenderer> {
    const app = new Application();
    try {
      await app.init({
        width: Math.max(1, host.clientWidth),
        height: Math.max(1, host.clientHeight),
        resolution: Math.min(window.devicePixelRatio || 1, 1.75),
        autoDensity: true,
        antialias: true,
        backgroundColor: 0x071719,
        autoStart: false,
        sharedTicker: false,
        preference: 'webgl',
        powerPreference: 'low-power',
      });
      return new TidepoolRenderer(app, host);
    } catch (error) {
      if (app.renderer) app.destroy({ removeView: true }, { children: true });
      const detail = error instanceof Error ? error.message : 'Unknown graphics error';
      throw new Error(`The tidepool could not start its graphics renderer. Check that WebGL and hardware acceleration are available in your browser. ${detail}`);
    }
  }

  setReducedMotion(value: boolean): void {
    this.reducedMotion = value;
  }

  screenToWorld(clientX: number, clientY: number): Point {
    const bounds = this.host.getBoundingClientRect();
    return viewportToWorld(this.camera, { x: clientX - bounds.left, y: clientY - bounds.top });
  }

  private resize(): void {
    if (this.destroyed) return;
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.app.renderer.resize(width, height);
    this.camera = fitHabitatCamera(width, height);
    this.root.pivot.set(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    this.root.position.set(this.camera.x, this.camera.y);
    this.root.scale.set(this.camera.scale);
    this.root.rotation = this.camera.rotation;
    this.app.render();
  }

  private color(hue: number): number {
    const rounded = ((Math.round(hue) % 360) + 360) % 360;
    let color = this.colors.get(rounded);
    if (color === undefined) {
      color = hueColor(rounded);
      this.colors.set(rounded, color);
    }
    return color;
  }

  private glow(layer: Container): Sprite {
    const sprite = new Sprite(this.glowTexture);
    sprite.anchor.set(0.5);
    sprite.blendMode = 'add';
    layer.addChild(sprite);
    return sprite;
  }

  render(world: World, selectedId: number | null, cursor: Point | null, tool: Tool): void {
    if (this.destroyed) return;
    this.frame++;
    const time = this.reducedMotion ? 0 : world.elapsed;
    const weather = getWeather(world.elapsed);
    const lightReachScale = getLightReach(world.elapsed) / CALM_LIGHT_REACH;
    this.drawWater(time);
    this.drawRain(world.elapsed, weather.intensity);
    this.trails.clear();
    this.tendrils.clear();
    this.indicator.clear();

    for (const sediment of world.sediment) {
      let visual = this.sediments.get(sediment.id);
      if (!visual) {
        visual = { sprite: this.glow(this.sedimentLayer), frame: this.frame };
        this.sediments.set(sediment.id, visual);
      }
      visual.frame = this.frame;
      visual.sprite.position.set(sediment.x, sediment.y);
      visual.sprite.tint = this.color(sediment.hue);
      const diameter = Math.max(8, sediment.radius * 12);
      visual.sprite.width = diameter;
      visual.sprite.height = diameter * 0.8;
      visual.sprite.rotation = sediment.id * 2.39996;
      visual.sprite.alpha = Math.min(0.31, sediment.strength * 0.35);
    }
    this.pruneSprites(this.sediments);
    this.drawNests(world);

    for (const light of world.lights) {
      let visual = this.lights.get(light.id);
      if (!visual) {
        visual = { sprite: this.glow(this.lightLayer), frame: this.frame };
        this.lights.set(light.id, visual);
      }
      visual.frame = this.frame;
      const remaining = Math.max(0, Math.min(1, light.energy / light.initialEnergy));
      const breath = 1 + Math.sin(time * 1.2 + light.id) * 0.04;
      visual.sprite.position.set(light.x, light.y);
      visual.sprite.width = (46 + remaining * 51) * breath * lightReachScale;
      visual.sprite.height = visual.sprite.width;
      visual.sprite.tint = 0xefdb9d;
      visual.sprite.alpha = 0.12 + remaining * 0.53;
      this.indicator.circle(light.x, light.y, 1.15 + remaining * 0.65)
        .fill({ color: 0xf4e8b7, alpha: 0.45 + remaining * 0.45 });
      if (light.age < 2.8 && !this.reducedMotion) {
        const progress = light.age / 2.8;
        this.indicator.circle(light.x, light.y, 5 + progress * 39)
          .stroke({ width: 0.65, color: 0xcdceaa, alpha: (1 - progress) * 0.23 });
      }
    }
    this.pruneSprites(this.lights);

    for (const organism of world.organisms) {
      let visual = this.organisms.get(organism.id);
      if (!visual) {
        const node = new Container();
        const glow = this.glow(node);
        const body = new Sprite(this.bodyTexture);
        body.anchor.set(0.5);
        body.blendMode = 'add';
        node.addChild(body);
        this.organismLayer.addChild(node);
        visual = { node, glow, body, frame: this.frame };
        this.organisms.set(organism.id, visual);
      }
      visual.frame = this.frame;
      const color = this.color(organism.hue);
      const size = organism.size;
      const phase = this.reducedMotion ? organism.id * 2.4 : organism.phase;
      const breath = 1 + Math.sin(time * 1.8 + phase) * 0.065;
      const direction = Math.atan2(organism.vy, organism.vx) + Math.PI / 2;
      visual.node.position.set(organism.x, organism.y);
      visual.node.rotation = direction;
      visual.glow.tint = color;
      visual.glow.width = size * 15 * breath;
      visual.glow.height = size * 15 * breath;
      visual.glow.alpha = 0.13 + Math.min(1, organism.energy / 2) * 0.1;
      visual.body.tint = color;
      visual.body.width = size * 5 * breath;
      visual.body.height = size * 5 / breath;
      visual.body.alpha = 0.72 + Math.min(1, organism.energy / 2) * 0.22;

      // Trails are tiny bounded histories owned by the simulation, never a growing render log.
      if (organism.trail.length > 1) {
        const first = organism.trail[0];
        this.trails.moveTo(first.x, first.y);
        for (let j = 1; j < organism.trail.length; j++) {
          const point = organism.trail[j];
          this.trails.lineTo(point.x, point.y);
        }
        this.trails.stroke({ color, width: size * 0.42, alpha: 0.06 });
      }

      const cos = Math.cos(direction);
      const sin = Math.sin(direction);
      for (let tendril = 0; tendril < 6; tendril++) {
        const spread = (tendril - 2.5) * size * 0.34;
        const length = size * (2.0 + Math.sin(phase + tendril * 2) * 0.4);
        const localY = size * 0.75;
        const x = organism.x + spread * cos - localY * sin;
        const y = organism.y + spread * sin + localY * cos;
        this.tendrils.moveTo(x, y);
        for (let segment = 1; segment <= 5; segment++) {
          const progress = segment / 5;
          const wave = Math.sin(time * 1.6 + phase - progress * 4 + tendril * 0.75);
          const tx = spread + wave * size * 0.32 * progress;
          const ty = localY + length * progress;
          this.tendrils.lineTo(organism.x + tx * cos - ty * sin, organism.y + tx * sin + ty * cos);
        }
        this.tendrils.stroke({ color, width: 0.65, alpha: 0.32 });
      }
      if (organism.id === selectedId) {
        this.drawSelection(organism, size * 3 + 6);
      }
    }
    for (const [id, visual] of this.organisms) {
      if (visual.frame !== this.frame) {
        visual.node.destroy({ children: true });
        this.organisms.delete(id);
      }
    }
    this.drawGrazers(world, selectedId, time);

    if (cursor && isInPool(cursor.x, cursor.y)) {
      const radius = tool === 'light' ? 18 : 10;
      this.indicator.circle(cursor.x, cursor.y, radius)
        .stroke({ color: tool === 'light' ? 0xdccfa7 : 0xa6c5b5, alpha: 0.45, width: 0.75 });
      this.indicator.circle(cursor.x, cursor.y, 1.2).fill({ color: 0xe3dbbe, alpha: 0.6 });
    }
    this.app.render();
  }

  private drawSelection(point: Point, radius: number): void {
    for (let arc = 0; arc < 4; arc++) {
      const start = arc * Math.PI / 2 + 0.18;
      this.indicator.moveTo(point.x + Math.cos(start) * radius, point.y + Math.sin(start) * radius)
        .arc(point.x, point.y, radius, start, start + 0.47)
        .stroke({ color: 0xe1d7b4, alpha: 0.72, width: 1 });
    }
  }

  private drawNests(world: World): void {
    for (const nest of world.nests) {
      let visual = this.nests.get(nest.id);
      if (!visual) {
        const node = new Container();
        const glow = this.glow(node);
        const weaving = new Graphics();
        node.addChild(weaving);
        this.nestLayer.addChild(node);
        visual = { node, glow, weaving, pigmentBucket: -1, pigmentHue: -1, frame: this.frame };
        this.nests.set(nest.id, visual);
      }
      visual.frame = this.frame;
      visual.node.position.set(nest.x, nest.y);
      const fill = Math.min(1, Math.max(0, nest.pigment / NEST_CAPACITY));
      const hue = Math.round(nest.hue);
      const bucket = Math.ceil(nest.pigment * 20);
      visual.glow.tint = this.color(hue);
      visual.glow.width = 86 + fill * 64;
      visual.glow.height = visual.glow.width * 0.76;
      visual.glow.alpha = fill * 0.16;
      // Deposits change the weaving; elapsed time does not grow a graphics history.
      if (bucket !== visual.pigmentBucket || hue !== visual.pigmentHue) {
        visual.pigmentBucket = bucket;
        visual.pigmentHue = hue;
        const weaving = visual.weaving.clear();
        for (let segment = 0; segment <= 48; segment++) {
          const angle = segment / 48 * TAU;
          const radius = 23 + Math.sin(angle * 5 + nest.id) * 1.1;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius * 0.72;
          if (segment === 0) weaving.moveTo(x, y);
          else weaving.lineTo(x, y);
        }
        weaving.closePath().stroke({ color: 0xb49d73, width: 0.8, alpha: 0.46 });
        for (let fleck = 0; fleck < 12; fleck++) {
          const angle = fleck / 12 * TAU + nest.id;
          weaving.circle(Math.cos(angle) * 23, Math.sin(angle) * 16.5, 0.55)
            .fill({ color: 0xd3b984, alpha: 0.45 });
        }
        if (fill > 0) {
          const rings = Math.min(7, Math.ceil(fill * 7));
          for (let ring = 0; ring < rings; ring++) {
            const radius = 19.5 - ring * 2.75;
            const color = this.color(hue + Math.sin(ring * 1.7 + nest.id) * 13);
            for (let segment = 0; segment <= 48; segment++) {
              const angle = segment / 48 * TAU;
              const woven = radius + Math.sin(angle * 9 + ring * 2) * 0.65;
              const x = Math.cos(angle) * woven;
              const y = Math.sin(angle) * woven * 0.72;
              if (segment === 0) weaving.moveTo(x, y);
              else weaving.lineTo(x, y);
            }
            weaving.closePath().stroke({ color, width: 1.15, alpha: 0.66 });
            for (let knot = 0; knot < 8; knot++) {
              const angle = knot / 8 * TAU + ring * 0.36;
              weaving.circle(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.72, 0.8)
                .fill({ color, alpha: 0.73 });
            }
          }
          weaving.ellipse(0, 0, 3 + fill * 4, 2 + fill * 3)
            .fill({ color: this.color(hue), alpha: 0.22 + fill * 0.24 });
        }
      }
    }
    for (const [id, visual] of this.nests) {
      if (visual.frame !== this.frame) {
        visual.node.destroy({ children: true });
        this.nests.delete(id);
      }
    }
  }

  private createGrazer(): GrazerVisual {
    const node = new Container();
    const glow = this.glow(node);
    const limbs = new Graphics();
    const shell = new Graphics();
    node.addChild(limbs, shell);
    // This amber shell is fixed art in local units, independent of collected pigment hue.
    shell.ellipse(0.86, 0, 0.85, 0.47).fill({ color: 0x786b46, alpha: 0.88 })
      .stroke({ color: 0xc3ae7b, alpha: 0.37, width: 0.045 });
    shell.ellipse(-0.13, -0.07, 1.18, 1.01).fill({ color: 0x66533a, alpha: 0.94 })
      .stroke({ color: 0xcfb183, alpha: 0.68, width: 0.07 });
    shell.ellipse(-0.2, -0.16, 0.96, 0.79).fill({ color: 0x9b8150, alpha: 0.27 });
    for (let groove = 0; groove < 15; groove++) {
      const angle = groove / 15 * TAU;
      shell.moveTo(-0.13 + Math.cos(angle) * 0.96, -0.07 + Math.sin(angle) * 0.8)
        .lineTo(-0.13 + Math.cos(angle + 0.04) * 1.16, -0.07 + Math.sin(angle + 0.04) * 0.99)
        .stroke({ color: 0xd2b785, width: 0.025, alpha: 0.31 });
    }
    for (let segment = 0; segment <= 64; segment++) {
      const progress = segment / 64;
      const angle = progress * TAU * 2.35;
      const radius = 0.035 + progress * 0.87;
      const x = -0.16 + Math.cos(angle) * radius;
      const y = -0.1 + Math.sin(angle) * radius * 0.83;
      if (segment === 0) shell.moveTo(x, y);
      else shell.lineTo(x, y);
    }
    shell.stroke({ color: 0xe0c48d, width: 0.055, alpha: 0.83 });
    shell.circle(-0.16, -0.1, 0.07).fill({ color: 0xf0d89f, alpha: 0.78 });
    const payload = this.glow(node);
    payload.position.set(-0.6, 0.54);
    const cargo = new Graphics();
    node.addChild(cargo);
    this.grazerLayer.addChild(node);
    return { node, glow, limbs, payload, cargo, cargoBucket: -1, cargoHue: -1, frame: this.frame };
  }

  private drawGrazers(world: World, selectedId: number | null, time: number): void {
    for (const grazer of world.grazers) {
      let visual = this.grazers.get(grazer.id);
      if (!visual) {
        visual = this.createGrazer();
        this.grazers.set(grazer.id, visual);
      }
      visual.frame = this.frame;
      visual.node.position.set(grazer.x, grazer.y);
      visual.node.rotation = Math.atan2(grazer.vy, grazer.vx);
      // A broader shell silhouette stays distinguishable from lucents at portrait scale.
      visual.node.scale.set(grazer.size * 1.3);
      visual.glow.tint = 0xb89a62;
      visual.glow.width = 7.5;
      visual.glow.height = 6;
      visual.glow.alpha = 0.13;
      const phase = this.reducedMotion ? grazer.id * 2.4 : grazer.phase;
      const limbs = visual.limbs.clear();
      for (let leg = 0; leg < 3; leg++) {
        const x = (leg - 1) * 0.68;
        const crawl = Math.sin(time * 3.5 + phase + leg * 1.8) * 0.15;
        for (const side of [-1, 1]) {
          limbs.moveTo(x, side * 0.7)
            .quadraticCurveTo(x - 0.13 + crawl, side * 1.1, x - 0.31 + crawl, side * 1.26)
            .stroke({ color: 0xb7a074, width: 0.05, alpha: 0.48 });
        }
      }
      for (const side of [-1, 1]) {
        const sway = Math.sin(time * 0.9 + phase + side) * 0.05;
        limbs.moveTo(1.23, side * 0.22)
          .quadraticCurveTo(1.65, side * 0.42, 1.88, side * (0.48 + sway))
          .stroke({ color: 0xd6bd88, width: 0.045, alpha: 0.64 });
      }

      const load = Math.min(1, Math.max(0, grazer.cargo / GRAZER_CAPACITY));
      const hue = Math.round(grazer.hue);
      const cargoBucket = load > 0 ? Math.ceil(load * 16) : 0;
      visual.payload.visible = load > 0;
      visual.payload.tint = this.color(hue);
      visual.payload.width = 3.3 + load;
      visual.payload.height = 2.5 + load * 0.7;
      visual.payload.alpha = 0.13 + load * 0.17;
      if (cargoBucket !== visual.cargoBucket || hue !== visual.cargoHue) {
        visual.cargoBucket = cargoBucket;
        visual.cargoHue = hue;
        visual.cargo.clear();
        if (load > 0) {
          const color = this.color(hue);
          visual.cargo.ellipse(-0.6, 0.54, 0.67, 0.36).fill({ color, alpha: 0.68 });
          const granules = Math.ceil(load * 6);
          for (let bead = 0; bead < granules; bead++) {
            const angle = bead * 2.39996;
            const radius = bead === 0 ? 0 : 0.21 + bead * 0.045;
            visual.cargo.circle(-0.6 + Math.cos(angle) * radius, 0.54 + Math.sin(angle) * radius * 0.64, 0.13)
              .fill({ color, alpha: 0.94 }).stroke({ color: 0xe8dbc1, alpha: 0.32, width: 0.025 });
          }
        }
      }
      if (grazer.id === selectedId) this.drawSelection(grazer, grazer.size * 3 + 7);
    }
    for (const [id, visual] of this.grazers) {
      if (visual.frame !== this.frame) {
        visual.node.destroy({ children: true });
        this.grazers.delete(id);
      }
    }
  }

  private drawWater(time: number): void {
    this.caustics.clear();
    for (let ribbon = 0; ribbon < 13; ribbon++) {
      const x = 210 + (ribbon * 173) % 1000;
      const y = 190 + (ribbon * 127) % 640;
      this.caustics.moveTo(x, y);
      for (let segment = 1; segment <= 9; segment++) {
        const offset = segment * 16;
        const wave = Math.sin(time * 0.16 + ribbon + segment * 0.42);
        this.caustics.lineTo(x + offset, y - offset * 0.24 + wave * 7);
      }
      this.caustics.stroke({ color: 0x7bb79c, width: 0.6, alpha: 0.045 + Math.sin(time * 0.3 + ribbon) * 0.015 });
    }
  }

  private drawRain(elapsed: number, intensity: number): void {
    this.rain.clear();
    this.rain.visible = intensity > 0;
    if (intensity <= 0) return;
    const time = this.reducedMotion ? 0 : elapsed;
    // A fixed set of slots replaces each ring after it fades; there is no particle history.
    for (let ring = 0; ring < RAIN_RING_COUNT; ring++) {
      const duration = 2.6 + (ring % 7) * 0.17;
      const phase = time / duration + ring * 0.61803398875;
      const cycle = Math.floor(phase);
      const progress = phase - cycle;
      const angle = ring * 2.3999632297 + cycle * 0.73;
      const distribution = (ring * 0.41421356237 + cycle * 0.61803398875) % 1;
      const position = poolPoint(angle, Math.sqrt(distribution) * 0.94);
      const radius = 3 + progress * (18 + (ring % 6) * 3);
      const alpha = intensity * Math.sin(progress * Math.PI) * 0.26;
      this.rain.circle(position.x, position.y, radius)
        .stroke({ color: 0xb2cbc0, width: 1.05, alpha });
    }
    // Reduced motion keeps these positions and radii fixed while weather still changes reach.
  }

  private pruneSprites(map: Map<number, SpriteVisual>): void {
    for (const [id, visual] of map) {
      if (visual.frame !== this.frame) {
        visual.sprite.destroy();
        map.delete(id);
      }
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.resizeObserver.disconnect();
    this.app.destroy({ removeView: true }, { children: true });
    for (const texture of this.textures) texture.destroy(true);
    this.sediments.clear();
    this.lights.clear();
    this.organisms.clear();
    this.grazers.clear();
    this.nests.clear();
    this.colors.clear();
  }
}
