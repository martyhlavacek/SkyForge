import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, REGISTRY, SCENES } from '../config/constants';
import { difficulty } from '../systems/DifficultyManager';
import { audio } from '../systems/AudioManager';
import { saveData } from '../systems/SaveData';
import type { DifficultyName } from '../../schemas/difficultySchema';
import { MenuGamepadNavigator } from '../input/MenuGamepadNavigator';

type MenuItem = { label: string; action: () => void };

/**
 * MenuScene (Sprint 0.3, expanded in Epoch 6).
 * A navigable title menu: Start Game / How to Play. The first interaction
 * still doubles as the browser audio-unlock gate (PDR §21.1). Keyboard
 * (up/down + enter) and pointer both work.
 */
export class MenuScene extends Phaser.Scene {
  private items: MenuItem[] = [];
  private labels: Phaser.GameObjects.Text[] = [];
  private selected = 0;
  private difficultyText!: Phaser.GameObjects.Text;
  private readonly diffOrder: DifficultyName[] = ['easy', 'normal', 'hard'];
  private diffIndex = 1;
  private readonly gamepadNav = new MenuGamepadNavigator();

  constructor() {
    super(SCENES.MENU);
  }

  create(): void {
    this.registry.set(REGISTRY.AUDIO_UNLOCKED, audio.isUnlocked);
    const cx = GAME_WIDTH / 2;

    this.add
      .text(cx, GAME_HEIGHT * 0.24, 'PROJECT\nSKYFORGE', {
        fontFamily: 'monospace',
        fontSize: '52px',
        color: '#e8f0ff',
        align: 'center',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, GAME_HEIGHT * 0.4, 'vertical shoot-\u2019em-up', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#5c6e99',
      })
      .setOrigin(0.5);

    this.items = [
      { label: 'HANGAR / START', action: () => this.scene.start(SCENES.HANGAR) },
      { label: 'HOW TO PLAY', action: () => this.scene.start(SCENES.HELP) },
      {
        label: 'SETTINGS',
        action: () => this.scene.start(SCENES.SETTINGS, { returnScene: SCENES.MENU }),
      },
    ];

    // High score display (S9.3/S9.4).
    const blob = saveData.get();
    if (blob.highScore > 0) {
      this.add
        .text(
          cx,
          GAME_HEIGHT * 0.46,
          `HIGH SCORE ${blob.highScore.toString().padStart(8, '0')}`,
          {
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#ffdd55',
          },
        )
        .setOrigin(0.5);
    }

    this.labels = this.items.map((item, i) =>
      this.add
        .text(cx, GAME_HEIGHT * 0.54 + i * 42, item.label, {
          fontFamily: 'monospace',
          fontSize: '22px',
          color: '#7ab0ff',
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => this.setSelected(i))
        .on('pointerdown', () => {
          this.setSelected(i);
          this.confirm();
        }),
    );

    // Difficulty selector (Sprint 7.2).
    const stored = this.registry.get(REGISTRY.DIFFICULTY) as DifficultyName | undefined;
    this.diffIndex = stored ? this.diffOrder.indexOf(stored) : 1;
    if (this.diffIndex < 0) this.diffIndex = 1;
    this.difficultyText = this.add
      .text(cx, GAME_HEIGHT * 0.68, '', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#9db4e6',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.cycleDifficulty(1));
    this.renderDifficulty();

    this.add
      .text(
        cx,
        GAME_HEIGHT * 0.86,
        '\u2191\u2193 select   \u2190\u2192 difficulty   ENTER start',
        {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#4a5a7a',
        },
      )
      .setOrigin(0.5);

    this.setSelected(0);

    // Browser audio may only be created/resumed from a genuine gesture.
    this.input.once('pointerdown', () => void this.unlockAudio());
    this.input.gamepad?.once('down', () => void this.unlockAudio());

    const kb = this.input.keyboard;
    kb?.once('keydown', () => void this.unlockAudio());
    kb?.on('keydown-UP', () => this.setSelected(this.selected - 1));
    kb?.on('keydown-DOWN', () => this.setSelected(this.selected + 1));
    kb?.on('keydown-W', () => this.setSelected(this.selected - 1));
    kb?.on('keydown-S', () => this.setSelected(this.selected + 1));
    kb?.on('keydown-LEFT', () => this.cycleDifficulty(-1));
    kb?.on('keydown-RIGHT', () => this.cycleDifficulty(1));
    kb?.on('keydown-A', () => this.cycleDifficulty(-1));
    kb?.on('keydown-D', () => this.cycleDifficulty(1));
    kb?.on('keydown-ENTER', () => this.confirm());
    kb?.on('keydown-SPACE', () => this.confirm());
  }

  update(): void {
    const nav = this.gamepadNav.read(this);
    if (nav.up) this.setSelected(this.selected - 1);
    if (nav.down) this.setSelected(this.selected + 1);
    if (nav.left) this.cycleDifficulty(-1);
    if (nav.right) this.cycleDifficulty(1);
    if (nav.confirm) this.confirm();
  }

  private setSelected(index: number): void {
    if (index !== this.selected) audio.play('uiMove');
    this.selected = Phaser.Math.Wrap(index, 0, this.items.length);
    this.labels.forEach((label, i) => {
      const active = i === this.selected;
      label.setColor(active ? '#ffffff' : '#7ab0ff');
      label.setText(`${active ? '\u25B6 ' : '  '}${this.items[i].label}`);
    });
  }

  private cycleDifficulty(dir: number): void {
    this.diffIndex = Phaser.Math.Wrap(this.diffIndex + dir, 0, this.diffOrder.length);
    this.renderDifficulty();
  }

  private renderDifficulty(): void {
    const name = this.diffOrder[this.diffIndex];
    this.difficultyText.setText(`\u25C0  DIFFICULTY: ${name.toUpperCase()}  \u25B6`);
  }

  private confirm(): void {
    void this.confirmAfterUnlock();
  }

  private async confirmAfterUnlock(): Promise<void> {
    await this.unlockAudio();
    audio.play('uiConfirm');
    const chosen = this.diffOrder[this.diffIndex];
    difficulty.set(chosen);
    this.registry.set(REGISTRY.DIFFICULTY, chosen);
    saveData.updateSettings({ difficulty: chosen });
    this.items[this.selected].action();
  }

  private async unlockAudio(): Promise<void> {
    const unlocked = await audio.unlock();
    this.registry.set(REGISTRY.AUDIO_UNLOCKED, unlocked);
  }
}
