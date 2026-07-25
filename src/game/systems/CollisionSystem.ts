import Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { Projectile } from '../entities/Projectile';
import type { PoolManager } from './PoolManager';

/**
 * CollisionSystem (Sprints 2.2–2.3).
 * Registers every overlap pair once; category masks keep pairs minimal
 * (player bullets never test enemy bullets). Every callback guards on
 * `active` — pooled objects that were deactivated this frame must never
 * register hits.
 */
export class CollisionSystem {
  constructor(
    scene: Phaser.Scene,
    player: Player,
    playerBullets: PoolManager<Projectile>,
    enemyBullets: PoolManager<Projectile>,
    enemies: PoolManager<Enemy>,
  ) {
    // Player bullets → enemies (Sprint 2.2).
    scene.physics.add.overlap(playerBullets.group, enemies.group, (a, b) => {
      const bullet = a as Projectile;
      const enemy = b as Enemy;
      if (!bullet.active || !enemy.active) return;
      bullet.deactivate();
      enemy.takeDamage(bullet.damage);
    });

    // Enemy bullets → player (Sprint 2.3).
    scene.physics.add.overlap(enemyBullets.group, player, (a, b) => {
      const bullet = (a === player ? b : a) as Projectile;
      if (!bullet.active || player.isDead) return;
      if (player.isInvulnerable) return; // bullet passes through during i-frames
      bullet.deactivate();
      player.takeDamage(bullet.damage);
    });

    // Enemy bodies → player (collision damage, Sprint 2.3).
    scene.physics.add.overlap(enemies.group, player, (a, b) => {
      const enemy = (a === player ? b : a) as Enemy;
      if (!enemy.active || player.isDead) return;
      player.takeDamage(enemy.collisionDamage);
    });
  }
}
