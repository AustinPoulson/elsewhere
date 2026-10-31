import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { World } from '../world/types';

interface ReedwellVisual {
  node: Container;
  glow: Sprite;
  leaves: Graphics;
  emission: Graphics;
}

/** Rooted silhouettes and short release rings; no particles or render history. */
export class ReedwellRenderer {
  private readonly visuals = new Map<number, ReedwellVisual>();

  constructor(
    private readonly layer: Container,
    private readonly glowTexture: Texture,
  ) {}

  render(world: World, reducedMotion: boolean): void {
    for (const plant of world.reedwells) {
      let visual = this.visuals.get(plant.id);
      if (!visual) {
        const node = new Container();
        const glow = new Sprite(this.glowTexture);
        glow.anchor.set(0.5);
        glow.blendMode = 'add';
        const leaves = new Graphics();
        const emission = new Graphics();
        node.addChild(glow, leaves, emission);
        this.layer.addChild(node);
        visual = { node, glow, leaves, emission };
        this.visuals.set(plant.id, visual);
      }
      visual.node.position.set(plant.x, plant.y);
      // Growth reveals the paid root's crown, without allocating another stage.
      const growth = 0.5 + 0.5 * Math.min(1, plant.age / 8);
      const charge = plant.lightStore / 3;
      const sway = reducedMotion ? 0 : Math.sin(world.elapsed * 0.8 + plant.id) * 0.06;
      visual.node.rotation = (plant.id % 7) * 0.3 + sway;
      visual.node.scale.set(growth);
      visual.glow.tint = 0xb7d98d;
      visual.glow.width = 84 + charge * 28;
      visual.glow.height = visual.glow.width;
      visual.glow.alpha = 0.1 + charge * 0.14;
      const leaves = visual.leaves.clear();
      for (let blade = 0; blade < 5; blade++) {
        const angle = (blade * Math.PI * 2) / 5;
        const length = 23 + (blade % 3) * 4;
        const x = Math.cos(angle),
          y = Math.sin(angle);
        const sideX = -y * 6,
          sideY = x * 6;
        leaves
          .moveTo(0, 0)
          .quadraticCurveTo(x * length * 0.42 + sideX, y * length * 0.42 + sideY, x * length, y * length)
          .quadraticCurveTo(x * length * 0.38 - sideX, y * length * 0.38 - sideY, 0, 0)
          .fill({ color: 0x80b88e, alpha: 0.48 + charge * 0.24 })
          .stroke({ color: 0xc3df9d, width: 0.9, alpha: 0.65 });
        leaves
          .moveTo(0, 0)
          .lineTo(x * length * 0.85, y * length * 0.85)
          .stroke({ color: 0xc6deb3, width: 0.65, alpha: 0.55 });
      }
      leaves.circle(0, 0, 3 + charge * 2).fill({ color: 0xf0e6ad, alpha: 0.55 + charge * 0.35 });
      const emission = visual.emission.clear();
      const releaseAge = plant.lastEmissionAt === null ? Infinity : world.elapsed - plant.lastEmissionAt;
      if (releaseAge >= 0 && releaseAge < 3 && !reducedMotion) {
        emission
          .circle(0, 0, 12 + releaseAge * 13)
          .stroke({ color: 0xe8edb1, width: 1.3, alpha: (1 - releaseAge / 3) * 0.65 });
      }
    }
    for (const [id, visual] of this.visuals) {
      if (!world.reedwells.some((plant) => plant.id === id)) {
        visual.node.destroy({ children: true });
        this.visuals.delete(id);
      }
    }
  }

  clear(): void {
    this.visuals.clear();
  }
}
