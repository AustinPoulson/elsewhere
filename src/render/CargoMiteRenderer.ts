import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { World } from '../world/types';
import { cargoMiteDisplayPoint } from './cargoMiteDisplay';

interface MiteVisual {
  node: Container;
  glow: Sprite;
  body: Graphics;
}

/** Three reusable display objects per mite; no transient particles or history. */
export class CargoMiteRenderer {
  private readonly visuals = new Map<number, MiteVisual>();

  constructor(private readonly layer: Container, private readonly glowTexture: Texture) {}

  render(world: World): void {
    for (const mite of world.cargoMites) {
      let visual = this.visuals.get(mite.id);
      if (!visual) {
        const node = new Container();
        const glow = new Sprite(this.glowTexture);
        glow.anchor.set(.5);
        glow.blendMode = 'add';
        const body = new Graphics();
        // A jointed, six-legged silhouette reads separately from the grazer's shell.
        body.ellipse(0, 0, 8, 11)
          .fill({ color: 0x594c3d, alpha: .96 })
          .stroke({ color: 0xf1dcb5, width: 1.4, alpha: .92 });
        body.circle(0, -7, 4.5)
          .fill({ color: 0xb6a47c, alpha: .96 })
          .stroke({ color: 0xffe9c0, width: 1.1, alpha: .9 });
        for (const side of [-1, 1]) {
          for (let leg = -1; leg <= 1; leg++) {
            const y = leg * 5 + 1;
            body.moveTo(side * 5, y).lineTo(side * 12, y + leg * 2)
              .lineTo(side * 14, y + leg * 4 + 4)
              .stroke({ color: 0xf2d2a4, width: 1.3, alpha: .86 });
          }
          body.moveTo(side * 2, -10).lineTo(side * 7, -16)
            .stroke({ color: 0xf5e4c8, width: 1, alpha: .85 });
        }
        node.addChild(glow, body);
        this.layer.addChild(node);
        visual = { node, glow, body };
        this.visuals.set(mite.id, visual);
      }
      const point = cargoMiteDisplayPoint(world, mite);
      visual.node.position.set(point.x, point.y);
      if (Math.hypot(mite.vx, mite.vy) > .01) {
        visual.node.rotation = Math.atan2(mite.vy, mite.vx) + Math.PI / 2;
      }
      const juvenile = mite.age < 30;
      visual.node.scale.set(juvenile ? .77 : 1);
      const reserve = Math.min(1, Math.max(0, mite.reserve / .5));
      visual.glow.tint = 0xe6c990;
      visual.glow.width = 30 + reserve * 12;
      visual.glow.height = 34 + reserve * 12;
      visual.glow.alpha = .07 + reserve * .11;
      visual.body.alpha = mite.mode === 'seeking' ? .85 : 1;
    }
    for (const [id, visual] of this.visuals) {
      if (!world.cargoMites.some(mite => mite.id === id)) {
        visual.node.destroy({ children: true });
        this.visuals.delete(id);
      }
    }
  }

  clear(): void { this.visuals.clear(); }
}
