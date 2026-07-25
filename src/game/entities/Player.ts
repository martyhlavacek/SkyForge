import Phaser from 'phaser';
import { DEPTHS, GAME_WIDTH, GAME_HEIGHT, REGISTRY, TEX } from '../config/constants';
import { PLAYER } from '../config/playerConfig';
import { clamp } from '../../shared/mathUtils';
import type { InputState } from '../input/InputManager';
import { gameTime } from '../systems/GameTime';
import type { DerivedShipStats } from '../equipment/ShipStatCalculator';
import { ShipEnergySystem } from '../player/ShipEnergySystem';
import { ShipDefenseSystem, type ShipDefenseSnapshot } from '../player/ShipDefenseSystem';

export const PLAYER_EVENTS = {
  DAMAGED: 'player:damaged',
  DEFENSE: 'player:defense',
  ENERGY: 'player:energy',
  DIED: 'player:died',
} as const;

/** Runtime player driven by one immutable calculated ship configuration. */
export class Player extends Phaser.Physics.Arcade.Sprite {
  readonly energy: ShipEnergySystem;
  readonly defense: ShipDefenseSystem;
  private invulnTimer = 0;
  private blinkTimer = 0;
  private dead = false;
  private focusDot!: Phaser.GameObjects.Arc;
  private shadow!: Phaser.GameObjects.Image;
  private lastDefense = '';
  private lastEnergy = -1;

  constructor(
    scene: Phaser.Scene,
    readonly stats: DerivedShipStats,
  ) {
    super(scene, GAME_WIDTH / 2, GAME_HEIGHT - 120, TEX.PLAYER);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(DEPTHS.PLAYER);

    this.energy = new ShipEnergySystem(stats.maxEnergy, stats.energyRegenPerSecond);
    this.defense = new ShipDefenseSystem({
      maxArmor: stats.maxArmor,
      maxShield: stats.maxShield,
      shieldRechargeDelay: stats.shieldRechargeDelay,
      shieldRechargeRate: stats.shieldRechargeRate,
      shieldRechargeEnergyPerPoint: stats.shieldRechargeEnergyPerPoint,
    });

    const body = this.arcadeBody;
    body.setMaxSpeed(stats.maxSpeed);
    body.setDrag(stats.drag, stats.drag);
    body.setCircle(
      stats.collisionRadius,
      this.width / 2 - stats.collisionRadius,
      this.height / 2 - stats.collisionRadius,
    );

    this.shadow = scene.add
      .image(
        this.x + PLAYER.shadowOffsetX,
        this.y + PLAYER.shadowOffsetY,
        TEX.PLAYER_SHADOW,
      )
      .setDepth(DEPTHS.PLAYER - 1)
      .setScale(PLAYER.shadowScaleX, PLAYER.shadowScaleY)
      .setAlpha(PLAYER.shadowOpacity);

    this.focusDot = scene.add
      .circle(this.x, this.y, Math.max(2, stats.collisionRadius - 1), 0xffffff)
      .setDepth(DEPTHS.PLAYER_MARKER)
      .setVisible(false);
    this.emitSystems(true);
  }

  get arcadeBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  /** Compatibility alias for legacy systems; armor is now a continuous value. */
  get hull(): number {
    return this.defense.armor;
  }
  set hull(value: number) {
    this.defense.setArmor(value);
    this.emitSystems(true);
  }
  get maxHull(): number {
    return this.defense.maxArmor;
  }
  get shield(): number {
    return this.defense.shield;
  }
  get isDead(): boolean {
    return this.dead;
  }
  get survivabilityFraction(): number {
    const max = this.defense.maxArmor + this.defense.maxShield;
    return max > 0 ? (this.defense.armor + this.defense.shield) / max : 0;
  }

  get isInvulnerable(): boolean {
    return (
      this.invulnTimer > 0 ||
      this.dead ||
      this.scene.registry.get(REGISTRY.DEBUG_INVULNERABLE) === true
    );
  }

  handleInput(input: InputState, touchDelta?: { x: number; y: number }): void {
    if (this.dead) return;
    const body = this.arcadeBody;
    body.setMaxSpeed(input.focus ? this.stats.focusedSpeed : this.stats.maxSpeed);
    this.focusDot.setVisible(input.focus);
    if (touchDelta && (touchDelta.x !== 0 || touchDelta.y !== 0)) {
      body.setAcceleration(0, 0);
      body.setVelocity(0, 0);
      this.x += touchDelta.x;
      this.y += touchDelta.y;
    } else {
      body.setAcceleration(
        input.moveX * this.stats.acceleration,
        input.moveY * this.stats.acceleration,
      );
    }
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    const dt = (delta / 1000) * gameTime.scale;
    this.energy.update(dt);
    this.defense.update(dt, this.energy);
    this.emitSystems();

    const body = this.arcadeBody;
    const p = PLAYER.boundsPadding + this.width / 2;
    const cx = clamp(this.x, p, GAME_WIDTH - p);
    const cy = clamp(this.y, p, GAME_HEIGHT - p);
    if (cx !== this.x) {
      this.x = cx;
      body.setVelocityX(0);
    }
    if (cy !== this.y) {
      this.y = cy;
      body.setVelocityY(0);
    }
    this.focusDot.setPosition(this.x, this.y);
    this.shadow.setPosition(this.x + PLAYER.shadowOffsetX, this.y + PLAYER.shadowOffsetY);
    this.shadow.setVisible(this.visible);
    if (this.invulnTimer <= 0) this.shadow.setAlpha(PLAYER.shadowOpacity);

    if (this.invulnTimer > 0) {
      this.invulnTimer -= dt;
      this.blinkTimer += dt;
      const period = 1 / PLAYER.blinkHz;
      this.setAlpha(this.blinkTimer % period < period / 2 ? 0.25 : 1);
      this.shadow.setAlpha(this.alpha * PLAYER.shadowOpacity);
      if (this.invulnTimer <= 0) {
        this.setAlpha(1);
        this.shadow.setAlpha(PLAYER.shadowOpacity);
        this.blinkTimer = 0;
      }
    }
  }

  takeDamage(amount: number): boolean {
    if (this.isInvulnerable) return false;
    const result = this.defense.takeDamage(amount);
    this.emitSystems(true);
    this.scene.events.emit(PLAYER_EVENTS.DAMAGED, result);
    if (result.destroyed) this.die();
    else {
      this.invulnTimer = PLAYER.invulnDuration;
      this.blinkTimer = 0;
    }
    return true;
  }

  restoreShield(amount: number): number {
    const restored = this.defense.restoreShield(amount);
    this.emitSystems(true);
    return restored;
  }

  repairArmor(amount: number): number {
    const repaired = this.defense.repairArmor(amount);
    this.emitSystems(true);
    return repaired;
  }

  private emitSystems(force = false): void {
    const defense = this.defense.snapshot();
    const defenseKey = `${defense.armor.toFixed(2)}:${defense.shield.toFixed(2)}`;
    if (force || defenseKey !== this.lastDefense) {
      this.scene.events.emit(
        PLAYER_EVENTS.DEFENSE,
        defense satisfies ShipDefenseSnapshot,
      );
      this.lastDefense = defenseKey;
    }
    const energyFraction = this.energy.fraction;
    if (force || Math.abs(energyFraction - this.lastEnergy) > 0.002) {
      this.scene.events.emit(PLAYER_EVENTS.ENERGY, this.energy.snapshot());
      this.lastEnergy = energyFraction;
    }
  }

  override destroy(fromScene?: boolean): void {
    this.shadow.destroy();
    this.focusDot.destroy();
    super.destroy(fromScene);
  }

  private die(): void {
    this.dead = true;
    this.setVisible(false);
    this.shadow.setVisible(false);
    this.focusDot.setVisible(false);
    this.arcadeBody.stop();
    this.arcadeBody.enable = false;
    this.scene.events.emit(PLAYER_EVENTS.DIED);
  }
}
