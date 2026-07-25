import Phaser from 'phaser';
import { DEPTHS, GAME_HEIGHT } from '../config/constants';
import { gameTime } from '../systems/GameTime';
import { contentRegistry } from '../systems/ContentRegistry';
import type { PickupDef } from '../../schemas/pickupSchema';

export interface PickupStudioSnapshot {
  pickupId: string;
  x: number;
  y: number;
  life: number;
  baseX: number;
  swayT: number;
  fading: boolean;
  alpha: number;
  rewardId: string;
}

export const PICKUP_EVENTS = {
  COLLECTED: 'pickup:collected', // (def: PickupDef)
} as const;

const SWAY_AMPLITUDE = 10; // px
const SWAY_FREQUENCY = 1.5; // Hz
const OFFSCREEN = 48;

/**
 * Pooled pickup (Sprint 5.2). Drifts downward with a gentle sine sway and
 * is collected on player overlap with a generous radius (pickups should
 * feel magnetic, not precise). Effects are applied scene-side on the
 * COLLECTED event so this entity stays presentation-only.
 */
export class Pickup extends Phaser.Physics.Arcade.Sprite {
  private def: PickupDef | null = null;
  private life = 0;
  private baseX = 0;
  private swayT = 0;
  private fading = false;
  private attractor: (() => { x: number; y: number; radius: number } | null) | null =
    null;
  private rewardId = '';

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, '__DEFAULT');
    this.setDepth(DEPTHS.PICKUPS);
  }

  get arcadeBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  get definition(): PickupDef | null {
    return this.def;
  }

  activate(
    pickupId: string,
    x: number,
    y: number,
    attractor?: () => { x: number; y: number; radius: number } | null,
    rewardId = '',
  ): boolean {
    const def = contentRegistry.pickups.get(pickupId);
    if (!def) {
      console.error(`[Pickup] unknown pickup "${pickupId}"`);
      return false;
    }
    this.def = def;
    this.setTexture(def.texture);
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    this.setAlpha(1);
    this.fading = false;
    this.baseX = x;
    this.swayT = 0;
    this.life = def.lifetime;
    this.attractor = attractor ?? null;
    this.rewardId = rewardId;

    const body = this.arcadeBody;
    body.enable = true;
    body.reset(x, y);
    body.setCircle(12, this.width / 2 - 12, this.height / 2 - 12);
    return true;
  }

  deactivate(): void {
    this.setActive(false);
    this.setVisible(false);
    this.arcadeBody.stop();
    this.arcadeBody.enable = false;
    this.def = null;
    this.attractor = null;
    this.rewardId = '';
  }

  collect(): void {
    if (!this.active || !this.def) return;
    this.scene.events.emit(PICKUP_EVENTS.COLLECTED, {
      def: this.def,
      rewardId: this.rewardId,
    });
    this.deactivate();
  }

  studioSnapshot(): PickupStudioSnapshot | null {
    if (!this.active || !this.def) return null;
    return {
      pickupId: this.def.id,
      x: this.x,
      y: this.y,
      life: this.life,
      baseX: this.baseX,
      swayT: this.swayT,
      fading: this.fading,
      alpha: this.alpha,
      rewardId: this.rewardId,
    };
  }

  restoreStudioSnapshot(
    snapshot: PickupStudioSnapshot,
    attractor?: () => { x: number; y: number; radius: number } | null,
  ): boolean {
    if (
      !this.activate(
        snapshot.pickupId,
        snapshot.x,
        snapshot.y,
        attractor,
        snapshot.rewardId,
      )
    )
      return false;
    this.life = snapshot.life;
    this.baseX = snapshot.baseX;
    this.swayT = snapshot.swayT;
    this.fading = snapshot.fading;
    this.setAlpha(snapshot.alpha);
    return true;
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.active || !this.def) return;
    const dt = (delta / 1000) * gameTime.scale;

    const target = this.def.magnetizable ? this.attractor?.() : null;
    if (target) {
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 0 && distance <= target.radius) {
        const speed = Math.min(420, 110 + (target.radius - distance) * 6);
        this.x += (dx / distance) * speed * dt;
        this.y += (dy / distance) * speed * dt;
        this.baseX = this.x;
      } else {
        this.y += this.def.fallSpeed * dt;
        this.swayT += dt;
        this.x =
          this.baseX +
          SWAY_AMPLITUDE * Math.sin(2 * Math.PI * SWAY_FREQUENCY * this.swayT);
      }
    } else {
      this.y += this.def.fallSpeed * dt;
      this.swayT += dt;
      this.x =
        this.baseX + SWAY_AMPLITUDE * Math.sin(2 * Math.PI * SWAY_FREQUENCY * this.swayT);
    }

    this.life -= dt;
    // Fade out over the final second of life.
    if (this.life <= 1 && !this.fading) this.fading = true;
    if (this.fading) this.setAlpha(Math.max(0, this.life));

    if (this.life <= 0 || this.y > GAME_HEIGHT + OFFSCREEN) this.deactivate();
  }
}
