import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SCENES } from '../config/constants';
import { audio } from '../systems/AudioManager';
import { music } from '../systems/MusicDirector';
import { MenuGamepadNavigator } from '../input/MenuGamepadNavigator';
import type { RunSessionSnapshot } from '../systems/RunSession';

interface PauseData {
  level?: string;
  checkpointAt?: number;
  weaponLevel?: number;
  session?: RunSessionSnapshot;
}

/**
 * Pause overlay. The GameScene remains paused underneath Settings, so a
 * settings round-trip never destroys or recreates the active run.
 */
export class PauseScene extends Phaser.Scene {
  private index = 0;
  private labels: Phaser.GameObjects.Text[] = [];
  private params: PauseData = {};
  private items: { label: string; action: () => void }[] = [];
  private readonly gamepadNav = new MenuGamepadNavigator();

  constructor() {
    super(SCENES.PAUSE);
  }

  init(data: PauseData): void {
    this.params = data ?? {};
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05070f, 0.72);
    this.add
      .text(cx, GAME_HEIGHT * 0.3, 'PAUSED', {
        fontFamily: 'monospace',
        fontSize: '40px',
        color: '#e8f0ff',
      })
      .setOrigin(0.5);

    this.items = [
      { label: 'RESUME', action: () => this.resumeGame() },
      {
        label: 'RESTART FROM CHECKPOINT',
        action: () =>
          this.stopAndStart(SCENES.GAME, {
            level: this.params.level,
            startAt: this.params.checkpointAt,
            weaponLevel: this.params.weaponLevel,
            session: this.params.session,
          }),
      },
      { label: 'SETTINGS', action: () => this.openSettings() },
      { label: 'QUIT TO MENU', action: () => this.stopAndStart(SCENES.MENU) },
    ];
    if (this.params.checkpointAt === undefined) this.items.splice(1, 1);

    this.labels = this.items.map((item, i) =>
      this.add
        .text(cx, GAME_HEIGHT * 0.46 + i * 40, item.label, {
          fontFamily: 'monospace',
          fontSize: '16px',
          color: '#7ab0ff',
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => this.select(i))
        .on('pointerdown', () => this.items[i].action()),
    );
    this.select(0);

    const kb = this.input.keyboard;
    kb?.on('keydown-UP', () => this.select(this.index - 1));
    kb?.on('keydown-DOWN', () => this.select(this.index + 1));
    kb?.on('keydown-ENTER', () => this.items[this.index].action());
    kb?.on('keydown-ESC', () => this.resumeGame());
  }

  update(): void {
    const nav = this.gamepadNav.read(this);
    if (nav.up) this.select(this.index - 1);
    if (nav.down) this.select(this.index + 1);
    if (nav.confirm) this.items[this.index]?.action();
    if (nav.cancel || nav.pause) this.resumeGame();
  }

  private select(i: number): void {
    this.index = Phaser.Math.Wrap(i, 0, this.items.length);
    this.labels.forEach((label, j) =>
      label.setColor(j === this.index ? '#ffffff' : '#7ab0ff'),
    );
  }

  private resumeGame(): void {
    audio.play('uiConfirm');
    music.resume();
    this.scene.stop();
    this.scene.resume(SCENES.GAME);
  }

  private openSettings(): void {
    audio.play('uiConfirm');
    this.scene.launch(SCENES.SETTINGS, {
      returnScene: SCENES.PAUSE,
      returnMode: 'wake',
    });
    this.scene.sleep();
  }

  private stopAndStart(scene: string, data?: object): void {
    audio.play('uiConfirm');
    music.stop();
    this.scene.stop(SCENES.GAME);
    this.scene.stop();
    this.scene.start(scene, data);
  }
}
