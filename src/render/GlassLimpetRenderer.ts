import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { World } from '../world/types';

interface LimpetVisual {
  node: Container;
  glow: Sprite;
  shell: Graphics;
  catch: Graphics;
}

/** Four reusable objects per fixed feeder, with no particle or cue history. */
export class GlassLimpetRenderer {
  private readonly visuals = new Map<number, LimpetVisual>();

  constructor(
    private readonly layer: Container,
    private readonly glowTexture: Texture,
  ) {}

  render(world: World): void {
    for (const limpet of world.glassLimpets) {
      let visual = this.visuals.get(limpet.id);
      if (!visual) {
        const node = new Container();
        const glow = new Sprite(this.glowTexture);
        glow.anchor.set(0.5);
        glow.blendMode = 'add';
        const shell = new Graphics();
        // A low, ribbed glass cup anchored along the shoreline. The open
        // center holds only pigment that this shell has actually intercepted.
        shell
          .moveTo(-17, 5)
          .quadraticCurveTo(-15, -10, 0, -15)
          .quadraticCurveTo(15, -10, 17, 5)
          .quadraticCurveTo(0, 13, -17, 5)
          .closePath()
          .fill({ color: 0x82b7bb, alpha: 0.32 })
          .stroke({ color: 0xd4eae0, width: 1.6, alpha: 0.92 });
        for (let rib = -2; rib <= 2; rib++) {
          const x = rib * 5.5;
          shell
            .moveTo(x, -10 + Math.abs(rib) * 2)
            .quadraticCurveTo(x * 1.2, -1, x * 1.55, 7)
            .stroke({ color: 0xc3e6d9, width: 0.9, alpha: 0.64 });
        }
        shell
          .ellipse(0, 5, 10, 3.5)
          .fill({ color: 0x173a3b, alpha: 0.62 })
          .stroke({ color: 0xf0f4db, width: 0.8, alpha: 0.7 });
        const catchGraphic = new Graphics();
        node.addChild(glow, shell, catchGraphic);
        this.layer.addChild(node);
        visual = { node, glow, shell, catch: catchGraphic };
        this.visuals.set(limpet.id, visual);
      }
      visual.node.position.set(limpet.x, limpet.y);
      visual.node.rotation = Math.atan2(limpet.y - 500, limpet.x - 720) + Math.PI / 2;
      const load = Math.min(1, Math.max(0, limpet.cargo / 0.8));
      visual.glow.tint = 0xa8e1d3;
      visual.glow.width = 50 + load * 18;
      visual.glow.height = 38 + load * 14;
      visual.glow.alpha = 0.07 + load * 0.11;
      visual.catch.clear();
      if (load > 0) {
        visual.catch
          .ellipse(0, 5, 1.8 + load * 7.5, 1 + load * 2.6)
          .fill({ color: 0xc8d8a2, alpha: 0.28 + load * 0.55 })
          .stroke({ color: 0xe9e7bc, width: 0.7, alpha: 0.35 + load * 0.48 });
      }
    }
    for (const [id, visual] of this.visuals) {
      if (!world.glassLimpets.some((limpet) => limpet.id === id)) {
        visual.node.destroy({ children: true });
        this.visuals.delete(id);
      }
    }
  }

  clear(): void {
    this.visuals.clear();
  }
}
