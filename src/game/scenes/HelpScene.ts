import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SCENES } from '../config/constants';
import { MenuGamepadNavigator } from '../input/MenuGamepadNavigator';

interface HelpSection {
  heading: string;
  lines: string[];
}

const SECTIONS: HelpSection[] = [
  {
    heading: 'CONTROLS',
    lines: [
      'Move ............ Arrow Keys / WASD',
      'Primary Fire .... SPACE (hold)',
      'Missiles ........ X (secondary, homing)',
      'Focus Mode ...... SHIFT (slow + precise,',
      '                  shows your hitbox dot)',
      'Pause ........... ESC',
    ],
  },
  {
    heading: 'WEAPONS',
    lines: [
      'Pulse Cannon .... fast, narrow, single-target',
      'Spread Cannon ... wide fan, crowd control',
      'Missiles ........ slow, homing, big damage',
      '',
      'Your primary weapon changes when you',
      'collect a weapon pickup. Upgrade pickups',
      'raise its level (up to Lv3): more shots,',
      'faster fire, more damage.',
    ],
  },
  {
    heading: 'PICKUPS',
    lines: [
      'Green ........... weapon upgrade (+1 level)',
      'Blue ............ swap to Spread Cannon',
      'White ........... shield (restores 1 hull)',
      '',
      'Pickups are magnetic \u2014 fly near them.',
    ],
  },
  {
    heading: 'SURVIVAL',
    lines: [
      'You have 3 hull pips. Your hitbox is a',
      'tiny dot at your center \u2014 near misses',
      'are safe, so weave through fire. After a',
      'hit you briefly flash and are invincible.',
    ],
  },
  {
    heading: 'SCORE MULTIPLIER',
    lines: [
      'Kill enemies to build your multiplier',
      '(x1 \u2192 x5). It climbs as you keep killing,',
      'decays if you stop, and DROPS A TIER when',
      'you take damage. Aggressive, clean play',
      'scores highest. Fast group kills bonus.',
    ],
  },
  {
    heading: 'BOSSES',
    lines: [
      'Bosses fight in phases \u2014 they flash and',
      'pause (telegraph) before changing attacks.',
      'Some have destructible parts (turrets):',
      'destroy them to stop that fire and score.',
      'The bar at the top is boss health.',
    ],
  },
];

/**
 * HelpScene (Epoch 6): a paged how-to-play reference reachable from the
 * menu. Left/right (or click zones) page through sections; ESC/Enter or the
 * Back prompt returns to the menu.
 */
export class HelpScene extends Phaser.Scene {
  private page = 0;
  private headingText!: Phaser.GameObjects.Text;
  private bodyText!: Phaser.GameObjects.Text;
  private pageText!: Phaser.GameObjects.Text;
  private readonly gamepadNav = new MenuGamepadNavigator();

  constructor() {
    super(SCENES.HELP);
  }

  create(): void {
    const cx = GAME_WIDTH / 2;

    this.add
      .text(cx, 60, 'HOW TO PLAY', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#e8f0ff',
      })
      .setOrigin(0.5);

    this.headingText = this.add
      .text(cx, 140, '', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffdd55',
      })
      .setOrigin(0.5);

    this.bodyText = this.add
      .text(48, 190, '', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#cdd8ee',
        lineSpacing: 8,
      })
      .setOrigin(0, 0);

    // Prev / Next tappable zones.
    const prev = this.add
      .text(40, GAME_HEIGHT - 90, '\u25C0 PREV', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#7ab0ff',
      })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.turn(-1));
    const next = this.add
      .text(GAME_WIDTH - 40, GAME_HEIGHT - 90, 'NEXT \u25B6', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#7ab0ff',
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.turn(1));
    void prev;
    void next;

    this.pageText = this.add
      .text(cx, GAME_HEIGHT - 90, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#5c6e99',
      })
      .setOrigin(0.5);

    const back = this.add
      .text(cx, GAME_HEIGHT - 48, 'BACK TO MENU (ESC)', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#7ab0ff',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start(SCENES.MENU));
    void back;

    this.render();

    const kb = this.input.keyboard;
    kb?.on('keydown-LEFT', () => this.turn(-1));
    kb?.on('keydown-RIGHT', () => this.turn(1));
    kb?.on('keydown-A', () => this.turn(-1));
    kb?.on('keydown-D', () => this.turn(1));
    kb?.on('keydown-ESC', () => this.scene.start(SCENES.MENU));
    kb?.on('keydown-ENTER', () => this.scene.start(SCENES.MENU));
  }

  update(): void {
    const nav = this.gamepadNav.read(this);
    if (nav.left) this.turn(-1);
    if (nav.right) this.turn(1);
    if (nav.confirm || nav.cancel) this.scene.start(SCENES.MENU);
  }

  private turn(dir: number): void {
    this.page = Phaser.Math.Wrap(this.page + dir, 0, SECTIONS.length);
    this.render();
  }

  private render(): void {
    const section = SECTIONS[this.page];
    this.headingText.setText(section.heading);
    this.bodyText.setText(section.lines.join('\n'));
    this.pageText.setText(`${this.page + 1} / ${SECTIONS.length}`);
  }
}
