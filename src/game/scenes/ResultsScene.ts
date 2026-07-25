import Phaser from 'phaser';
import { GAME_WIDTH, REGISTRY, SCENES } from '../config/constants';
import { telemetry } from '../debug/Telemetry';
import { MenuGamepadNavigator } from '../input/MenuGamepadNavigator';
import type { MissionRewardBreakdown } from '../economy/MissionEconomy';
import { audio } from '../systems/AudioManager';

export interface ResultsData {
  score?: number;
  maxMultiplier?: number;
  timeSeconds?: number;
  deaths?: number;
  levelName?: string;
  newHighScore?: boolean;
  creditBreakdown?: MissionRewardBreakdown;
  bankBalance?: number;
  newUnlockCount?: number;
}

/** Mission settlement summary and return point for the campaign loop. */
export class ResultsScene extends Phaser.Scene {
  private params: ResultsData = {};
  private ready = false;
  private readonly gamepadNav = new MenuGamepadNavigator();

  constructor() {
    super(SCENES.RESULTS);
  }

  init(data: ResultsData): void {
    this.params = data ?? {};
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const reward = this.params.creditBreakdown;

    this.add
      .text(cx, 56, 'MISSION COMPLETE', {
        fontFamily: 'monospace',
        fontSize: '36px',
        color: '#ffdd55',
      })
      .setOrigin(0.5);

    if (this.params.levelName) {
      this.add
        .text(cx, 104, this.params.levelName.toUpperCase(), {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#7ab0ff',
        })
        .setOrigin(0.5);
    }

    const mins = Math.floor((this.params.timeSeconds ?? 0) / 60);
    const secs = Math.floor((this.params.timeSeconds ?? 0) % 60);
    const combatRows = [
      ['SCORE', (this.params.score ?? 0).toString().padStart(8, '0')],
      ['MAX MULTIPLIER', `x${this.params.maxMultiplier ?? 1}`],
      ['TIME', `${mins}:${secs.toString().padStart(2, '0')}`],
      ['DEATHS', `${this.params.deaths ?? 0}`],
    ];
    this.drawRows(combatRows, 150, '#9db4e6');

    this.add
      .text(cx, 308, 'MISSION PAYOUT', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#66dd99',
      })
      .setOrigin(0.5);

    const payoutRows = reward
      ? [
          ['ENEMY BOUNTIES', this.credits(reward.enemyBounties)],
          ['GROUND TARGETS', this.credits(reward.groundBounties)],
          ['BOSS / PARTS', this.credits(reward.bossReward)],
          ['PICKUPS', this.credits(reward.pickupRewards)],
          ['MISSION REWARD', this.credits(reward.missionReward)],
          ['DIFFICULTY BONUS', this.credits(reward.difficultyBonus)],
          ['TOTAL BANKED', this.credits(reward.totalBanked)],
          ['BANK BALANCE', this.credits(this.params.bankBalance ?? 0)],
        ]
      : [
          ['TOTAL BANKED', this.credits(0)],
          ['BANK BALANCE', this.credits(this.params.bankBalance ?? 0)],
        ];
    this.drawRows(payoutRows, 348, '#8ed6aa', 29);

    const notices: string[] = [];
    if (this.params.newHighScore) notices.push('NEW HIGH SCORE');
    if ((this.params.newUnlockCount ?? 0) > 0) {
      notices.push(`${this.params.newUnlockCount} NEW EQUIPMENT UNLOCK${this.params.newUnlockCount === 1 ? '' : 'S'}`);
    }
    if (notices.length) {
      this.add
        .text(cx, 620, notices.join('   •   '), {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#ffdd55',
          align: 'center',
          wordWrap: { width: GAME_WIDTH - 48 },
        })
        .setOrigin(0.5);
      audio.play(this.params.newUnlockCount ? 'unlock' : 'uiConfirm');
    }

    if (this.registry.get(REGISTRY.DEBUG_MODE)) {
      const btn = this.add
        .text(cx, 700, '[ export telemetry ]', {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#66dd99',
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => this.exportTelemetry());
    }

    const prompt = this.add
      .text(cx, 820, 'PRESS ANY KEY → HANGAR', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#7ab0ff',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    prompt.on('pointerdown', () => this.returnToHangar());
    this.tweens.add({
      targets: prompt,
      alpha: 0.3,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    this.time.delayedCall(600, () => {
      this.ready = true;
      this.input.keyboard?.once('keydown', () => this.returnToHangar());
      this.input.once('pointerdown', () => this.returnToHangar());
    });
  }

  update(): void {
    if (!this.ready) return;
    const nav = this.gamepadNav.read(this);
    if (nav.confirm || nav.cancel) this.returnToHangar();
  }

  private drawRows(
    rows: string[][],
    startY: number,
    labelColor: string,
    spacing = 31,
  ): void {
    const cx = GAME_WIDTH / 2;
    rows.forEach(([label, value], i) => {
      const y = startY + i * spacing;
      this.add
        .text(cx - 150, y, label, {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: labelColor,
        })
        .setOrigin(0, 0.5);
      this.add
        .text(cx + 150, y, value, {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#e8f0ff',
        })
        .setOrigin(1, 0.5);
    });
  }

  private credits(value: number): string {
    return `${Math.floor(value).toString().padStart(6, '0')} CR`;
  }

  private returnToHangar(): void {
    if (!this.ready) return;
    audio.play('uiConfirm');
    this.scene.start(SCENES.HANGAR);
  }

  private exportTelemetry(): void {
    const blob = new Blob([telemetry.exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'skyforge_telemetry.json';
    a.click();
    URL.revokeObjectURL(url);
  }
}
