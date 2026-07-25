import { contentRegistry } from './ContentRegistry';
import type { DifficultyModifiers, DifficultyName } from '../../schemas/difficultySchema';

const NEUTRAL: DifficultyModifiers = {
  enemyHealthMultiplier: 1,
  projectileSpeedMultiplier: 1,
  spawnDelayMultiplier: 1,
};

/**
 * DifficultyManager (Sprint 7.2), PDR §15.
 * Applies modifiers at the point each value is consumed — it NEVER mutates
 * loaded content (the registry objects stay pristine). Selection is a
 * process-wide singleton so every system reads the same setting.
 *
 * Hook points:
 *  - Enemy.activate       → scaleHealth
 *  - EnemyWeapon (fire)   → scaleProjectileSpeed
 *  - FormationSpawner     → scaleDelay (member delays / first-shot delays)
 */
class DifficultyManager {
  private current: DifficultyName = 'normal';

  get name(): DifficultyName {
    return this.current;
  }

  set(name: DifficultyName): void {
    this.current = name;
  }

  private get mods(): DifficultyModifiers {
    return contentRegistry.difficulty?.levels[this.current] ?? NEUTRAL;
  }

  scaleHealth(base: number): number {
    return base * this.mods.enemyHealthMultiplier;
  }

  scaleProjectileSpeed(base: number): number {
    return base * this.mods.projectileSpeedMultiplier;
  }

  scaleDelay(base: number): number {
    return base * this.mods.spawnDelayMultiplier;
  }
}

export const difficulty = new DifficultyManager();
