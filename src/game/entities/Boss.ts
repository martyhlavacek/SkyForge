import Phaser from 'phaser';
import { DEPTHS } from '../config/constants';
import { angleTo } from '../../shared/mathUtils';
import { contentRegistry } from '../systems/ContentRegistry';
import { EnemyWeapon } from '../systems/EnemyWeapon';
import { createMovementState, step, type MovementState } from '../systems/MovementRunner';
import type { BossDef, BossPartDef, BossPhaseDef } from '../../schemas/bossSchema';
import type { MovementDef } from '../../schemas/movementSchema';
import type { EnemyContext } from './Enemy';

export const BOSS_EVENTS = {
  HEALTH: 'boss:health', // (fraction 0..1, displayName)
  PART_DESTROYED: 'boss:partDestroyed',
  DEFEATED: 'boss:defeated',
  STARTED: 'boss:started', // (displayName)
} as const;

const ENTRY_Y = 140;
const ENTRY_SPEED = 90;
const HIT_FLASH_DURATION = 0.05;

type BossState = 'entering' | 'telegraph' | 'fighting' | 'defeated';

/** A live destructible part — manual circle hit-test, no arcade body (PDR §16.1). */
interface LivePart {
  def: BossPartDef;
  health: number;
  destroyed: boolean;
  weapon: EnemyWeapon | null;
  sprite: Phaser.GameObjects.Arc;
}

/**
 * Boss (Sprints 6.1–6.3). A single large entity with health-gated phases.
 * The main body has an arcade body (collides with player bullets like any
 * enemy); parts are manually circle-tested against player bullets by the
 * controller. Phase changes clear boss bullets, telegraph, then swap
 * movement + weapon patterns.
 */
export class Boss extends Phaser.Physics.Arcade.Sprite {
  private def!: BossDef;
  private bossId = '';
  private ctx!: EnemyContext;
  private health = 0;
  private phaseIndex = -1;
  private bossState: BossState = 'entering';
  private telegraphTimer = 0;
  private flashTimer = 0;
  private fightTime = 0; // seconds spent in fighting states (for enrage)
  private enraged = false;

  private movementDef: MovementDef | null = null;
  private movementState: MovementState | null = null;
  private weapons: EnemyWeapon[] = [];
  private parts: LivePart[] = [];
  private defeatTimer = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, '__DEFAULT');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(DEPTHS.ENEMIES);
  }

  get arcadeBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  get isDefeated(): boolean {
    return this.bossState === 'defeated';
  }

  get definitionId(): string {
    return this.bossId;
  }

  activate(bossId: string, ctx: EnemyContext): boolean {
    const def = contentRegistry.bosses.get(bossId);
    if (!def) {
      console.error(`[Boss] unknown boss "${bossId}"`);
      return false;
    }
    this.def = def;
    this.bossId = bossId;
    this.ctx = ctx;
    this.health = def.totalHealth;
    this.phaseIndex = -1;
    this.bossState = 'entering';
    this.fightTime = 0;
    this.enraged = false;
    this.flashTimer = 0;

    this.setTexture(def.sprite);
    this.setPosition(this.scene.scale.width / 2, -80);
    this.setActive(true);
    this.setVisible(true);
    this.clearTint();
    this.setTintMode(Phaser.TintModes.MULTIPLY);

    const body = this.arcadeBody;
    body.enable = true;
    body.reset(this.x, this.y);
    const r = def.hitboxRadius;
    body.setCircle(r, this.width / 2 - r, this.height / 2 - r);
    body.setVelocity(0, 0);

    this.scene.events.emit(BOSS_EVENTS.STARTED, def.displayName);
    this.emitHealth();
    return true;
  }

  private get hpFraction(): number {
    return this.health / this.def.totalHealth;
  }

  private emitHealth(): void {
    this.scene.events.emit(BOSS_EVENTS.HEALTH, this.hpFraction, this.def.displayName);
  }

  /** Pick the active phase: first phase whose threshold < current hp%. */
  private phaseForHealth(): number {
    for (let i = 0; i < this.def.phases.length; i++) {
      if (this.hpFraction > this.def.phases[i].healthThreshold) return i;
    }
    return this.def.phases.length - 1;
  }

  private enterPhase(index: number): void {
    this.phaseIndex = index;
    const phase = this.def.phases[index];

    // Clear existing boss bullets so a phase change reads cleanly.
    this.ctx.bulletPool.group
      .getMatching('active', true)
      .forEach((p) => (p as { deactivate: () => void }).deactivate());

    // Movement.
    const mv = contentRegistry.movement.get(phase.movement);
    this.movementDef = mv ?? null;
    this.movementState = createMovementState(this.x, this.y);

    // Body weapons.
    this.weapons = phase.weaponPatterns
      .map((id) => contentRegistry.projectilePatterns.get(id))
      .filter((d): d is NonNullable<typeof d> => d !== undefined)
      .map((d) => new EnemyWeapon(d, this.ctx.bulletPool));

    // Destructible parts.
    this.clearParts();
    this.parts = phase.parts.map((partDef) => {
      const pattern = partDef.weaponPattern
        ? contentRegistry.projectilePatterns.get(partDef.weaponPattern)
        : undefined;
      return {
        def: partDef,
        health: partDef.health,
        destroyed: false,
        weapon: pattern ? new EnemyWeapon(pattern, this.ctx.bulletPool) : null,
        sprite: this.scene.add
          .circle(
            this.x + partDef.offsetX,
            this.y + partDef.offsetY,
            partDef.radius,
            0xcc5566,
          )
          .setDepth(DEPTHS.ENEMIES + 1),
      };
    });

    this.beginTelegraph(phase);
  }

  private beginTelegraph(phase: BossPhaseDef): void {
    this.bossState = 'telegraph';
    this.telegraphTimer = phase.telegraphDuration;
  }

  private clearParts(): void {
    for (const p of this.parts) p.sprite.destroy();
    this.parts = [];
  }

  /** Damage the main body (player-bullet overlap handled by the scene). */
  takeDamage(amount: number): void {
    if (this.bossState === 'defeated' || this.bossState === 'entering') return;
    this.health = Math.max(0, this.health - amount);
    this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.flashTimer = HIT_FLASH_DURATION;
    this.emitHealth();
    if (this.health <= 0) this.beginDefeat();
  }

  /**
   * Manual circle hit-test for parts (PDR §16.1). Returns the damage
   * absorbed by a part, or 0 if the point misses all live parts. Called by
   * the scene for each active player bullet.
   */
  hitPart(px: number, py: number, damage: number): boolean {
    for (const part of this.parts) {
      if (part.destroyed) continue;
      const cx = this.x + part.def.offsetX;
      const cy = this.y + part.def.offsetY;
      if (
        Phaser.Math.Distance.Squared(px, py, cx, cy) <=
        part.def.radius * part.def.radius
      ) {
        part.health -= damage;
        part.sprite.setFillStyle(0xffffff);
        this.scene.time.delayedCall(40, () => {
          if (!part.destroyed) part.sprite.setFillStyle(0xcc5566);
        });
        if (part.health <= 0) {
          part.destroyed = true;
          part.sprite.setVisible(false);
          this.scene.events.emit(BOSS_EVENTS.PART_DESTROYED, {
            x: cx,
            y: cy,
            scoreValue: part.def.scoreValue,
            creditValue: part.def.creditValue,
            rewardId: `boss:${this.bossId}:phase:${this.phaseIndex}:part:${part.def.id}`,
            rewardCategory: 'boss',
          });
        }
        return true;
      }
    }
    return false;
  }

  private beginDefeat(): void {
    this.bossState = 'defeated';
    this.defeatTimer = this.def.defeatDuration;
    this.arcadeBody.enable = false;
    this.arcadeBody.stop();
    this.weapons = [];
    this.clearParts();
  }

  /** Dev: force the next phase (PDR §29, `B` key). */
  forceNextPhase(): void {
    if (this.bossState === 'defeated') return;
    const next = Math.min(this.phaseIndex + 1, this.def.phases.length - 1);
    const phase = this.def.phases[next];
    // Drop health to just under this phase's entry threshold.
    this.health = Math.max(1, this.def.totalHealth * phase.healthThreshold - 1);
    this.emitHealth();
  }

  /** Driven from GameScene.update (Boss is standalone, not pool-managed). */
  tick(dt: number): void {
    if (!this.active) return;

    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.clearTint();
        this.setTintMode(Phaser.TintModes.MULTIPLY);
      }
    }

    switch (this.bossState) {
      case 'entering':
        this.y += ENTRY_SPEED * dt;
        if (this.y >= ENTRY_Y) {
          this.y = ENTRY_Y;
          this.enterPhase(this.phaseForHealth());
        }
        break;

      case 'telegraph':
        // Pulse the tint while telegraphing the new phase.
        this.setTint(0xffaa66).setTintMode(Phaser.TintModes.FILL);
        this.telegraphTimer -= dt;
        if (this.telegraphTimer <= 0) {
          this.clearTint();
          this.setTintMode(Phaser.TintModes.MULTIPLY);
          this.bossState = 'fighting';
        }
        break;

      case 'fighting':
        this.updateFighting(dt);
        break;

      case 'defeated':
        this.updateDefeat(dt);
        break;
    }
  }

  private updateFighting(dt: number): void {
    this.fightTime += dt;

    // Enrage (PDR §16.1): after N seconds, all cooldowns shrink.
    let cooldownMul = 1;
    if (this.def.enrage && this.fightTime >= this.def.enrage.afterSeconds) {
      cooldownMul = this.def.enrage.cooldownMultiplier;
      this.enraged = true;
    }

    // Movement.
    if (this.movementDef && this.movementState) {
      const target = this.ctx.getTarget();
      const r = step(this.movementState, this.movementDef, dt, { targetX: target.x });
      this.setPosition(r.x, r.y);
      this.arcadeBody.updateFromGameObject();
    }

    // Part sprites follow the body.
    for (const part of this.parts) {
      if (part.destroyed) continue;
      part.sprite.setPosition(this.x + part.def.offsetX, this.y + part.def.offsetY);
    }

    const target = this.ctx.getTarget();
    const aim = angleTo(this.x, this.y, target.x, target.y);
    const canFire = target.alive;

    for (const w of this.weapons) {
      w.update(dt, this.x, this.y + 20, aim, cooldownMul, canFire);
    }
    for (const part of this.parts) {
      if (part.destroyed || !part.weapon) continue;
      const cx = this.x + part.def.offsetX;
      const cy = this.y + part.def.offsetY;
      const partAim = angleTo(cx, cy, target.x, target.y);
      part.weapon.update(dt, cx, cy, partAim, cooldownMul, canFire);
    }

    // Re-evaluate phase (health may have crossed a threshold).
    const shouldBe = this.phaseForHealth();
    if (shouldBe !== this.phaseIndex) this.enterPhase(shouldBe);
  }

  private updateDefeat(dt: number): void {
    this.defeatTimer -= dt;
    // Blink out during the defeat sequence.
    this.setAlpha(0.5 + 0.5 * Math.sin(this.defeatTimer * 30));
    if (this.defeatTimer <= 0) {
      this.setActive(false);
      this.setVisible(false);
      this.scene.events.emit(BOSS_EVENTS.DEFEATED, {
        bossId: this.bossId,
        totalScore: this.def.totalHealth,
        creditValue: this.def.creditValue,
        rewardId: `boss:${this.bossId}`,
      });
    }
  }

  get enrageActive(): boolean {
    return this.enraged;
  }

  /** Defeat position for the explosion sequence. */
  get centerY(): number {
    return this.y;
  }

  destroyVisuals(): void {
    this.clearParts();
  }
}
