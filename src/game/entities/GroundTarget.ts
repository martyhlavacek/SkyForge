import Phaser from 'phaser';
import { DEPTHS, GAME_HEIGHT, TEX } from '../config/constants';
import { angleTo } from '../../shared/mathUtils';
import { gameTime } from '../systems/GameTime';
import { contentRegistry } from '../systems/ContentRegistry';
import { EnemyWeapon, type EnemyWeaponSnapshot } from '../systems/EnemyWeapon';
import { ENEMY_EVENTS, type EnemyContext } from './Enemy';
import type { GroundObjectDef } from '../../schemas/levelSchema';

export interface GroundTargetStudioSnapshot {
  targetId: string;
  health: number;
  destroyed: boolean;
  engaged: boolean;
  flashTimer: number;
  weapon?: EnemyWeaponSnapshot;
}

/** Turret tuning (Sprint 4.5). Moves to JSON when ground objects get their own content folder (Epoch 10 composer). */
const TURRET = {
  health: 60,
  scoreValue: 250,
  weaponPattern: 'three_way_aimed',
  activationMargin: 32, // px beyond viewport top before it wakes
  barrelLength: 22,
} as const;

const HIT_FLASH_DURATION = 0.04;

/**
 * GroundTarget (Sprint 4.5): a turret fixed to the scrolling world.
 * Positioned every frame from WorldScroll distance (screenY = distance −
 * worldY), activates when entering the viewport, fires an EnemyWeapon
 * pattern at the player, is destructible for score, and never collides
 * with the player's ship (it lives on the ground plane) — only its
 * bullets threaten. resetState() supports timeline seeks in either
 * direction.
 */
export class GroundTarget extends Phaser.Physics.Arcade.Sprite {
  readonly targetId: string;
  private readonly worldY: number;
  private readonly creditValue: number;
  private health: number = TURRET.health;
  private destroyed = false;
  private engaged = false;
  private flashTimer = 0;
  private weapon: EnemyWeapon | null = null;
  private barrel: Phaser.GameObjects.Line;

  constructor(
    scene: Phaser.Scene,
    def: GroundObjectDef,
    private readonly ctx: EnemyContext,
  ) {
    super(scene, def.x, -100, TEX.TURRET);
    this.targetId = def.id;
    this.worldY = def.worldY;
    this.creditValue = def.creditValue;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(DEPTHS.GROUND);
    this.arcadeBody.setCircle(14, this.width / 2 - 14, this.height / 2 - 14);
    this.barrel = scene.add
      .line(0, 0, 0, 0, 0, -TURRET.barrelLength, 0x99ff99)
      .setOrigin(0, 0)
      .setLineWidth(2)
      .setDepth(DEPTHS.GROUND + 1);
    this.resetState();
  }

  get arcadeBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  /** Full revival — timeline seek in either direction (Sprint 4.5 acceptance). */
  resetState(): void {
    this.health = TURRET.health;
    this.destroyed = false;
    this.engaged = false;
    this.flashTimer = 0;
    this.weapon = null;
    this.setVisible(false);
    this.barrel.setVisible(false);
    this.arcadeBody.enable = false;
  }

  studioSnapshot(): GroundTargetStudioSnapshot {
    return {
      targetId: this.targetId,
      health: this.health,
      destroyed: this.destroyed,
      engaged: this.engaged,
      flashTimer: this.flashTimer,
      weapon: this.weapon?.snapshot(),
    };
  }

  restoreStudioSnapshot(snapshot: GroundTargetStudioSnapshot, distance: number): boolean {
    if (snapshot.targetId !== this.targetId) return false;
    this.resetState();
    this.updateWorld(distance, 0);
    this.health = snapshot.health;
    this.destroyed = snapshot.destroyed;
    this.flashTimer = snapshot.flashTimer;
    if (snapshot.destroyed || !snapshot.engaged) {
      this.engaged = false;
      this.weapon = null;
      this.setVisible(false);
      this.barrel.setVisible(false);
      this.arcadeBody.enable = false;
      return true;
    }
    this.engaged = true;
    this.setVisible(true);
    this.barrel.setVisible(true);
    this.arcadeBody.enable = true;
    if (!this.weapon) {
      const pattern = contentRegistry.projectilePatterns.get(TURRET.weaponPattern);
      this.weapon = pattern ? new EnemyWeapon(pattern, this.ctx.bulletPool) : null;
    }
    if (snapshot.weapon) this.weapon?.restore(snapshot.weapon);
    return true;
  }

  takeDamage(amount: number): void {
    if (this.destroyed || !this.engaged) return;
    this.health -= amount;
    this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.flashTimer = HIT_FLASH_DURATION;
    if (this.health <= 0) {
      this.destroyed = true;
      this.scene.events.emit(ENEMY_EVENTS.KILLED, {
        x: this.x,
        y: this.y,
        scoreValue: TURRET.scoreValue,
        creditValue: this.creditValue,
        rewardId: `ground:${this.targetId}`,
        rewardCategory: 'ground',
      });
      this.setVisible(false);
      this.barrel.setVisible(false);
      this.arcadeBody.enable = false;
    }
  }

  /** Called each frame by the scene with the current scrolled distance. */
  updateWorld(distance: number, deltaMs: number): void {
    const screenY = distance - this.worldY;
    const dt = (deltaMs / 1000) * gameTime.scale;

    if (this.destroyed) return;

    this.setPosition(this.x, screenY);
    this.arcadeBody.updateFromGameObject();

    const onScreen = screenY > -TURRET.activationMargin && screenY < GAME_HEIGHT + 32;
    if (onScreen && !this.engaged) {
      // Wake up: become visible, targetable, and armed (Sprint 4.5).
      this.engaged = true;
      this.setVisible(true);
      this.barrel.setVisible(true);
      this.arcadeBody.enable = true;
      const pattern = contentRegistry.projectilePatterns.get(TURRET.weaponPattern);
      this.weapon = pattern ? new EnemyWeapon(pattern, this.ctx.bulletPool) : null;
    }
    if (!onScreen && this.engaged && screenY >= GAME_HEIGHT + 32) {
      // Scrolled past the bottom: disarm quietly.
      this.engaged = false;
      this.setVisible(false);
      this.barrel.setVisible(false);
      this.arcadeBody.enable = false;
    }
    if (!this.engaged) return;

    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.clearTint();
        this.setTintMode(Phaser.TintModes.MULTIPLY);
      }
    }

    const target = this.ctx.getTarget();
    const aim = angleTo(this.x, this.y, target.x, target.y);
    this.barrel.setPosition(this.x, this.y);
    this.barrel.setRotation(aim + Math.PI / 2);
    if (target.alive && this.y > 0 && this.y < GAME_HEIGHT - 120) {
      this.weapon?.update(dt, this.x, this.y, aim, 1, true);
    }
  }
}
