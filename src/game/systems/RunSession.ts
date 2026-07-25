import type { RuntimeShipLoadoutSnapshot } from '../equipment/RuntimeLoadoutSnapshot';
import type { MissionEconomySnapshot } from '../economy/MissionEconomy';
import type { TerrainStateSnapshot } from '../terrain/TerrainRuntime';

export interface RuntimeLoadoutSnapshot {
  primaryWeapon: string;
  weaponLevel: number;
}

export interface RunCheckpointSnapshot extends RuntimeLoadoutSnapshot {
  rewardSequence: number;
  dropRngState: number;
  at: number;
  name?: string;
  score: number;
  missionEconomy?: MissionEconomySnapshot;
  terrainState?: TerrainStateSnapshot;
}

export interface RunSessionSnapshot extends RuntimeLoadoutSnapshot {
  runId: string;
  levelId: string;
  score: number;
  deaths: number;
  maxMultiplier: number;
  rewardSequence: number;
  dropRngState: number;
  shipLoadout?: RuntimeShipLoadoutSnapshot;
  missionEconomy?: MissionEconomySnapshot;
  terrainState?: TerrainStateSnapshot;
  checkpoint?: RunCheckpointSnapshot;
}

export interface RuntimeRunState extends RuntimeLoadoutSnapshot {
  score: number;
  rewardSequence?: number;
  dropRngState?: number;
  maxMultiplier: number;
  missionEconomy?: MissionEconomySnapshot;
  terrainState?: TerrainStateSnapshot;
}

export interface RunSessionInitial extends Partial<RuntimeLoadoutSnapshot> {
  rewardSequence?: number;
  dropRngState?: number;
  shipLoadout?: RuntimeShipLoadoutSnapshot;
  missionEconomy?: MissionEconomySnapshot;
  terrainState?: TerrainStateSnapshot;
}

function finiteNonnegative(value: number, fallback = 0): number {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function validWeaponId(value: string): string {
  return value.trim().length > 0 ? value : 'pulse_cannon';
}

/** Pure mission-attempt state shared across Phaser scene restarts. */
export class RunSession {
  private state: RunSessionSnapshot;

  private constructor(snapshot: RunSessionSnapshot) {
    this.state = structuredClone(snapshot);
  }

  static create(
    levelId: string,
    initial: RunSessionInitial = {},
    runId: string = globalThis.crypto?.randomUUID?.() ?? `run-${Date.now()}`,
  ): RunSession {
    return new RunSession({
      runId,
      levelId,
      score: 0,
      deaths: 0,
      maxMultiplier: 1,
      rewardSequence: Math.floor(finiteNonnegative(initial.rewardSequence ?? 0)),
      dropRngState: Math.floor(finiteNonnegative(initial.dropRngState ?? 0x00d40b)),
      primaryWeapon: validWeaponId(
        initial.primaryWeapon ??
          initial.shipLoadout?.derivedStats.primaryWeapon.weaponDefId ??
          'pulse_cannon',
      ),
      weaponLevel: Math.max(1, Math.floor(initial.weaponLevel ?? 1)),
      shipLoadout: initial.shipLoadout ? structuredClone(initial.shipLoadout) : undefined,
      missionEconomy: initial.missionEconomy
        ? structuredClone(initial.missionEconomy)
        : undefined,
      terrainState: initial.terrainState
        ? structuredClone(initial.terrainState)
        : undefined,
    });
  }

  static restore(
    snapshot: RunSessionSnapshot | undefined,
    levelId: string,
    fallback: RunSessionInitial = {},
  ): RunSession {
    if (!snapshot || snapshot.levelId !== levelId)
      return RunSession.create(levelId, fallback);
    return new RunSession({
      runId: snapshot.runId,
      levelId,
      score: finiteNonnegative(snapshot.score),
      deaths: Math.floor(finiteNonnegative(snapshot.deaths)),
      maxMultiplier: Math.max(1, finiteNonnegative(snapshot.maxMultiplier, 1)),
      rewardSequence: Math.floor(
        finiteNonnegative(snapshot.rewardSequence ?? fallback.rewardSequence ?? 0),
      ),
      dropRngState: Math.floor(
        finiteNonnegative(snapshot.dropRngState ?? fallback.dropRngState ?? 0x00d40b),
      ),
      primaryWeapon: validWeaponId(snapshot.primaryWeapon),
      weaponLevel: Math.max(1, Math.floor(finiteNonnegative(snapshot.weaponLevel, 1))),
      shipLoadout: snapshot.shipLoadout
        ? structuredClone(snapshot.shipLoadout)
        : fallback.shipLoadout,
      missionEconomy: snapshot.missionEconomy
        ? structuredClone(snapshot.missionEconomy)
        : fallback.missionEconomy,
      terrainState: snapshot.terrainState
        ? structuredClone(snapshot.terrainState)
        : fallback.terrainState,
      checkpoint: snapshot.checkpoint
        ? {
            at: finiteNonnegative(snapshot.checkpoint.at),
            name: snapshot.checkpoint.name,
            score: finiteNonnegative(snapshot.checkpoint.score),
            rewardSequence: Math.floor(
              finiteNonnegative(snapshot.checkpoint.rewardSequence ?? 0),
            ),
            dropRngState: Math.floor(
              finiteNonnegative(snapshot.checkpoint.dropRngState ?? 0x00d40b),
            ),
            primaryWeapon: validWeaponId(snapshot.checkpoint.primaryWeapon),
            weaponLevel: Math.max(
              1,
              Math.floor(finiteNonnegative(snapshot.checkpoint.weaponLevel, 1)),
            ),
            missionEconomy: snapshot.checkpoint.missionEconomy
              ? structuredClone(snapshot.checkpoint.missionEconomy)
              : undefined,
            terrainState: snapshot.checkpoint.terrainState
              ? structuredClone(snapshot.checkpoint.terrainState)
              : undefined,
          }
        : undefined,
    });
  }

  get runId(): string {
    return this.state.runId;
  }
  get score(): number {
    return this.state.score;
  }
  get deaths(): number {
    return this.state.deaths;
  }
  get maxMultiplier(): number {
    return this.state.maxMultiplier;
  }
  get rewardSequence(): number {
    return this.state.rewardSequence;
  }
  get dropRngState(): number {
    return this.state.dropRngState;
  }
  get primaryWeapon(): string {
    return this.state.primaryWeapon;
  }
  get weaponLevel(): number {
    return this.state.weaponLevel;
  }
  get shipLoadout(): RuntimeShipLoadoutSnapshot | undefined {
    return this.state.shipLoadout ? structuredClone(this.state.shipLoadout) : undefined;
  }
  get missionEconomy(): MissionEconomySnapshot | undefined {
    return this.state.missionEconomy
      ? structuredClone(this.state.missionEconomy)
      : undefined;
  }
  get terrainState(): TerrainStateSnapshot | undefined {
    return this.state.terrainState ? structuredClone(this.state.terrainState) : undefined;
  }
  get checkpoint(): RunCheckpointSnapshot | undefined {
    return this.state.checkpoint ? structuredClone(this.state.checkpoint) : undefined;
  }

  updateRuntime(runtime: RuntimeRunState): void {
    this.state.score = finiteNonnegative(runtime.score);
    if (runtime.rewardSequence !== undefined) {
      this.state.rewardSequence = Math.floor(finiteNonnegative(runtime.rewardSequence));
    }
    if (runtime.dropRngState !== undefined) {
      this.state.dropRngState = Math.floor(finiteNonnegative(runtime.dropRngState));
    }
    this.state.maxMultiplier = Math.max(
      this.state.maxMultiplier,
      finiteNonnegative(runtime.maxMultiplier, 1),
    );
    this.state.primaryWeapon = validWeaponId(runtime.primaryWeapon);
    this.state.weaponLevel = Math.max(
      1,
      Math.floor(finiteNonnegative(runtime.weaponLevel, 1)),
    );
    if (runtime.missionEconomy)
      this.state.missionEconomy = structuredClone(runtime.missionEconomy);
    if (runtime.terrainState)
      this.state.terrainState = structuredClone(runtime.terrainState);
  }

  recordDeath(): number {
    this.state.deaths += 1;
    return this.state.deaths;
  }

  captureCheckpoint(at: number, name?: string): void {
    const safeAt = finiteNonnegative(at);
    if (this.state.checkpoint && safeAt <= this.state.checkpoint.at) return;
    this.state.checkpoint = {
      at: safeAt,
      name,
      score: this.state.score,
      rewardSequence: this.state.rewardSequence,
      dropRngState: this.state.dropRngState,
      primaryWeapon: this.state.primaryWeapon,
      weaponLevel: this.state.weaponLevel,
      missionEconomy: this.state.missionEconomy
        ? structuredClone(this.state.missionEconomy)
        : undefined,
      terrainState: this.state.terrainState
        ? structuredClone(this.state.terrainState)
        : undefined,
    };
  }

  snapshot(): RunSessionSnapshot {
    return structuredClone(this.state);
  }

  checkpointRetrySnapshot(at?: number): RunSessionSnapshot {
    const checkpoint = this.state.checkpoint;
    if (!checkpoint || (at !== undefined && checkpoint.at !== at)) return this.snapshot();
    return {
      ...this.snapshot(),
      score: checkpoint.score,
      rewardSequence: checkpoint.rewardSequence,
      dropRngState: checkpoint.dropRngState,
      primaryWeapon: checkpoint.primaryWeapon,
      weaponLevel: checkpoint.weaponLevel,
      missionEconomy: checkpoint.missionEconomy
        ? structuredClone(checkpoint.missionEconomy)
        : undefined,
      terrainState: checkpoint.terrainState
        ? structuredClone(checkpoint.terrainState)
        : undefined,
    };
  }
}
