import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { World } from '../world/types';

interface CarrierVisual {
  node: Container;
  glow: Sprite;
  body: Graphics;
  bundle: Graphics;
}

/** Four reusable objects per carrier. The visible bundle is its actual saved cargo. */
export class SiltstitcherRenderer {
  private readonly visuals = new Map<number, CarrierVisual>();

  constructor(private readonly layer: Container, private readonly glowTexture: Texture) {}

  render(world: World): void {
    for (const carrier of world.siltstitchers) {
      let visual = this.visuals.get(carrier.id);
      if (!visual) {
        const node = new Container();
        const glow = new Sprite(this.glowTexture);
        glow.anchor.set(.5);
        glow.blendMode = 'add';
        const body = new Graphics();
        // A compact forked walking form, visually separate from the diamond
        // skimmer and rooted bells. The lower fork cradles the paid bundle.
        body.moveTo(0, -13).lineTo(5, -4).lineTo(3, 8).lineTo(0, 12)
          .lineTo(-3, 8).lineTo(-5, -4).closePath()
          .fill({ color: 0x7f958e, alpha: .9 })
          .stroke({ color: 0xc8dfcc, width: 1.2, alpha: .83 });
        body.moveTo(-3, -5).lineTo(-12, -9).moveTo(3, -5).lineTo(12, -9)
          .moveTo(-4, 1).lineTo(-13, 3).moveTo(4, 1).lineTo(13, 3)
          .moveTo(-3, 7).lineTo(-10, 13).moveTo(3, 7).lineTo(10, 13)
          .stroke({ color: 0xb7cbb8, width: 1.1, alpha: .78 });
        body.moveTo(0, -13).lineTo(0, -19)
          .stroke({ color: 0xdae9d3, width: 1.2, alpha: .8 });
        const bundle = new Graphics();
        node.addChild(glow, body, bundle);
        this.layer.addChild(node);
        visual = { node, glow, body, bundle };
        this.visuals.set(carrier.id, visual);
      }
      visual.node.position.set(carrier.x, carrier.y);
      if (Math.hypot(carrier.vx, carrier.vy) > .01) {
        visual.node.rotation = Math.atan2(carrier.vy, carrier.vx) + Math.PI / 2;
      }
      const load = Math.min(1, Math.max(0, carrier.cargo / .3));
      visual.glow.tint = 0xd4c597;
      visual.glow.width = 42 + load * 18;
      visual.glow.height = 42 + load * 18;
      visual.glow.alpha = .065 + load * .11;
      visual.bundle.clear();
      if (load > 0) {
        visual.bundle.circle(0, 8, 2.5 + load * 4)
          .fill({ color: 0xe8cc86, alpha: .4 + load * .48 })
          .stroke({ color: 0xffe5aa, width: .9, alpha: .5 + load * .38 });
      }
    }
    for (const [id, visual] of this.visuals) {
      if (!world.siltstitchers.some(carrier => carrier.id === id)) {
        visual.node.destroy({ children: true });
        this.visuals.delete(id);
      }
    }
  }

  clear(): void { this.visuals.clear(); }
}
