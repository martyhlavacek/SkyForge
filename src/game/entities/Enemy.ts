import Phaser from 'phaser';
import { DEPTHS, GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import { angleTo } from '../../shared/mathUtils';
import { gameTime } from '../systems/GameTime';
import { contentRegistry } from '../systems/ContentRegistry';
import { difficulty } from '../systems/DifficultyManager';
import { EnemyWeapon, type EnemyWeaponSnapshot } from '../systems/EnemyWeapon';
import {
  createMovementState,
  step,
  type MovementState,
} from '../systems/MovementRunner';
import type { EnemyDef } from '../../schemas/enemySchema';
import type { MovementDef } from '../../schemas/movementSchema';
import type { Projectile } from './Projectile';
import type { PoolManager } from '../systems/PoolManager';

/** Services the enemy needs while active — injected on activate. */
export interface EnemyContext {
  bulletPool: PoolManager<Projectile>;
  getTarget: () => { x: number; y: number; alive: boolean };
  /** Spawn a free-standing enemy (e.g. a bomber laying a mine, S5.1). */
  spawnEnemy?: (enemyId: string, x: number, y: number) => void;
  nextRewardId?: (sourceId: string) => string;
}

/** Optional per-spawn overrides (Sprint 3.3 spawner variants; formations use these in S4.1). */
export interface EnemyOverrides {
  movementPattern?: string;
  weaponPattern?: string | null;
  fireDelay?: number; // adds to the pattern's firstShotDelay (Sprint 4.1)
}

/** How an active enemy left play — formations/encounters track this (S4.1). */
export type DeactivateCause = 'killed' | 'exited';

export interface EnemyStudioSnapshot {
  enemyId: string;
  x: number;
  y: number;
  health: number;
  rewardId: string;
  movementId: string;
  movementState: MovementState;
  weaponPatterns: string[];
  weapons: EnemyWeaponSnapshot[];
  mineCooldown: number;
  mineTimer: number;
}

const OFFSCREEN = 64;
const TOP_GRACE = 2.0; // s before top-exit despawns (entries come from above)
const HIT_FLASH_DURATION = 0.04; // s

export const ENEMY_EVENTS = {
  KILLED: 'enemy:killed', // (enemy: Enemy)
} as const;

/**
 * Pooled, fully data-driven enemy (Sprints 2.x rewritten by 3.1–3.5).
 * Stats come from the ContentRegistry by id; movement is position-based via
 * MovementRunner; firing is an EnemyWeapon component from a pattern id.
 */
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  scoreValue = 0;
  creditValue = 0;
  rewardId = '';
  collisionDamage = 1;
  enemyId = '';
  drops: { pickup: string; chance: number }[] = [];

  private health = 0;
  private flashTimer = 0;
  private movementDef: MovementDef | null = null;
  private movementId = '';
  private movementState: MovementState | null = null;
  private weaponPatterns: string[] = [];
  private weapons: EnemyWeapon[] = [];
  private mineCooldown = Infinity; // Infinity = no mine layer on this enemy
  private mineTimer = 0;
  private ctx: EnemyContext | null = null;
  private onDeactivated: ((cause: DeactivateCause) => void) | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, '__DEFAULT');
    this.setDepth(DEPTHS.ENEMIES);
  }

  get arcadeBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  /**
   * Activate from a content id (Sprint 3.1). Returns false (and logs) if
   * the id is unknown — the registry error panel will already be showing
   * the root cause in dev.
   */
  activate(
    enemyId: string,
    x: number,
    y: number,
    ctx: EnemyContext,
    overrides?: EnemyOverrides,
    onDeactivated?: (cause: DeactivateCause) => void,
  ): boolean {
    const def: EnemyDef | undefined = contentRegistry.enemies.get(enemyId);
    if (!def) {
      console.error(`[Enemy] unknown enemy id "${enemyId}"`);
      return false;
    }

    const movementId = overrides?.movementPattern ?? def.movementPattern;
    const movementDef = contentRegistry.movement.get(movementId);
    if (!movementDef) {
      console.error(`[Enemy] unknown movement "${movementId}" for "${enemyId}"`);
      return false;
    }

    this.setTexture(def.sprite);
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    this.resetTint();

    const body = this.arcadeBody;
    body.enable = true;
    body.reset(x, y);
    const r = def.hitbox.radius;
    body.setCircle(r, this.width / 2 - r, this.height / 2 - r);
    body.setVelocity(0, 0); // movement is position-based

    this.health = difficulty.scaleHealth(def.health);
    this.scoreValue = def.scoreValue;
    this.creditValue = def.creditValue;
    this.rewardId = ctx.nextRewardId?.(def.id) ?? `${def.id}:${x}:${y}`;
    this.collisionDamage = def.collisionDamage;
    this.enemyId = def.id;
    this.drops = def.drops;
    this.flashTimer = 0;

    this.movementDef = movementDef;
    this.movementId = movementId;
    this.movementState = createMovementState(x, y);

    // weaponPattern may be a single id, an array of ids (concurrent slots),
    // or null. Overrides (formation members) supply a single id.
    this.weapons = [];
    this.mineCooldown = Infinity;
    this.mineTimer = 0;
    const raw = overrides?.weaponPattern !== undefined ? overrides.weaponPattern : def.weaponPattern;
    const patternIds: string[] = raw === null ? [] : Array.isArray(raw) ? raw : [raw];
    this.weaponPatterns = [...patternIds];
    for (const pid of patternIds) {
      const patternDef = contentRegistry.projectilePatterns.get(pid);
      if (!patternDef) {
        console.error(`[Enemy] unknown weaponPattern "${pid}" for "${enemyId}"`);
        continue;
      }
      // The mine layer spawns enemies (mines), not bullets — special path.
      if (pid === 'mine_layer') {
        this.mineCooldown = patternDef.cooldown;
        this.mineTimer = patternDef.firstShotDelay;
        continue;
      }
      this.weapons.push(new EnemyWeapon(patternDef, ctx.bulletPool, overrides?.fireDelay ?? 0));
    }

    this.ctx = ctx;
    this.onDeactivated = onDeactivated ?? null;
    return true;
  }

  /** Deactivate and notify the tracker exactly once (Sprint 4.1). */
  private finish(cause: DeactivateCause): void {
    const cb = this.onDeactivated;
    this.onDeactivated = null;
    this.deactivate();
    cb?.(cause);
  }

  /** Hard reset without notifications — used by timeline seek (Sprint 4.4). */
  forceClear(): void {
    this.onDeactivated = null;
    if (this.active) this.deactivate();
  }

  deactivate(): void {
    this.setActive(false);
    this.setVisible(false);
    this.resetTint();
    const body = this.arcadeBody;
    body.stop();
    body.enable = false;
    this.ctx = null;
    this.weapons = [];
    this.weaponPatterns = [];
    this.mineCooldown = Infinity;
    this.movementDef = null;
    this.movementId = '';
    this.movementState = null;
  }

  /** Clear tint AND restore multiply mode (Phaser 4 requirement after FILL). */
  private resetTint(): void {
    this.clearTint();
    this.setTintMode(Phaser.TintModes.MULTIPLY);
  }

  studioSnapshot(): EnemyStudioSnapshot | null {
    if (!this.active || !this.movementState) return null;
    return {
      enemyId: this.enemyId,
      x: this.x,
      y: this.y,
      health: this.health,
      rewardId: this.rewardId,
      movementId: this.movementId,
      movementState: structuredClone(this.movementState),
      weaponPatterns: [...this.weaponPatterns],
      weapons: this.weapons.map((weapon) => weapon.snapshot()),
      mineCooldown: this.mineCooldown,
      mineTimer: this.mineTimer,
    };
  }

  restoreStudioSnapshot(snapshot: EnemyStudioSnapshot, ctx: EnemyContext): boolean {
    const activated = this.activate(
      snapshot.enemyId,
      snapshot.x,
      snapshot.y,
      ctx,
      {
        movementPattern: snapshot.movementId,
        weaponPattern:
          snapshot.weaponPatterns.length === 0
            ? null
            : snapshot.weaponPatterns.length === 1
              ? snapshot.weaponPatterns[0]
              : undefined,
      },
    );
    if (!activated) return false;
    this.health = snapshot.health;
    this.rewardId = snapshot.rewardId;
    this.movementState = structuredClone(snapshot.movementState);
    this.setPosition(snapshot.x, snapshot.y);
    this.arcadeBody.reset(snapshot.x, snapshot.y);
    this.weapons.forEach((weapon, index) => {
      const state = snapshot.weapons[index];
      if (state) weapon.restore(state);
    });
    this.mineCooldown = snapshot.mineCooldown;
    this.mineTimer = snapshot.mineTimer;
    return true;
  }

  takeDamage(amount: number): void {
    if (!this.active) return;
    this.health -= amount;
    // Hit flash (Sprint 2.2). Phaser 4: setTint + TintModes.FILL.
    this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.flashTimer = HIT_FLASH_DURATION;
    if (this.health <= 0) this.explode();
  }

  private explode(): void {
    // Emit a plain payload (position + score + drops) so ground targets and
    // enemies share one KILLED handler in the scene.
    this.scene.events.emit(ENEMY_EVENTS.KILLED, {
      x: this.x,
      y: this.y,
      scoreValue: this.scoreValue,
      creditValue: this.creditValue,
      rewardId: this.rewardId,
      enemyId: this.enemyId,
      drops: this.drops,
    });
    this.finish('killed');
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.active || !this.ctx || !this.movementDef || !this.movementState) return;
    const dt = (delta / 1000) * gameTime.scale;

    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.resetTint();
    }

    // Position-based movement (Sprint 3.4).
    const target = this.ctx.getTarget();
    const result = step(this.movementState, this.movementDef, dt, { targetX: target.x });
    this.setPosition(result.x, result.y);
    this.arcadeBody.updateFromGameObject();
    if (result.done) {
      this.finish('exited');
      return;
    }

    // Firing (S3.3, multi-slot S5.1), gated to on-screen above the floor.
    if (this.weapons.length > 0 && target.alive && this.y > 0 && this.y < GAME_HEIGHT - 160) {
      const aim = angleTo(this.x, this.y, target.x, target.y);
      const originY = this.y + this.height / 2;
      for (const w of this.weapons) {
        w.update(dt, this.x, originY, aim, this.movementState.fireRateMultiplier, true);
      }
    }

    // Mine layer (S5.1): drop a mine enemy on cooldown while on-screen.
    if (this.mineCooldown !== Infinity && this.ctx.spawnEnemy && this.y > 0 && this.y < GAME_HEIGHT - 120) {
      this.mineTimer -= dt;
      if (this.mineTimer <= 0) {
        this.mineTimer += this.mineCooldown;
        this.ctx.spawnEnemy('mine', this.x, this.y + this.height / 2);
      }
    }

    // Despawn off-screen; top exits get a grace window so entries survive.
    const t = this.movementState.t;
    if (
      this.y > GAME_HEIGHT + OFFSCREEN ||
      this.x < -OFFSCREEN ||
      this.x > GAME_WIDTH + OFFSCREEN ||
      (this.y < -OFFSCREEN && t > TOP_GRACE)
    ) {
      this.finish('exited');
    }
  }
}
