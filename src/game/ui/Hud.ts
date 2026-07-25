import Phaser from 'phaser';
import { DEPTHS, GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import { PLAYER_EVENTS } from '../entities/Player';
import { SCORE_EVENTS } from '../systems/ScoreSystem';
import type { DerivedShipStats } from '../equipment/ShipStatCalculator';
import type { ShipDefenseSnapshot } from '../player/ShipDefenseSystem';
import type { ShipEnergySnapshot } from '../player/ShipEnergySystem';

export const HUD_EVENTS = {
  WEAPON: 'hud:weapon',
  SECONDARY: 'hud:secondary',
  CREDITS: 'hud:credits',
  ENERGY_STARVED: 'hud:energyStarved',
} as const;

export class Hud {
  private scoreText: Phaser.GameObjects.Text;
  private creditsText: Phaser.GameObjects.Text;
  private weaponText: Phaser.GameObjects.Text;
  private multiplierText: Phaser.GameObjects.Text;
  private secondaryBar: Phaser.GameObjects.Rectangle;
  private armorBar: Phaser.GameObjects.Rectangle;
  private shieldBar: Phaser.GameObjects.Rectangle;
  private energyBar: Phaser.GameObjects.Rectangle;
  private energyLabel: Phaser.GameObjects.Text;
  private bossName!: Phaser.GameObjects.Text;
  private bossBarBg!: Phaser.GameObjects.Rectangle;
  private bossBarGhost!: Phaser.GameObjects.Rectangle;
  private bossBarFill!: Phaser.GameObjects.Rectangle;
  private bossVisible = false;
  private bossGhostFrac = 1;

  constructor(private readonly scene: Phaser.Scene, stats: DerivedShipStats) {
    const barW = 150;
    const makeBar = (y: number, color: number, label: string) => {
      scene.add.text(12, y - 8, label, { fontFamily: 'monospace', fontSize: '10px', color: '#9db4e6' }).setDepth(DEPTHS.HUD);
      scene.add.rectangle(62, y, barW + 2, 9).setOrigin(0, 0.5).setStrokeStyle(1, 0x4a5a7a).setDepth(DEPTHS.HUD);
      return scene.add.rectangle(63, y, barW, 7, color).setOrigin(0, 0.5).setDepth(DEPTHS.HUD);
    };
    this.armorBar = makeBar(18, 0xff6655, 'ARM');
    this.shieldBar = makeBar(31, 0x66bbff, 'SHD');
    this.energyBar = makeBar(44, 0xffdd55, 'ENG');
    this.armorBar.setScale(1, 1);
    this.shieldBar.setScale(stats.maxShield > 0 ? 1 : 0, 1);
    this.energyBar.setScale(1, 1);

    this.scoreText = scene.add
      .text(GAME_WIDTH - 12, 10, this.formatScore(0), { fontFamily: 'monospace', fontSize: '17px', color: '#e8f0ff' })
      .setOrigin(1, 0)
      .setDepth(DEPTHS.HUD);
    this.creditsText = scene.add
      .text(GAME_WIDTH - 12, 34, 'CR 00000', { fontFamily: 'monospace', fontSize: '13px', color: '#66dd99' })
      .setOrigin(1, 0)
      .setDepth(DEPTHS.HUD);

    this.weaponText = scene.add
      .text(12, GAME_HEIGHT - 26, 'PRIMARY', { fontFamily: 'monospace', fontSize: '13px', color: '#7ab0ff' })
      .setDepth(DEPTHS.HUD);
    this.energyLabel = scene.add
      .text(12, GAME_HEIGHT - 44, '', { fontFamily: 'monospace', fontSize: '11px', color: '#ff7766' })
      .setDepth(DEPTHS.HUD);

    this.multiplierText = scene.add
      .text(GAME_WIDTH / 2, 42, '', { fontFamily: 'monospace', fontSize: '20px', color: '#ffdd55' })
      .setOrigin(0.5)
      .setDepth(DEPTHS.HUD);

    scene.add.rectangle(GAME_WIDTH - 12, GAME_HEIGHT - 20, 80, 8).setOrigin(1, 0.5).setStrokeStyle(1, 0x4a5a7a).setDepth(DEPTHS.HUD);
    this.secondaryBar = scene.add.rectangle(GAME_WIDTH - 91, GAME_HEIGHT - 20, 78, 6, 0xff8844).setOrigin(0, 0.5).setDepth(DEPTHS.HUD);

    const bw = GAME_WIDTH - 80;
    this.bossName = scene.add.text(GAME_WIDTH / 2, 66, '', { fontFamily: 'monospace', fontSize: '13px', color: '#ffbbbb' }).setOrigin(0.5).setDepth(DEPTHS.HUD).setVisible(false);
    this.bossBarBg = scene.add.rectangle(GAME_WIDTH / 2, 82, bw, 10, 0x330000).setStrokeStyle(1, 0x883333).setDepth(DEPTHS.HUD).setVisible(false);
    this.bossBarGhost = scene.add.rectangle(GAME_WIDTH / 2 - bw / 2, 82, bw, 8, 0xffaa66).setOrigin(0, 0.5).setDepth(DEPTHS.HUD).setVisible(false);
    this.bossBarFill = scene.add.rectangle(GAME_WIDTH / 2 - bw / 2, 82, bw, 8, 0xff4455).setOrigin(0, 0.5).setDepth(DEPTHS.HUD).setVisible(false);

    scene.events.on(PLAYER_EVENTS.DEFENSE, this.onDefense, this);
    scene.events.on(PLAYER_EVENTS.ENERGY, this.onEnergy, this);
    scene.events.on(SCORE_EVENTS.CHANGED, this.onScore, this);
    scene.events.on(HUD_EVENTS.WEAPON, this.onWeapon, this);
    scene.events.on(HUD_EVENTS.SECONDARY, this.onSecondary, this);
    scene.events.on(HUD_EVENTS.CREDITS, this.onCredits, this);
    scene.events.on(HUD_EVENTS.ENERGY_STARVED, this.onEnergyStarved, this);
    scene.events.on('multiplier:changed', this.onMultiplier, this);
    scene.events.on('boss:started', this.onBossStart, this);
    scene.events.on('boss:health', this.onBossHealth, this);
    scene.events.on('boss:defeated', this.onBossDefeated, this);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroyListeners());
  }

  private destroyListeners(): void {
    const events = this.scene.events;
    events.off(PLAYER_EVENTS.DEFENSE, this.onDefense, this);
    events.off(PLAYER_EVENTS.ENERGY, this.onEnergy, this);
    events.off(SCORE_EVENTS.CHANGED, this.onScore, this);
    events.off(HUD_EVENTS.WEAPON, this.onWeapon, this);
    events.off(HUD_EVENTS.SECONDARY, this.onSecondary, this);
    events.off(HUD_EVENTS.CREDITS, this.onCredits, this);
    events.off(HUD_EVENTS.ENERGY_STARVED, this.onEnergyStarved, this);
    events.off('multiplier:changed', this.onMultiplier, this);
    events.off('boss:started', this.onBossStart, this);
    events.off('boss:health', this.onBossHealth, this);
    events.off('boss:defeated', this.onBossDefeated, this);
    events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate, this);
  }

  private formatScore(v: number): string { return v.toString().padStart(8, '0'); }
  private onDefense(state: ShipDefenseSnapshot): void {
    this.armorBar.setScale(state.maxArmor > 0 ? Phaser.Math.Clamp(state.armor / state.maxArmor, 0, 1) : 0, 1);
    this.shieldBar.setScale(state.maxShield > 0 ? Phaser.Math.Clamp(state.shield / state.maxShield, 0, 1) : 0, 1);
  }
  private onEnergy(state: ShipEnergySnapshot): void {
    this.energyBar.setScale(state.maximum > 0 ? Phaser.Math.Clamp(state.current / state.maximum, 0, 1) : 0, 1);
  }
  private onCredits(credits: number): void { this.creditsText.setText(`CR ${Math.max(0, Math.floor(credits)).toString().padStart(5, '0')}`); }
  private onEnergyStarved(): void {
    this.energyLabel.setText('ENERGY LOW');
    this.scene.tweens.killTweensOf(this.energyLabel);
    this.energyLabel.setAlpha(1);
    this.scene.tweens.add({ targets: this.energyLabel, alpha: 0, duration: 550 });
  }
  private onScore(score: number): void {
    this.scoreText.setText(this.formatScore(score));
    this.scene.tweens.killTweensOf(this.scoreText);
    this.scoreText.setScale(1);
    this.scene.tweens.add({ targets: this.scoreText, scale: { from: 1.18, to: 1 }, duration: 120, ease: 'Quad.easeOut' });
  }
  private onWeapon(label: string): void { this.weaponText.setText(label); }
  private onSecondary(readiness: number): void {
    this.secondaryBar.setScale(readiness, 1);
    this.secondaryBar.setFillStyle(readiness >= 1 ? 0xff8844 : 0x884422);
  }
  private onBossStart(displayName: string): void {
    this.bossVisible = true; this.bossGhostFrac = 1;
    this.bossName.setText(displayName).setVisible(true);
    [this.bossBarBg, this.bossBarGhost, this.bossBarFill].forEach((o) => o.setVisible(true));
  }
  private onBossHealth(fraction: number): void { this.bossBarFill.setScale(Math.max(0, fraction), 1); }
  private onBossDefeated(): void {
    this.bossVisible = false; this.bossName.setVisible(false);
    [this.bossBarBg, this.bossBarGhost, this.bossBarFill].forEach((o) => o.setVisible(false));
  }
  private onUpdate(_t: number, deltaMs: number): void {
    if (!this.bossVisible) return;
    const target = this.bossBarFill.scaleX;
    this.bossGhostFrac += (target - this.bossGhostFrac) * Math.min(1, (deltaMs / 1000) * 3);
    this.bossBarGhost.setScale(Math.max(0, this.bossGhostFrac), 1);
  }
  private onMultiplier(tier: number, meter: number, decaying: boolean): void {
    if (tier <= 1 && meter <= 0) { this.multiplierText.setText(''); return; }
    this.multiplierText.setText(`x${tier}`);
    this.multiplierText.setColor(decaying ? '#ff6655' : '#ffdd55');
  }
}
