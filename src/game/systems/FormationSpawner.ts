import { contentRegistry } from './ContentRegistry';
import { difficulty } from './DifficultyManager';
import type { Enemy, EnemyContext } from '../entities/Enemy';
import type { FormationDef, FormationMemberDef } from '../../schemas/formationSchema';
import type { PoolManager } from './PoolManager';

type MemberStatus = 'pending' | 'active' | 'killed' | 'exited';

interface MemberTracker {
  def: FormationMemberDef;
  status: MemberStatus;
}

/**
 * A live formation (Sprint 4.1). Tracks every member so encounters can
 * distinguish isCleared() (all *destroyed* — reward conditions) from
 * isDone() (destroyed OR exited — completion gating, PDR §13.3).
 */
export class FormationInstance {
  private clock = 0;
  private members: MemberTracker[];

  constructor(
    def: FormationDef,
    private readonly originX: number,
    private readonly originY: number,
    private readonly spawnMember: (
      member: FormationMemberDef,
      x: number,
      y: number,
      onDone: (killed: boolean) => void,
    ) => boolean,
  ) {
    this.members = def.members.map((m) => ({ def: m, status: 'pending' }));
  }

  update(dt: number): void {
    this.clock += dt;
    for (const m of this.members) {
      if (m.status !== 'pending' || this.clock < difficulty.scaleDelay(m.def.delay)) continue;
      const ok = this.spawnMember(
        m.def,
        this.originX + m.def.offsetX,
        this.originY + m.def.offsetY,
        (killed) => {
          m.status = killed ? 'killed' : 'exited';
        },
      );
      // Pool exhaustion or bad reference: mark exited so encounters never hang.
      m.status = ok ? 'active' : 'exited';
    }
  }

  /** All members destroyed by the player. */
  isCleared(): boolean {
    return this.members.every((m) => m.status === 'killed');
  }

  /** No members pending or on screen (destroyed or exited). */
  isDone(): boolean {
    return this.members.every((m) => m.status === 'killed' || m.status === 'exited');
  }
}

/**
 * FormationSpawner (Sprint 4.1): spawns coordinated groups from JSON.
 * Members inherit the formation's shared movement unless overridden;
 * fireDelay staggers their first shots (PDR §12.1).
 */
export class FormationSpawner {
  private instances: FormationInstance[] = [];

  constructor(
    private readonly enemies: PoolManager<Enemy>,
    private readonly ctxProvider: () => EnemyContext,
  ) {}

  spawn(formationId: string, originX: number, originY: number): FormationInstance | null {
    const def = contentRegistry.formations.get(formationId);
    if (!def) {
      console.error(`[FormationSpawner] unknown formation "${formationId}"`);
      return null;
    }
    const instance = new FormationInstance(def, originX, originY, (member, x, y, onDone) => {
      const enemy = this.enemies.spawn();
      if (!enemy) return false;
      return enemy.activate(
        member.enemy,
        x,
        y,
        this.ctxProvider(),
        {
          movementPattern: member.movementOverride ?? def.movement,
          fireDelay: member.fireDelay,
        },
        (cause) => onDone(cause === 'killed'),
      );
    });
    this.instances.push(instance);
    return instance;
  }

  update(dt: number): void {
    for (const inst of this.instances) inst.update(dt);
    // Drop finished instances (their trackers live on via encounter refs).
    this.instances = this.instances.filter((i) => !i.isDone());
  }

  /** Hard reset for timeline seek (Sprint 4.4). */
  clearAll(): void {
    this.instances = [];
  }
}
