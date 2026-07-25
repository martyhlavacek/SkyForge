import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SCENES } from '../config/constants';
import { MenuGamepadNavigator } from '../input/MenuGamepadNavigator';
import type { RunSessionSnapshot } from '../systems/RunSession';

interface GameOverData {
  score?: number;
  level?: string;
  checkpointAt?: number;
  checkpointName?: string;
  weaponLevel?: number;
  session?: RunSessionSnapshot;
}

/**
 * GameOverScene (Sprint 2.3, extended by 4.4): offers checkpoint retry
 * (hull refilled, weapon level preserved, timeline seeked) alongside a
 * full restart. Replaced by the full results flow in Epoch 9.
 */
export class GameOverScene extends Phaser.Scene {
  private params: GameOverData = {};
  private ready = false;
  private hasCheckpoint = false;
  private readonly gamepadNav = new MenuGamepadNavigator();

  constructor() {
    super(SCENES.GAME_OVER);
  }

  init(data: GameOverData): void {
    this.params = data ?? {};
  }

  create(): void {
    this.ready = false;
    const cx = GAME_WIDTH / 2;
    this.add
      .text(cx, GAME_HEIGHT * 0.34, 'GAME OVER', {
        fontFamily: 'monospace',
        fontSize: '44px',
        color: '#ff4455',
      })
      .setOrigin(0.5);

    this.add
      .text(
        cx,
        GAME_HEIGHT * 0.46,
        `SCORE ${(this.params.score ?? 0).toString().padStart(8, '0')}`,
        {
          fontFamily: 'monospace',
          fontSize: '20px',
          color: '#e8f0ff',
        },
      )
      .setOrigin(0.5);

    const hasCheckpoint = this.params.checkpointAt !== undefined;
    this.hasCheckpoint = hasCheckpoint;
    const options = hasCheckpoint
      ? [
          `R — RETRY FROM CHECKPOINT "${this.params.checkpointName}"`,
          'ENTER — RESTART LEVEL',
          'H — ABANDON TO HANGAR',
        ]
      : ['ENTER — RETRY MISSION', 'H — ABANDON TO HANGAR'];
    const prompt = this.add
      .text(cx, GAME_HEIGHT * 0.6, options.join('\n\n'), {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#7ab0ff',
        align: 'center',
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: prompt,
      alpha: 0.35,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    this.time.delayedCall(400, () => {
      this.ready = true;
      if (hasCheckpoint) {
        this.input.keyboard?.on('keydown-R', () =>
          this.scene.start(SCENES.GAME, {
            level: this.params.level,
            startAt: this.params.checkpointAt,
            weaponLevel: this.params.weaponLevel,
            session: this.params.session,
          }),
        );
        this.input.keyboard?.on('keydown-ENTER', () =>
          this.scene.start(SCENES.GAME, { level: this.params.level }),
        );
        this.input.keyboard?.on('keydown-H', () =>
          this.scene.start(SCENES.HANGAR),
        );
      } else {
        this.input.keyboard?.on('keydown-ENTER', () =>
          this.scene.start(SCENES.GAME, { level: this.params.level }),
        );
        this.input.keyboard?.on('keydown-H', () => this.scene.start(SCENES.HANGAR));
        this.input.once('pointerdown', () =>
          this.scene.start(SCENES.GAME, { level: this.params.level }),
        );
      }
    });
  }
  update(): void {
    if (!this.ready) return;
    const nav = this.gamepadNav.read(this);
    if (!nav.confirm && !nav.cancel) return;
    if (this.hasCheckpoint && nav.cancel) {
      this.scene.start(SCENES.GAME, {
        level: this.params.level,
        startAt: this.params.checkpointAt,
        weaponLevel: this.params.weaponLevel,
        session: this.params.session,
      });
    } else {
      this.scene.start(SCENES.GAME, { level: this.params.level });
    }
  }
}
