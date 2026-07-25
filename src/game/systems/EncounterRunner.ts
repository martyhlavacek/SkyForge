import { contentRegistry } from './ContentRegistry';
import type { EncounterDef, EncounterEvent } from '../../schemas/encounterSchema';
import type { Enemy, EnemyContext } from '../entities/Enemy';
import type { FormationInstance, FormationSpawner } from './FormationSpawner';
import type { PoolManager } from './PoolManager';
import type { ScrollController } from './ScrollController';

interface TrackedEnemy {
  done: boolean;
}

/**
 * A running encounter (Sprint 4.3): advances its own clock, fires events
 * in order (several per frame if needed), honors wait_for_clear gates, and
 * reports completion per its rule (duration | allClear | flag).
 */
class EncounterInstance {
  readonly id: string;
  clock = 0;
  private idx = 0;
  private waitingClear = false;
  private gatedOnBoss = false;
  private readonly events: EncounterEvent[];
  private formations: FormationInstance[] = [];
  private enemies: TrackedEnemy[] = [];

  constructor(
    readonly def: EncounterDef,
    private readonly runner: EncounterRunner,
  ) {
    this.id = def.id;
    this.events = [...def.events].sort((a, b) => a.at - b.at);
  }

  update(dt: number): void {
    this.clock += dt;
    if (this.waitingClear && this.allSpawnedDone()) this.waitingClear = false;

    while (!this.waitingClear && this.idx < this.events.length) {
      const ev = this.events[this.idx];
      if (ev.at > this.clock) break;
      this.idx++;
      this.fire(ev);
    }
  }

  private fire(ev: EncounterEvent): void {
    switch (ev.type) {
      case 'spawnFormation': {
        const inst = this.runner.spawnFormation(ev.formation, ev.x, ev.y);
        if (inst) this.formations.push(inst);
        break;
      }
      case 'spawnEnemy': {
        const tracked = this.runner.spawnEnemy(ev.enemy, ev.x, ev.y, ev.movementOverride);
        if (tracked) this.enemies.push(tracked);
        break;
      }
      case 'wait_for_clear':
        this.waitingClear = !this.allSpawnedDone();
        break;
      case 'setScrollSpeed':
        this.runner.setScrollSpeed(ev.multiplier);
        break;
      case 'setFlag':
        this.runner.setFlag(ev.flag);
        break;
      case 'spawnPickup':
        if (!ev.condition || this.runner.hasFlag(ev.condition)) {
          this.runner.spawnPickup(ev.pickup, ev.x, ev.y);
        }
        break;
      case 'spawnHazard':
        this.runner.spawnHazard(ev.x, ev.y, ev.w, ev.h, ev.count);
        break;
      case 'startMiniboss':
      case 'startBoss':
        this.runner.startBoss(ev.boss);
        this.gatedOnBoss = true;
        break;
      default:
        console.warn(`[Encounter ${this.id}] event "${ev.type}" not implemented yet`);
        break;
    }
  }

  private allSpawnedDone(): boolean {
    return this.formations.every((f) => f.isDone()) && this.enemies.every((e) => e.done);
  }

  isComplete(): boolean {
    if (this.gatedOnBoss && this.runner.isBossActive()) return false;
    switch (this.def.completion.type) {
      case 'duration':
        return this.clock >= this.def.estimatedDuration;
      case 'allClear':
        return (
          this.idx >= this.events.length && !this.waitingClear && this.allSpawnedDone()
        );
      case 'flag':
        return this.runner.hasFlag(this.def.completion.flag ?? '');
    }
  }
}

/**
 * EncounterRunner (Sprint 4.3): owns all concurrent encounter instances
 * (timed overlap per PDR §13.3) and the shared flag store. Spawning goes
 * through the FormationSpawner / enemy pool it is constructed with.
 */
export class EncounterRunner {
  private instances: EncounterInstance[] = [];
  private flags = new Set<string>();

  constructor(
    private readonly formationSpawner: FormationSpawner,
    private readonly enemyPool: PoolManager<Enemy>,
    private readonly ctxProvider: () => EnemyContext,
    private readonly scroll: ScrollController,
    private readonly hooks: {
      spawnPickup: (pickupId: string, x: number, y: number) => void;
      spawnHazard: (x: number, y: number, w: number, h: number, count: number) => void;
      startBoss: (bossId: string) => void;
      bossActive: () => boolean;
      encounterComplete?: (encounterId: string) => void;
    },
  ) {}

  /** Auto-flag set by the scene when an enemy of a type dies (S5.2). */
  notifyEnemyDestroyed(enemyId: string): void {
    this.flags.add(`${enemyId}_destroyed`);
  }

  start(encounterId: string): boolean {
    const def = contentRegistry.encounters.get(encounterId);
    if (!def) {
      console.error(`[EncounterRunner] unknown encounter "${encounterId}"`);
      return false;
    }
    this.instances.push(new EncounterInstance(def, this));
    return true;
  }

  update(dt: number): void {
    for (const inst of this.instances) inst.update(dt);
    const remaining: EncounterInstance[] = [];
    for (const inst of this.instances) {
      if (inst.isComplete()) this.hooks.encounterComplete?.(inst.id);
      else remaining.push(inst);
    }
    this.instances = remaining;
  }

  /** True once every started encounter has completed. */
  allComplete(): boolean {
    return this.instances.length === 0;
  }

  activeNames(): string[] {
    return this.instances.map((i) => `${i.id} @${i.clock.toFixed(1)}s`);
  }

  /** Hard reset for timeline seek (Sprint 4.4). Flags survive a seek forward. */
  clearAll(clearFlags: boolean): void {
    this.instances = [];
    if (clearFlags) this.flags.clear();
  }

  // ---- Hooks used by instances ----

  spawnFormation(id: string, x: number, y: number): FormationInstance | null {
    return this.formationSpawner.spawn(id, x, y);
  }

  spawnEnemy(
    enemyId: string,
    x: number,
    y: number,
    movementOverride?: string,
  ): TrackedEnemy | null {
    const enemy = this.enemyPool.spawn();
    if (!enemy) return null;
    const tracked: TrackedEnemy = { done: false };
    const ok = enemy.activate(
      enemyId,
      x,
      y,
      this.ctxProvider(),
      movementOverride ? { movementPattern: movementOverride } : undefined,
      () => {
        tracked.done = true;
      },
    );
    if (!ok) return null;
    return tracked;
  }

  setScrollSpeed(multiplier: number): void {
    this.scroll.scrollSpeedMultiplier = multiplier;
  }

  setFlag(flag: string): void {
    this.flags.add(flag);
  }

  spawnPickup(pickupId: string, x: number, y: number): void {
    this.hooks.spawnPickup(pickupId, x, y);
  }

  spawnHazard(x: number, y: number, w: number, h: number, count: number): void {
    this.hooks.spawnHazard(x, y, w, h, count);
  }

  startBoss(bossId: string): void {
    this.hooks.startBoss(bossId);
  }

  isBossActive(): boolean {
    return this.hooks.bossActive();
  }

  hasFlag(flag: string): boolean {
    return this.flags.has(flag);
  }
}
