import { COLLISION } from '../config/constants';
import { deg2rad } from '../../shared/mathUtils';
import { contentRegistry } from './ContentRegistry';
import type { WeaponDef } from '../../schemas/weaponSchema';
import type { Projectile } from '../entities/Projectile';
import type { PoolManager } from './PoolManager';
import { audio } from './AudioManager';
import type { RuntimeWeaponSpec } from '../equipment/ShipStatCalculator';
import type { ShipEnergySystem } from '../player/ShipEnergySystem';

const BULLET_LIFETIME = 2;
const MISSILE_LIFETIME = 4;

export type TargetFinder = () => { x: number; y: number } | null;

class WeaponSlot {
  private def: WeaponDef | null = null;
  private spec: RuntimeWeaponSpec | null = null;
  private level = 1;
  private cooldownTimer = 0;
  private starvationCooldown = 0;

  constructor(
    private readonly pool: PoolManager<Projectile>,
    private readonly findTarget: TargetFinder,
    private readonly lifetime: number,
    private readonly energy?: ShipEnergySystem,
    private readonly onStarved?: () => void,
  ) {}

  configure(spec: RuntimeWeaponSpec): boolean {
    const def = contentRegistry.weapons.get(spec.weaponDefId);
    if (!def) {
      console.error(`[WeaponSlot] unknown weapon "${spec.weaponDefId}"`);
      return false;
    }
    this.def = def;
    this.spec = structuredClone(spec);
    this.level = Math.min(def.levels.length, Math.max(1, spec.upgradeLevel + 1));
    this.cooldownTimer = 0;
    return true;
  }

  equipLegacy(weaponId: string, keepLevel: boolean): boolean {
    const def = contentRegistry.weapons.get(weaponId);
    if (!def) return false;
    const level = keepLevel ? Math.min(this.level, def.levels.length) : 1;
    return this.configure({
      equipmentId: weaponId,
      weaponDefId: weaponId,
      upgradeLevel: level - 1,
      energyPerVolley: 0,
      damageMultiplier: 1,
      fireIntervalMultiplier: 1,
    });
  }

  setLevel(n: number): void {
    if (!this.def) return;
    this.level = Math.max(1, Math.min(n, this.def.levels.length));
  }

  get currentLevel(): number { return this.level; }
  get id(): string { return this.def?.id ?? 'none'; }
  get equipmentId(): string { return this.spec?.equipmentId ?? this.id; }
  get displayName(): string {
    return this.def ? `${this.def.displayName.toUpperCase()} Lv${this.level}` : '—';
  }
  get readiness(): number {
    if (!this.def) return 1;
    const interval = this.def.levels[this.level - 1].fireInterval * (this.spec?.fireIntervalMultiplier ?? 1);
    return interval <= 0 ? 1 : 1 - Math.max(0, this.cooldownTimer) / interval;
  }
  hasWeapon(): boolean { return this.def !== null; }

  update(dt: number, firing: boolean, shipX: number, shipY: number): boolean {
    this.cooldownTimer = Math.max(0, this.cooldownTimer - dt);
    this.starvationCooldown = Math.max(0, this.starvationCooldown - dt);
    if (!firing || this.cooldownTimer > 0 || !this.def) return false;

    const lvl = this.def.levels[this.level - 1];
    const projectileCount = lvl.muzzles.length * lvl.spreadAngles.length;
    if (this.pool.availableCount() < projectileCount) return false;

    const energyCost = this.spec?.energyPerVolley ?? 0;
    if (this.energy && !this.energy.spend(energyCost)) {
      if (this.starvationCooldown <= 0) {
        this.onStarved?.();
        this.starvationCooldown = 0.22;
      }
      return false;
    }

    const category = this.def.collisionCategory === 'player' ? COLLISION.PLAYER_BULLET : COLLISION.ENEMY_BULLET;
    let fired = false;
    for (const [mx, my] of lvl.muzzles) {
      for (const angleDeg of lvl.spreadAngles) {
        const p = this.pool.spawn();
        if (!p) continue;
        const a = -Math.PI / 2 + deg2rad(angleDeg);
        p.fire({
          x: shipX + mx,
          y: shipY + my,
          texture: this.def.projectileTexture,
          vx: Math.cos(a) * lvl.projectileSpeed,
          vy: Math.sin(a) * lvl.projectileSpeed,
          damage: lvl.damage * (this.spec?.damageMultiplier ?? 1),
          category,
          lifetime: this.lifetime,
          homing: lvl.homing
            ? {
                turnRateDegPerSec: lvl.homing.turnRateDegPerSec,
                acquireDelay: lvl.homing.acquireDelay,
                findTarget: this.findTarget,
              }
            : undefined,
        });
        fired = true;
      }
    }
    if (!fired && this.energy) this.energy.restore(energyCost);
    if (fired) audio.play('shot');
    this.cooldownTimer += lvl.fireInterval * (this.spec?.fireIntervalMultiplier ?? 1);
    return fired;
  }
}

export class WeaponSystem {
  private primary: WeaponSlot;
  private secondary: WeaponSlot;

  constructor(
    playerBullets: PoolManager<Projectile>,
    missiles: PoolManager<Projectile>,
    findTarget: TargetFinder,
    private readonly onChanged?: (label: string) => void,
    energy?: ShipEnergySystem,
    onEnergyStarved?: () => void,
  ) {
    this.primary = new WeaponSlot(playerBullets, findTarget, BULLET_LIFETIME, energy, onEnergyStarved);
    this.secondary = new WeaponSlot(missiles, findTarget, MISSILE_LIFETIME, energy, onEnergyStarved);
  }

  configure(primary: RuntimeWeaponSpec, secondary?: RuntimeWeaponSpec): void {
    if (this.primary.configure(primary)) this.onChanged?.(this.displayName);
    if (secondary) this.secondary.configure(secondary);
  }

  equipPrimary(weaponId: string, keepLevel = true): void {
    if (this.primary.equipLegacy(weaponId, keepLevel)) this.onChanged?.(this.displayName);
  }

  equipSecondary(weaponId: string): void {
    this.secondary.equipLegacy(weaponId, false);
  }

  setLevel(n: number): void {
    this.primary.setLevel(n);
    this.onChanged?.(this.displayName);
  }

  get currentLevel(): number { return this.primary.currentLevel; }
  get displayName(): string { return this.primary.displayName; }
  get currentPrimaryId(): string { return this.primary.id; }
  get currentPrimaryEquipmentId(): string { return this.primary.equipmentId; }
  get secondaryReadiness(): number { return this.secondary.readiness; }
  hasSecondary(): boolean { return this.secondary.hasWeapon(); }

  update(dt: number, firePrimary: boolean, fireSecondary: boolean, shipX: number, shipY: number): void {
    this.primary.update(dt, firePrimary, shipX, shipY);
    this.secondary.update(dt, fireSecondary, shipX, shipY);
  }
}
