import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SCENES } from '../config/constants';
import { saveData, type Settings } from '../systems/SaveData';
import { audio } from '../systems/AudioManager';
import { MenuGamepadNavigator } from '../input/MenuGamepadNavigator';

type Row =
  | {
      kind: 'slider';
      label: string;
      key: keyof Settings;
      min: number;
      max: number;
      step: number;
    }
  | { kind: 'toggle'; label: string; key: keyof Settings }
  | { kind: 'back'; label: string };

const ROWS: Row[] = [
  {
    kind: 'slider',
    label: 'Master Volume',
    key: 'masterVolume',
    min: 0,
    max: 1,
    step: 0.1,
  },
  {
    kind: 'slider',
    label: 'Music Volume',
    key: 'musicVolume',
    min: 0,
    max: 1,
    step: 0.1,
  },
  { kind: 'slider', label: 'SFX Volume', key: 'sfxVolume', min: 0, max: 1, step: 0.1 },
  {
    kind: 'slider',
    label: 'Screen Shake',
    key: 'screenShake',
    min: 0,
    max: 1,
    step: 0.25,
  },
  {
    kind: 'slider',
    label: 'Flash Intensity',
    key: 'flashIntensity',
    min: 0,
    max: 1,
    step: 0.25,
  },
  { kind: 'toggle', label: 'Reduced Particles', key: 'reducedParticles' },
  {
    kind: 'slider',
    label: 'Touch Sensitivity',
    key: 'touchSensitivity',
    min: 0.5,
    max: 3,
    step: 0.1,
  },
  { kind: 'back', label: 'Back' },
];

/**
 * Settings scene (Sprint 9.3), PDR §19.3. Keyboard-navigable list; sliders
 * adjust with left/right, toggles flip with left/right/enter. Changes take
 * effect immediately and persist via SaveData. `returnScene` lets Pause
 * return here.
 */
export class SettingsScene extends Phaser.Scene {
  private index = 0;
  private labels: Phaser.GameObjects.Text[] = [];
  private returnScene: string = SCENES.MENU;
  private returnMode: 'start' | 'wake' = 'start';
  private readonly gamepadNav = new MenuGamepadNavigator();

  constructor() {
    super(SCENES.SETTINGS);
  }

  init(data: { returnScene?: string; returnMode?: 'start' | 'wake' }): void {
    this.returnScene = data?.returnScene ?? SCENES.MENU;
    this.returnMode = data?.returnMode ?? 'start';
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    this.add
      .text(cx, 70, 'SETTINGS', {
        fontFamily: 'monospace',
        fontSize: '30px',
        color: '#e8f0ff',
      })
      .setOrigin(0.5);

    this.labels = ROWS.map((_, i) =>
      this.add
        .text(cx, 150 + i * 44, '', {
          fontFamily: 'monospace',
          fontSize: '16px',
          color: '#cdd8ee',
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => this.select(i))
        .on('pointerdown', () => this.activate(i)),
    );

    this.add
      .text(
        cx,
        GAME_HEIGHT - 40,
        '\u2191\u2193 select   \u2190\u2192 adjust   ENTER/ESC back',
        {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#4a5a7a',
        },
      )
      .setOrigin(0.5);

    this.render();

    const kb = this.input.keyboard;
    kb?.on('keydown-UP', () => this.select(this.index - 1));
    kb?.on('keydown-DOWN', () => this.select(this.index + 1));
    kb?.on('keydown-LEFT', () => this.adjust(-1));
    kb?.on('keydown-RIGHT', () => this.adjust(1));
    kb?.on('keydown-ENTER', () => this.activate(this.index));
    kb?.on('keydown-ESC', () => this.exit());
  }

  update(): void {
    const nav = this.gamepadNav.read(this);
    if (nav.up) this.select(this.index - 1);
    if (nav.down) this.select(this.index + 1);
    if (nav.left) this.adjust(-1);
    if (nav.right) this.adjust(1);
    if (nav.confirm) this.activate(this.index);
    if (nav.cancel) this.exit();
  }

  private select(i: number): void {
    this.index = Phaser.Math.Wrap(i, 0, ROWS.length);
    this.render();
  }

  private adjust(dir: number): void {
    const row = ROWS[this.index];
    const s = saveData.settings;
    if (row.kind === 'slider') {
      const cur = s[row.key] as number;
      const next = Phaser.Math.Clamp(
        Math.round((cur + dir * row.step) / row.step) * row.step,
        row.min,
        row.max,
      );
      saveData.updateSettings({ [row.key]: next } as Partial<Settings>);
      this.applyLive();
    } else if (row.kind === 'toggle') {
      saveData.updateSettings({
        [row.key]: !(s[row.key] as boolean),
      } as Partial<Settings>);
    }
    audio.play('uiMove');
    this.render();
  }

  private activate(i: number): void {
    this.select(i);
    const row = ROWS[this.index];
    if (row.kind === 'back') this.exit();
    else if (row.kind === 'toggle') this.adjust(1);
  }

  private applyLive(): void {
    const s = saveData.settings;
    audio.setVolumes({ master: s.masterVolume, music: s.musicVolume, sfx: s.sfxVolume });
    const game = this.scene.get(SCENES.GAME) as Phaser.Scene & {
      applySettings?: () => void;
    };
    game.applySettings?.();
  }

  private exit(): void {
    audio.play('uiConfirm');
    if (this.returnMode === 'wake') {
      this.scene.stop();
      this.scene.wake(this.returnScene);
    } else {
      this.scene.start(this.returnScene);
    }
  }

  private render(): void {
    const s = saveData.settings;
    ROWS.forEach((row, i) => {
      const active = i === this.index;
      let text: string;
      if (row.kind === 'slider') {
        const v = s[row.key] as number;
        const filled = Math.round(((v - row.min) / (row.max - row.min)) * 10);
        const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(10 - filled);
        text = `${row.label}  ${bar}`;
      } else if (row.kind === 'toggle') {
        text = `${row.label}  [${s[row.key] ? 'ON' : 'off'}]`;
      } else {
        text = row.label;
      }
      this.labels[i]
        .setText(`${active ? '\u25B6 ' : '  '}${text}`)
        .setColor(active ? '#ffffff' : '#cdd8ee');
    });
  }
}
