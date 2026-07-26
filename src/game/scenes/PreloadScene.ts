import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SCENES, TEX } from '../config/constants';
import { mulberry32 } from '../../shared/rng';
import { contentRegistry } from '../systems/ContentRegistry';
import {
  terrainAssetUrl,
  terrainPlaneTextureKey,
  terrainTextureKey,
} from '../terrain/TerrainTileset';
import {
  shouldEnableEmbeddedStudioBridge,
  shouldStartRuntimePreview,
} from '../studio/RuntimeBridgePolicy';

/**
 * PreloadScene (Sprint 0.3).
 * Generates all placeholder textures with Graphics.generateTexture so no
 * external assets are required before Sprint 9.x. Shows a placeholder
 * progress bar to establish the loading-UI slot (real asset progress
 * arrives in Sprint 9.4).
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SCENES.PRELOAD);
  }

  preload(): void {
    for (const biome of contentRegistry.biomes.values()) {
      const tileset = biome.tileset;
      if (!tileset) continue;
      const key = terrainTextureKey(tileset.id);
      if (!this.textures.exists(key)) {
        this.load.spritesheet(key, terrainAssetUrl(tileset.uri), {
          frameWidth: tileset.tileSize,
          frameHeight: tileset.tileSize,
        });
      }
      for (const plane of tileset.planes) {
        const planeKey = terrainPlaneTextureKey(tileset.id, plane.materialId);
        if (this.textures.exists(planeKey)) continue;
        this.load.spritesheet(planeKey, terrainAssetUrl(plane.uri), {
          frameWidth: plane.frameWidth,
          frameHeight: plane.frameHeight,
        });
      }
    }
  }

  create(): void {
    this.generatePlaceholderTextures();
    const params = new URLSearchParams(window.location.search);
    const studioBridgeEnabled = shouldEnableEmbeddedStudioBridge({
      studioRequested: params.get('studio') === '1',
      embedded: window.parent !== window,
      session: params.get('session'),
    });
    const preview = shouldStartRuntimePreview({
      previewRequested: params.get('preview') === '1',
      dev: import.meta.env.DEV,
      e2e: import.meta.env.VITE_E2E === '1',
      studioBridgeEnabled,
    });
    this.showFakeProgressBar(() =>
      this.scene.start(preview ? SCENES.GAME : SCENES.MENU),
    );
  }

  private generatePlaceholderTextures(): void {
    const g = this.add.graphics();

    // tex_player: white triangle ship, 32x32, nose up.
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(16, 0, 2, 30, 30, 30);
    g.generateTexture(TEX.PLAYER, 32, 32);
    g.clear();

    // Dedicated ship-shaped shadow. Three nested silhouettes create a soft,
    // dither-friendly edge while preserving the player's triangular outline.
    g.fillStyle(0x000000, 0.08);
    g.fillTriangle(22, 1, 1, 31, 43, 31);
    g.fillStyle(0x000000, 0.17);
    g.fillTriangle(22, 4, 4, 29, 40, 29);
    g.fillStyle(0x000000, 0.38);
    g.fillTriangle(22, 7, 8, 27, 36, 27);
    g.generateTexture(TEX.PLAYER_SHADOW, 44, 32);
    g.clear();

    // tex_bullet_player: yellow 4x12 rect.
    g.fillStyle(0xffe066, 1);
    g.fillRect(0, 0, 4, 12);
    g.generateTexture(TEX.BULLET_PLAYER, 4, 12);
    g.clear();

    // tex_bullet_enemy: red 8x8 circle.
    g.fillStyle(0xff4455, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture(TEX.BULLET_ENEMY, 8, 8);
    g.clear();

    // tex_enemy_light: magenta 28x28 rect.
    g.fillStyle(0xdd44cc, 1);
    g.fillRect(0, 0, 28, 28);
    g.generateTexture(TEX.ENEMY_LIGHT, 28, 28);
    g.clear();

    // tex_enemy_heavy: orange 40x40 rect (Sprint 4.2).
    g.fillStyle(0xe08833, 1);
    g.fillRect(0, 0, 40, 40);
    g.generateTexture(TEX.ENEMY_HEAVY, 40, 40);
    g.clear();

    // tex_enemy_interceptor: cyan 24x24 rect (Sprint 4.2).
    g.fillStyle(0x33ccdd, 1);
    g.fillRect(0, 0, 24, 24);
    g.generateTexture(TEX.ENEMY_INTERCEPTOR, 24, 24);
    g.clear();

    // tex_turret: dark green 32x32 (Sprint 4.5).
    g.fillStyle(0x2e6b3a, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x4a9b57, 1);
    g.fillCircle(16, 16, 10);
    g.generateTexture(TEX.TURRET, 32, 32);
    g.clear();

    // tex_pickup: green 16x16 weapon-upgrade.
    g.fillStyle(0x55ee88, 1);
    g.fillRect(0, 0, 16, 16);
    g.generateTexture(TEX.PICKUP, 16, 16);
    g.clear();

    // tex_pickup_spread: blue 16x16 (weapon swap).
    g.fillStyle(0x5599ff, 1);
    g.fillRect(0, 0, 16, 16);
    g.generateTexture(TEX.PICKUP_SPREAD, 16, 16);
    g.clear();

    // tex_pickup_shield: white 16x16 (shield/health).
    g.fillStyle(0xddeeff, 1);
    g.fillRect(0, 0, 16, 16);
    g.generateTexture(TEX.PICKUP_SHIELD, 16, 16);
    g.clear();

    // Campaign economy pickups (Epoch 10).
    g.fillStyle(0x66dd99, 1);
    g.fillCircle(8, 8, 8);
    g.fillStyle(0x163828, 1);
    g.fillRect(6, 3, 4, 10);
    g.generateTexture(TEX.PICKUP_CREDIT, 16, 16);
    g.clear();

    g.fillStyle(0xffdd55, 1);
    g.fillCircle(10, 10, 10);
    g.fillStyle(0x5a4510, 1);
    g.fillRect(8, 4, 4, 12);
    g.generateTexture(TEX.PICKUP_CREDIT_LARGE, 20, 20);
    g.clear();

    g.fillStyle(0xff7766, 1);
    g.fillRect(0, 5, 18, 8);
    g.fillRect(5, 0, 8, 18);
    g.generateTexture(TEX.PICKUP_REPAIR, 18, 18);
    g.clear();

    // tex_enemy_bomber: dark red 48x48.
    g.fillStyle(0xaa3344, 1);
    g.fillRect(0, 0, 48, 48);
    g.generateTexture(TEX.ENEMY_BOMBER, 48, 48);
    g.clear();

    // tex_mine: yellow 20x20 with a dark core.
    g.fillStyle(0xffcc33, 1);
    g.fillCircle(10, 10, 10);
    g.fillStyle(0x332200, 1);
    g.fillCircle(10, 10, 4);
    g.generateTexture(TEX.MINE, 20, 20);
    g.clear();

    // tex_missile: orange 6x14.
    g.fillStyle(0xff8844, 1);
    g.fillRect(0, 0, 6, 14);
    g.generateTexture(TEX.MISSILE, 6, 14);
    g.clear();

    // tex_boss_mini: purple 96x72.
    g.fillStyle(0x8844aa, 1);
    g.fillRect(0, 0, 96, 72);
    g.fillStyle(0xaa66cc, 1);
    g.fillRect(30, 20, 36, 36);
    g.generateTexture(TEX.BOSS_MINI, 96, 72);
    g.clear();

    // tex_boss_alpha: dark steel 140x100.
    g.fillStyle(0x556680, 1);
    g.fillRect(0, 0, 140, 100);
    g.fillStyle(0x8899bb, 1);
    g.fillRect(50, 30, 40, 40);
    g.fillStyle(0xff4455, 1);
    g.fillCircle(70, 50, 12);
    g.generateTexture(TEX.BOSS_ALPHA, 140, 100);
    g.clear();

    // tex_particle: white 4x4 square.
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 4, 4);
    g.generateTexture(TEX.PARTICLE, 4, 4);
    g.clear();

    // Parallax starfields (Sprint 1.4), deterministic via seeded RNG so the
    // sky is identical every load.
    const rng = mulberry32(0x5b1f0a);

    // tex_bg_far: dark fill + 90 dim stars.
    g.fillStyle(0x05070f, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.fillStyle(0x36415e, 1);
    for (let i = 0; i < 90; i++) {
      g.fillRect(Math.floor(rng() * GAME_WIDTH), Math.floor(rng() * GAME_HEIGHT), 1, 1);
    }
    g.generateTexture(TEX.BG_FAR, GAME_WIDTH, GAME_HEIGHT);
    g.clear();

    // tex_bg_mid: transparent + 70 medium stars.
    g.fillStyle(0x5c6e99, 1);
    for (let i = 0; i < 70; i++) {
      g.fillRect(Math.floor(rng() * GAME_WIDTH), Math.floor(rng() * GAME_HEIGHT), 1, 1);
    }
    g.generateTexture(TEX.BG_MID, GAME_WIDTH, GAME_HEIGHT);
    g.clear();

    // tex_bg_near: transparent + 50 brighter stars (some 2px).
    g.fillStyle(0x9db4e6, 1);
    for (let i = 0; i < 50; i++) {
      const size = rng() < 0.25 ? 2 : 1;
      g.fillRect(
        Math.floor(rng() * GAME_WIDTH),
        Math.floor(rng() * GAME_HEIGHT),
        size,
        size,
      );
    }
    g.generateTexture(TEX.BG_NEAR, GAME_WIDTH, GAME_HEIGHT);

    g.destroy();
  }

  private showFakeProgressBar(onDone: () => void): void {
    const barW = 260;
    const barH = 10;
    const x = GAME_WIDTH / 2 - barW / 2;
    const y = GAME_HEIGHT / 2;

    const frame = this.add.rectangle(GAME_WIDTH / 2, y, barW + 6, barH + 6);
    frame.setStrokeStyle(1, 0x4a5a7a);

    const fill = this.add.rectangle(x, y, 1, barH, 0x7ab0ff).setOrigin(0, 0.5);

    this.add
      .text(GAME_WIDTH / 2, y - 28, 'LOADING', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#7ab0ff',
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: fill,
      width: barW,
      duration: 500,
      ease: 'Sine.easeInOut',
      onComplete: onDone,
    });
  }
}
