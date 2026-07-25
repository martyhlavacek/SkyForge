import Phaser from 'phaser';
import { DEPTHS, GAME_WIDTH, GAME_HEIGHT, TEX } from '../config/constants';

/** Config-driven parallax layers (S1.4 as amended by roadmap Revision 1.1). */
interface ParallaxLayerDef {
  texture: string;
  speed: number; // base px/s
  depth: number;
}

const LAYERS: ParallaxLayerDef[] = [
  { texture: TEX.BG_FAR, speed: 20, depth: DEPTHS.BG_FAR },
  { texture: TEX.BG_MID, speed: 40, depth: DEPTHS.BG_MID },
  { texture: TEX.BG_NEAR, speed: 60, depth: DEPTHS.BG_NEAR },
];

/**
 * Triple-layer vertical parallax. Owns scrollSpeedMultiplier so encounters
 * can change world speed (PDR §13.1); Sprint 4.5's WorldScroll integrates
 * this multiplier into world distance, and the Level Composer's chunked
 * maps (Epoch 10) will render between BG_FAR and BG_NEAR using the same
 * depth discipline.
 */
export class ScrollController {
  scrollSpeedMultiplier = 1;

  private layers: { sprite: Phaser.GameObjects.TileSprite; speed: number }[];

  constructor(scene: Phaser.Scene) {
    this.layers = LAYERS.map((def) => ({
      speed: def.speed,
      sprite: scene.add
        .tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, def.texture)
        .setDepth(def.depth),
    }));
  }

  update(dt: number): void {
    const m = this.scrollSpeedMultiplier;
    for (const layer of this.layers) {
      // Stars move down the screen = the ship flies up.
      layer.sprite.tilePositionY -= layer.speed * m * dt;
    }
  }
}
