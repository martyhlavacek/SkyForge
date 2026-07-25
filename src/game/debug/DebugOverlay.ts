import Phaser from 'phaser';
import { DEPTHS, REGISTRY } from '../config/constants';
import { gameTime } from '../systems/GameTime';

export interface DebugStats {
  poolLines: () => string[];
  levelTime: () => number; // stub 0 until Sprint 4.4
  encounterName: () => string; // stub until Sprint 4.3
  musicLine?: () => string;
  killAllEnemies: () => void;
}

const TIME_STEPS = [0.25, 0.5, 1, 2];

/**
 * Developer overlay (Sprint 2.5), PDR §29 subset.
 * Backtick: toggle panel · H: hitboxes · I: player invulnerability ·
 * K: kill all enemies · [ ]: time scale steps.
 * Only constructed when registry debugMode is true.
 */
export class DebugOverlay {
  private text: Phaser.GameObjects.Text;
  private visible = true;
  private timeIndex = TIME_STEPS.indexOf(1);
  private frameMs = 0;
  private readonly refreshEvent: Phaser.Time.TimerEvent;

  private readonly onBacktick = (): void => {
    this.visible = !this.visible;
    this.text.setVisible(this.visible);
  };
  private readonly onHitboxes = (): void => this.toggleHitboxes();
  private readonly onInvulnerable = (): void => {
    const cur = this.scene.registry.get(REGISTRY.DEBUG_INVULNERABLE) === true;
    this.scene.registry.set(REGISTRY.DEBUG_INVULNERABLE, !cur);
  };
  private readonly onKillAll = (): void => this.stats.killAllEnemies();
  private readonly onSlower = (): void => this.stepTime(-1);
  private readonly onFaster = (): void => this.stepTime(1);

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly stats: DebugStats,
  ) {
    this.text = scene.add
      .text(8, 8, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#66ff99',
        backgroundColor: '#00000088',
        padding: { x: 6, y: 4 },
      })
      .setDepth(DEPTHS.DEBUG);

    // 2 Hz refresh — Text updates are costly (Sprint 0.1 convention).
    this.refreshEvent = scene.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => this.refresh(),
    });

    const kb = scene.input.keyboard;
    if (kb) {
      kb.on('keydown-BACKTICK', this.onBacktick);
      kb.on('keydown-H', this.onHitboxes);
      kb.on('keydown-I', this.onInvulnerable);
      kb.on('keydown-K', this.onKillAll);
      kb.on('keydown-OPEN_BRACKET', this.onSlower);
      kb.on('keydown-CLOSED_BRACKET', this.onFaster);
    }
  }

  destroy(): void {
    this.refreshEvent.destroy();
    const kb = this.scene.input.keyboard;
    if (kb) {
      kb.off('keydown-BACKTICK', this.onBacktick);
      kb.off('keydown-H', this.onHitboxes);
      kb.off('keydown-I', this.onInvulnerable);
      kb.off('keydown-K', this.onKillAll);
      kb.off('keydown-OPEN_BRACKET', this.onSlower);
      kb.off('keydown-CLOSED_BRACKET', this.onFaster);
    }
    this.text.destroy();
  }

  /** Call once per frame from the scene with the raw ms delta. */
  update(deltaMs: number): void {
    this.frameMs = deltaMs;
  }

  private stepTime(dir: number): void {
    this.timeIndex = Phaser.Math.Clamp(this.timeIndex + dir, 0, TIME_STEPS.length - 1);
    const scale = TIME_STEPS[this.timeIndex];
    gameTime.scale = scale;
    // Arcade world timeScale is a divisor (2 = half speed) — keep physics in sync.
    this.scene.physics.world.timeScale = 1 / scale;
  }

  private toggleHitboxes(): void {
    const world = this.scene.physics.world;
    world.drawDebug = !world.drawDebug;
    if (world.drawDebug && !world.debugGraphic) {
      const g = world.createDebugGraphic();
      g.setDepth(DEPTHS.DEBUG - 1);
    }
    if (!world.drawDebug && world.debugGraphic) {
      (world.debugGraphic as Phaser.GameObjects.Graphics).clear();
    }
  }

  private refresh(): void {
    if (!this.visible) return;
    const invuln = this.scene.registry.get(REGISTRY.DEBUG_INVULNERABLE) === true;
    const lines = [
      `FPS ${this.scene.game.loop.actualFps.toFixed(0)}  frame ${this.frameMs.toFixed(1)}ms`,
      `time x${gameTime.scale}  levelTime ${this.stats.levelTime().toFixed(1)}s`,
      `encounter: ${this.stats.encounterName()}`,
      ...(this.stats.musicLine ? [this.stats.musicLine()] : []),
      ...this.stats.poolLines(),
      `invuln[I]:${invuln ? 'ON' : 'off'}  hitbox[H]  kill[K]  speed[\`[\`\`]\`]`,
    ];
    this.text.setText(lines.join('\n'));
  }
}
