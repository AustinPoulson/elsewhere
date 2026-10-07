import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { WORLD_HEIGHT, WORLD_WIDTH, isInPool, type Point, type Tool, type World } from '../world/types';
import { createBloom, createBody, createTerrain, poolPoint } from './terrain';
import { fitHabitatCamera, viewportToWorld, type HabitatCamera } from './camera';

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

const TAU = Math.PI * 2;

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
  private readonly lightLayer = new Container();
  private readonly organismLayer = new Container();
  private readonly tendrils = new Graphics();
  private readonly trails = new Graphics();
  private readonly caustics = new Graphics();
  private readonly indicator = new Graphics();
  private readonly mask = new Graphics();
  private readonly sediments = new Map<number, SpriteVisual>();
  private readonly lights = new Map<number, SpriteVisual>();
  private readonly organisms = new Map<number, OrganismVisual>();
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
    this.water.addChild(this.sedimentLayer, this.caustics, this.trails, this.lightLayer,
      this.tendrils, this.organismLayer, this.indicator);
    this.caustics.blendMode = 'add';
    this.trails.blendMode = 'add';
    this.tendrils.blendMode = 'add';
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
    this.drawWater(time);
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
      visual.sprite.width = (46 + remaining * 51) * breath;
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
        const radius = size * 3 + 6;
        for (let arc = 0; arc < 4; arc++) {
          const start = arc * Math.PI / 2 + 0.18;
          this.indicator.moveTo(organism.x + Math.cos(start) * radius, organism.y + Math.sin(start) * radius)
            .arc(organism.x, organism.y, radius, start, start + 0.47)
            .stroke({ color: 0xe1d7b4, alpha: 0.72, width: 1 });
        }
      }
    }
    for (const [id, visual] of this.organisms) {
      if (visual.frame !== this.frame) {
        visual.node.destroy({ children: true });
        this.organisms.delete(id);
      }
    }

    if (cursor && isInPool(cursor.x, cursor.y)) {
      const radius = tool === 'light' ? 18 : 10;
      this.indicator.circle(cursor.x, cursor.y, radius)
        .stroke({ color: tool === 'light' ? 0xdccfa7 : 0xa6c5b5, alpha: 0.45, width: 0.75 });
      this.indicator.circle(cursor.x, cursor.y, 1.2).fill({ color: 0xe3dbbe, alpha: 0.6 });
    }
    this.app.render();
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
    this.colors.clear();
  }
}
