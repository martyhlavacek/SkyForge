import Phaser from 'phaser';

/**
 * Generic object pool (Sprint 1.3) wrapping a Phaser physics group.
 * All gameplay entities (projectiles, enemies, pickups) allocate through
 * pools — never `new` during play (PDR §10.3, §9.3).
 */
export class PoolManager<T extends Phaser.Physics.Arcade.Sprite> {
  readonly group: Phaser.Physics.Arcade.Group;

  constructor(
    scene: Phaser.Scene,
    classType: new (scene: Phaser.Scene, x: number, y: number) => T,
    readonly maxSize: number,
    readonly label: string,
  ) {
    this.group = scene.physics.add.group({
      classType,
      maxSize,
      runChildUpdate: true,
    });
  }

  /**
   * Get an inactive instance (or create one, up to maxSize).
   * Returns null when the pool is exhausted — callers must tolerate this.
   */
  spawn(): T | null {
    const obj = this.group.get() as T | null;
    return obj ?? null;
  }

  activeCount(): number {
    return this.group.countActive(true);
  }

  poolSize(): number {
    return this.group.getLength();
  }

  /** Number of inactive or not-yet-created objects available without exceeding the cap. */
  availableCount(): number {
    return Math.max(0, this.maxSize - this.activeCount());
  }

  /** Debug-overlay stat line, e.g. "bullets 12/200". */
  statLine(): string {
    return `${this.label} ${this.activeCount()}/${this.poolSize()} (cap ${this.maxSize})`;
  }
}
