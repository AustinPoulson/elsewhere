import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { World } from '../world/types';
import { appearanceGlow, appearanceScale } from '../world/traits';

interface GrubVisual {
  node: Container;
  glow: Sprite;
  body: Graphics;
}

export class MarlgrubRenderer {
  private readonly visuals = new Map<number, GrubVisual>();

  constructor(
    private readonly layer: Container,
    private readonly glowTexture: Texture,
  ) {}

  render(world: World): void {
    for (const grub of world.marlgrubs) {
      let visual = this.visuals.get(grub.id);
      if (!visual) {
        const node = new Container();
        const glow = new Sprite(this.glowTexture);
        glow.anchor.set(0.5);
        glow.blendMode = 'add';
        const body = new Graphics();
        body
          .ellipse(0, 2, 9, 6)
          .fill({ color: 0x5a4634, alpha: 0.94 })
          .stroke({ color: 0xcbb48a, width: 1.1, alpha: 0.88 });
        body
          .ellipse(6, -1, 5, 3.6)
          .fill({ color: 0x7a6248, alpha: 0.95 })
          .stroke({ color: 0xe6d2a8, width: 0.9, alpha: 0.8 });
        body.circle(8.5, -2.2, 1.3).fill({ color: 0xf0e2c0, alpha: 0.9 });
        for (const side of [-1, 1]) {
          for (let leg = -1; leg <= 1; leg++) {
            body
              .moveTo(side * 4, 1 + leg * 3)
              .lineTo(side * 11, 4 + leg * 3)
              .stroke({ color: 0xd9c39a, width: 1.1, alpha: 0.78 });
          }
        }
        node.addChild(glow, body);
        this.layer.addChild(node);
        visual = { node, glow, body };
        this.visuals.set(grub.id, visual);
      }
      visual.node.position.set(grub.x, grub.y);
      if (Math.hypot(grub.vx, grub.vy) > 0.01) {
        visual.node.rotation = Math.atan2(grub.vy, grub.vx);
      }
      const load = Math.min(1, Math.max(0, grub.reserve / 0.8));
      visual.node.scale.set(appearanceScale(grub.traits));
      visual.glow.tint = 0xc9b080;
      visual.glow.width = 28 + load * 10;
      visual.glow.height = 20 + load * 8;
      visual.glow.alpha = (0.06 + load * 0.1) * appearanceGlow(grub.traits);
      visual.body.alpha = grub.starvedFor > 0 ? 0.78 : 0.96;
    }
    for (const [id, visual] of this.visuals) {
      if (!world.marlgrubs.some((grub) => grub.id === id)) {
        visual.node.destroy({ children: true });
        this.visuals.delete(id);
      }
    }
  }

  clear(): void {
    this.visuals.clear();
  }
}
