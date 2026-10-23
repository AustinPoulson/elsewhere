import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { World } from '../world/types';

interface RainbellVisual {
  node: Container;
  glow: Sprite;
  mantle: Graphics;
  pulse: Graphics;
}

/** Four reusable objects per rooted animal; pumping cues have no particle history. */
export class RainbellRenderer {
  private readonly visuals = new Map<number, RainbellVisual>();

  constructor(private readonly layer: Container, private readonly glowTexture: Texture) {}

  render(world: World, reducedMotion: boolean): void {
    for (const bell of world.rainbells) {
      let visual = this.visuals.get(bell.id);
      if (!visual) {
        const node = new Container();
        const glow = new Sprite(this.glowTexture);
        glow.anchor.set(.5);
        glow.blendMode = 'add';
        const mantle = new Graphics();
        const pulse = new Graphics();
        node.addChild(glow, mantle, pulse);
        this.layer.addChild(node);
        visual = { node, glow, mantle, pulse };
        this.visuals.set(bell.id, visual);
      }
      visual.node.position.set(bell.x, bell.y);
      visual.node.rotation = (bell.id % 8) * .23;
      const pulseAge = bell.lastPulseAt === null ? Infinity : world.elapsed - bell.lastPulseAt;
      const contracting = !reducedMotion && pulseAge >= 0 && pulseAge < 3;
      const opening = contracting ? .72 + .28 * Math.min(1, pulseAge / 1.2) : 1;
      const growth = .6 + .4 * Math.min(1, bell.age / 5);
      visual.node.scale.set(growth);
      visual.glow.tint = 0xa9b9dc;
      visual.glow.width = 98;
      visual.glow.height = 80;
      visual.glow.alpha = .09 + bell.reserve * .12;
      const mantle = visual.mantle.clear();
      mantle.ellipse(0, 0, 23 * opening, 17 * opening)
        .fill({ color: 0x7a9ac2, alpha: .26 + bell.reserve * .12 })
        .stroke({ color: 0xb4cbe2, width: 1.25, alpha: .8 });
      mantle.ellipse(0, 2, 12 * opening, 8 * opening)
        .fill({ color: 0x18333f, alpha: .6 })
        .stroke({ color: 0xc7c4de, width: .8, alpha: .65 });
      for (let arm = 0; arm < 8; arm++) {
        const angle = arm * Math.PI / 4;
        const x = Math.cos(angle), y = Math.sin(angle);
        mantle.moveTo(x * 13 * opening, y * 10 * opening)
          .quadraticCurveTo(x * 31 - y * 6, y * 25 + x * 6, x * 31, y * 26)
          .stroke({ color: 0xafc6df, width: .9, alpha: .67 });
      }
      mantle.circle(0, 2, 2 + bell.reserve * 2).fill({ color: 0xdbd4e5, alpha: .7 });
      const pulse = visual.pulse.clear();
      if (contracting) {
        pulse.ellipse(0, 0, 26 + pulseAge * 7, 20 + pulseAge * 5)
          .stroke({ color: 0xc0d0e6, width: 1.4, alpha: (1 - pulseAge / 3) * .6 });
      }
    }
    for (const [id, visual] of this.visuals) {
      if (!world.rainbells.some(bell => bell.id === id)) {
        visual.node.destroy({ children: true });
        this.visuals.delete(id);
      }
    }
  }

  clear(): void { this.visuals.clear(); }
}
