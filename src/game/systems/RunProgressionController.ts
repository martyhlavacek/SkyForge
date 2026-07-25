import type { DifficultyName } from '../../schemas/difficultySchema';
import type { CampaignProfile } from '../../schemas/profileSchema';
import { createMulberry32, type StatefulRng } from '../../shared/rng';
import {
  MissionEconomy,
  type MissionReward,
  type MissionSettlement,
} from '../economy/MissionEconomy';
import {
  buildRuntimeLoadoutSnapshot,
  type RuntimeShipLoadoutSnapshot,
} from '../equipment/RuntimeLoadoutSnapshot';
import type { TerrainStateSnapshot } from '../terrain/TerrainRuntime';
import { RunSession, type RunSessionSnapshot } from './RunSession';

export interface RuntimeProgressState {
  score: number;
  weaponLevel: number;
  terrainState?: TerrainStateSnapshot;
}

/** Owns mission-attempt progression state that previously lived in GameScene. */
export class RunProgressionController {
  readonly session: RunSession;
  readonly shipLoadout: RuntimeShipLoadoutSnapshot;
  readonly economy: MissionEconomy;

  private rewardSequence: number;
  private dropRng: StatefulRng;
  private maxMultiplier: number;
  private currentPrimary: string;

  private constructor(
    session: RunSession,
    shipLoadout: RuntimeShipLoadoutSnapshot,
    economy: MissionEconomy,
  ) {
    this.session = session;
    this.shipLoadout = shipLoadout;
    this.economy = economy;
    this.rewardSequence = session.rewardSequence;
    this.dropRng = createMulberry32(0x00d40b, session.dropRngState);
    this.maxMultiplier = session.maxMultiplier;
    this.currentPrimary = session.primaryWeapon;
  }

  static restore(
    profile: CampaignProfile,
    levelId: string,
    snapshot?: RunSessionSnapshot,
  ): RunProgressionController {
    const freshShipLoadout = buildRuntimeLoadoutSnapshot(profile);
    const session = RunSession.restore(snapshot, levelId, {
      primaryWeapon: freshShipLoadout.derivedStats.primaryWeapon.weaponDefId,
      weaponLevel: freshShipLoadout.derivedStats.primaryWeapon.upgradeLevel + 1,
      shipLoadout: freshShipLoadout,
    });
    const shipLoadout = session.shipLoadout ?? freshShipLoadout;
    const economy = MissionEconomy.restore(session.missionEconomy, session.runId);
    return new RunProgressionController(session, shipLoadout, economy);
  }

  get runId(): string {
    return this.session.runId;
  }
  get score(): number {
    return this.session.score;
  }
  get deaths(): number {
    return this.session.deaths;
  }
  get checkpoint() {
    return this.session.checkpoint;
  }
  get primaryWeapon(): string {
    return this.currentPrimary;
  }
  set primaryWeapon(value: string) {
    if (value.trim().length > 0) this.currentPrimary = value;
  }
  get highestMultiplier(): number {
    return this.maxMultiplier;
  }
  get totalEscrow(): number {
    return this.economy.totalEscrow;
  }

  nextRewardId(sourceId: string): string {
    return `${this.runId}:${sourceId}:${this.rewardSequence++}`;
  }
  nextPickupRewardId(pickupId: string): string {
    return `${this.runId}:pickup:${pickupId}:${this.rewardSequence++}`;
  }
  nextFeedbackSequence(): number {
    return this.rewardSequence++;
  }
  random(): number {
    return this.dropRng.next();
  }
  claim(reward: MissionReward): boolean {
    return this.economy.claim(reward);
  }
  trackMultiplier(tier: number): boolean {
    if (tier <= this.maxMultiplier) return false;
    this.maxMultiplier = tier;
    return true;
  }

  syncRuntime(state: RuntimeProgressState): void {
    this.session.updateRuntime({
      score: state.score,
      rewardSequence: this.rewardSequence,
      dropRngState: this.dropRng.snapshot(),
      maxMultiplier: this.maxMultiplier,
      primaryWeapon: this.currentPrimary,
      weaponLevel: state.weaponLevel,
      missionEconomy: this.economy.snapshot(),
      terrainState: state.terrainState,
    });
  }

  captureCheckpoint(
    at: number,
    name: string | undefined,
    state: RuntimeProgressState,
  ): boolean {
    const existing = this.session.checkpoint;
    if (existing && at <= existing.at) return false;
    this.economy.captureCheckpoint();
    this.syncRuntime(state);
    this.session.captureCheckpoint(at, name);
    return true;
  }

  recordDeath(): number {
    return this.session.recordDeath();
  }
  checkpointRetrySnapshot(at?: number): RunSessionSnapshot {
    return this.session.checkpointRetrySnapshot(at);
  }
  snapshot(): RunSessionSnapshot {
    return this.session.snapshot();
  }
  settle(
    profile: CampaignProfile,
    missionId: string,
    difficultyName: DifficultyName,
    missionBaseReward: number,
  ): MissionSettlement {
    return this.economy.settle(profile, missionId, difficultyName, missionBaseReward);
  }
}
