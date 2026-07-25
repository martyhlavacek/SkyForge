import Phaser from 'phaser';
import { Enemy, type EnemyContext } from '../entities/Enemy';
import type { GroundTarget } from '../entities/GroundTarget';
import { Pickup } from '../entities/Pickup';
import type { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import type { InputState } from '../input/InputManager';
import { CollisionSystem } from './CollisionSystem';
import { EncounterRunner } from './EncounterRunner';
import { FormationSpawner } from './FormationSpawner';
import { PoolManager } from './PoolManager';
import type { RunProgressionController } from './RunProgressionController';
import type { RuntimeQualityProfile } from './RuntimeQualityProfile';
import type { ScrollController } from './ScrollController';
import { WeaponSystem } from './WeaponSystem';

export interface CombatDirectorCallbacks {
  weaponLabel(label: string): void;
  energyStarved(): void;
  startBoss(bossId: string): void;
  bossActive(): boolean;
  encounterComplete(encounterId: string): void;
}

/** Owns pooled actors, weapons, collisions, formations, and encounters. */
export class CombatDirector {
  readonly playerBullets: PoolManager<Projectile>;
  readonly enemyBullets: PoolManager<Projectile>;
  readonly missiles: PoolManager<Projectile>;
  readonly enemies: PoolManager<Enemy>;
  readonly pickups: PoolManager<Pickup>;
  readonly weapon: WeaponSystem;
  readonly formationSpawner: FormationSpawner;
  readonly encounterRunner: EncounterRunner;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    scroll: ScrollController,
    quality: RuntimeQualityProfile,
    private readonly progression: RunProgressionController,
    callbacks: CombatDirectorCallbacks,
  ) {
    this.playerBullets = new PoolManager(scene, Projectile, 200, 'p.bullets');
    this.enemyBullets = new PoolManager(
      scene,
      Projectile,
      quality.maxEnemyBullets,
      'e.bullets',
    );
    this.missiles = new PoolManager(scene, Projectile, 40, 'missiles');
    this.enemies = new PoolManager(scene, Enemy, 128, 'enemies');
    this.pickups = new PoolManager(scene, Pickup, 32, 'pickups');
    this.weapon = new WeaponSystem(
      this.playerBullets,
      this.missiles,
      () => this.nearestEnemy(),
      callbacks.weaponLabel,
      player.energy,
      callbacks.energyStarved,
    );
    this.weapon.configure(
      progression.shipLoadout.derivedStats.primaryWeapon,
      progression.shipLoadout.derivedStats.secondaryWeapon,
    );
    if (
      progression.primaryWeapon !==
      progression.shipLoadout.derivedStats.primaryWeapon.weaponDefId
    )
      this.weapon.equipPrimary(progression.primaryWeapon, false);
    this.weapon.setLevel(progression.session.weaponLevel);
    new CollisionSystem(
      scene,
      player,
      this.playerBullets,
      this.enemyBullets,
      this.enemies,
    );
    this.setupExtraCollisions();
    this.formationSpawner = new FormationSpawner(this.enemies, () => this.enemyContext());
    this.encounterRunner = new EncounterRunner(
      this.formationSpawner,
      this.enemies,
      () => this.enemyContext(),
      scroll,
      {
        spawnPickup: (id, x, y) => this.spawnPickup(id, x, y),
        spawnHazard: (x, y, w, h, count) => this.spawnMinefield(x, y, w, h, count),
        startBoss: callbacks.startBoss,
        bossActive: callbacks.bossActive,
        encounterComplete: callbacks.encounterComplete,
      },
    );
  }

  updateWeapon(dt: number, input: InputState, studioAutoFire: boolean): void {
    this.weapon.update(
      dt,
      (input.firePrimary || studioAutoFire) && !this.player.isDead,
      input.fireSecondary && !this.player.isDead,
      this.player.x,
      this.player.y,
    );
  }
  updateSpawners(dt: number): void {
    this.encounterRunner.update(dt);
    this.formationSpawner.update(dt);
  }
  enemyContext(): EnemyContext {
    return {
      bulletPool: this.enemyBullets,
      getTarget: () => ({
        x: this.player.x,
        y: this.player.y,
        alive: !this.player.isDead,
      }),
      spawnEnemy: (enemyId, x, y) =>
        this.enemies.spawn()?.activate(enemyId, x, y, this.enemyContext()),
      nextRewardId: (sourceId) => this.progression.nextRewardId(sourceId),
    };
  }
  nearestEnemy(): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bestDistance = Infinity;
    this.enemies.group.getMatching('active', true).forEach((object) => {
      const enemy = object as Enemy;
      const distance = Phaser.Math.Distance.Squared(
        this.player.x,
        this.player.y,
        enemy.x,
        enemy.y,
      );
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { x: enemy.x, y: enemy.y };
      }
    });
    return best;
  }
  spawnPickup(pickupId: string, x: number, y: number): void {
    this.pickups.spawn()?.activate(
      pickupId,
      x,
      y,
      () => ({
        x: this.player.x,
        y: this.player.y,
        radius: this.progression.shipLoadout.derivedStats.pickupMagnetRadius,
      }),
      this.progression.nextPickupRewardId(pickupId),
    );
  }
  spawnMinefield(x: number, y: number, w: number, h: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const mineX = x + this.progression.random() * w;
      const mineY = y - this.progression.random() * h;
      this.enemies.spawn()?.activate('mine', mineX, mineY, this.enemyContext(), {
        movementPattern: 'drift_down',
      });
    }
  }
  bindGroundTarget(target: GroundTarget): void {
    this.scene.physics.add.overlap(this.playerBullets.group, target, (a, b) => {
      const bullet = (a === target ? b : a) as Projectile;
      if (!bullet.active) return;
      bullet.deactivate();
      target.takeDamage(bullet.damage);
    });
  }
  togglePrimaryWeapon(): void {
    this.progression.primaryWeapon =
      this.progression.primaryWeapon === 'pulse_cannon'
        ? 'spread_cannon'
        : 'pulse_cannon';
    this.weapon.equipPrimary(this.progression.primaryWeapon, true);
  }
  hardClear(): void {
    this.enemies.group
      .getMatching('active', true)
      .forEach((enemy) => (enemy as Enemy).forceClear());
    [this.playerBullets, this.enemyBullets, this.missiles].forEach((pool) =>
      pool.group
        .getMatching('active', true)
        .forEach((projectile) => (projectile as Projectile).deactivate()),
    );
    this.pickups.group
      .getMatching('active', true)
      .forEach((pickup) => (pickup as Pickup).deactivate());
    this.formationSpawner.clearAll();
  }
  activeProjectileCount(): number {
    return (
      this.playerBullets.activeCount() +
      this.enemyBullets.activeCount() +
      this.missiles.activeCount()
    );
  }
  poolStatLines(): string[] {
    return [
      this.playerBullets.statLine(),
      this.enemyBullets.statLine(),
      this.missiles.statLine(),
      this.enemies.statLine(),
      this.pickups.statLine(),
    ];
  }
  killAllEnemies(): void {
    this.enemies.group
      .getMatching('active', true)
      .forEach((enemy) => (enemy as Enemy).takeDamage(99999));
  }

  private setupExtraCollisions(): void {
    this.scene.physics.add.overlap(this.missiles.group, this.enemies.group, (a, b) => {
      const missile = a as Projectile;
      const enemy = b as Enemy;
      if (!missile.active || !enemy.active) return;
      missile.deactivate();
      enemy.takeDamage(missile.damage);
    });
    this.scene.physics.add.overlap(this.pickups.group, this.player, (a, b) => {
      const pickup = (a === this.player ? b : a) as Pickup;
      if (!pickup.active || this.player.isDead) return;
      pickup.collect();
    });
  }
}
