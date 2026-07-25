import { contentRegistry } from './ContentRegistry';
import type { LevelDef } from '../../schemas/levelSchema';
import type { EncounterRunner } from './EncounterRunner';
import type { ScrollController } from './ScrollController';
import type { WorldScroll } from './WorldScroll';

export interface Checkpoint {
  name: string;
  at: number;
}

const RECOVERY_SCROLL = 0.8;

export interface TerrainTimelineHooks {
  setState(target: string, state: 'open' | 'closed' | 'destroyed'): void;
  reset(): void;
}

/**
 * LevelTimeline (Sprint 4.4): owns THE levelTime clock. Starts encounters
 * at their scheduled times; `recovery` events soften scroll and guarantee
 * a spawn-free window (spawns only ever come from encounters, so an empty
 * gap in the schedule is the guarantee); `checkpoint` events record retry
 * points. Seek support hard-clears play and fast-scans the schedule.
 */
export class LevelTimeline {
  levelTime = 0;
  readonly def: LevelDef;
  readonly checkpoints: Checkpoint[];

  private fired: boolean[];
  private recoveryUntil = -1;

  constructor(
    levelId: string,
    private readonly runner: EncounterRunner,
    private readonly scroll: ScrollController,
    private readonly world: WorldScroll,
    /** Scene hook: hard-clear all live gameplay objects (enemies, bullets). */
    private readonly hardClear: () => void,
    definitionOverride?: LevelDef,
    private readonly terrainHooks?: TerrainTimelineHooks,
  ) {
    const def = definitionOverride ?? contentRegistry.levels.get(levelId);
    if (!def) throw new Error(`[LevelTimeline] unknown level "${levelId}"`);
    this.def = def;
    this.fired = def.events.map(() => false);
    this.checkpoints = def.events
      .filter(
        (e): e is { at: number; type: 'checkpoint'; name: string } =>
          'type' in e && e.type === 'checkpoint',
      )
      .map((e) => ({ name: e.name, at: e.at }))
      .sort((a, b) => a.at - b.at);
  }

  update(dt: number): void {
    this.levelTime += dt;

    this.def.events.forEach((ev, i) => {
      if (this.fired[i] || ev.at > this.levelTime) return;
      this.fired[i] = true;
      if ('encounter' in ev) {
        this.runner.start(ev.encounter);
      } else if (ev.type === 'recovery') {
        this.scroll.scrollSpeedMultiplier = RECOVERY_SCROLL;
        this.recoveryUntil = ev.at + ev.duration;
      } else if (ev.type === 'terrainState') {
        this.terrainHooks?.setState(ev.target, ev.state);
      }
      // checkpoints are passive markers — lastCheckpointBefore() reads them.
    });

    if (this.recoveryUntil >= 0 && this.levelTime >= this.recoveryUntil) {
      this.scroll.scrollSpeedMultiplier = 1;
      this.recoveryUntil = -1;
    }

    this.world.update(dt, this.levelTime);
  }

  /** Advance the shared clock and world scroll without firing authored events. */
  advanceClockOnly(dt: number): void {
    const safe = Math.max(0, Number.isFinite(dt) ? dt : 0);
    this.levelTime += safe;
    this.world.update(safe, this.levelTime);
  }

  /** Most recent checkpoint at or before t (death retry, Sprint 4.4). */
  lastCheckpointBefore(t: number): Checkpoint | null {
    let best: Checkpoint | null = null;
    for (const c of this.checkpoints) if (c.at <= t) best = c;
    return best;
  }

  /**
   * Seek to an absolute levelTime (debug , / . keys; checkpoint retry;
   * editor play-from-event in S8.3). Hard-clears live play, then starts
   * FRESH any encounter whose window [at, at+estimatedDuration) contains t
   * — a deliberate simplification (mid-flight enemy positions are not
   * reconstructed; documented in README).
   */
  seekTo(t: number): void {
    this.levelTime = Math.max(0, t);
    this.hardClear();
    this.runner.clearAll(false);
    this.scroll.scrollSpeedMultiplier = 1;
    this.recoveryUntil = -1;
    this.terrainHooks?.reset();

    this.def.events.forEach((ev, i) => {
      this.fired[i] = ev.at <= this.levelTime;
      if (!this.fired[i]) return;
      if ('encounter' in ev) {
        const enc = contentRegistry.encounters.get(ev.encounter);
        if (enc && this.levelTime < ev.at + enc.estimatedDuration) {
          this.runner.start(ev.encounter);
        }
      } else if (ev.type === 'recovery' && this.levelTime < ev.at + ev.duration) {
        this.scroll.scrollSpeedMultiplier = RECOVERY_SCROLL;
        this.recoveryUntil = ev.at + ev.duration;
      } else if (ev.type === 'terrainState') {
        this.terrainHooks?.setState(ev.target, ev.state);
      }
    });

    this.world.recompute(this.levelTime);
  }
}
