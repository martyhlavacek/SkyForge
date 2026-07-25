import Phaser from 'phaser';
import { SCENES } from '../config/constants';
import { telemetry } from '../debug/Telemetry';
import type { Player } from '../entities/Player';
import type { InputManager } from '../input/InputManager';
import type { TerrainRuntime } from '../terrain/TerrainRuntime';
import { HUD_EVENTS } from '../ui/Hud';
import type { MissionRewardBreakdown } from '../economy/MissionEconomy';
import type { BossController } from './BossController';
import { difficulty } from './DifficultyManager';
import type { GamePresentation } from './GamePresentation';
import type { LevelTimeline } from './LevelTimeline';
import { music } from './MusicDirector';
import type { RunProgressionController } from './RunProgressionController';
import { saveData } from './SaveData';
import type { ScoreSystem } from './ScoreSystem';
import type { StudioRuntimeController } from './StudioRuntimeController';

export interface BossDefeatPayload {
  bossId: string;
  totalScore: number;
  creditValue: number;
  rewardId: string;
}
export interface MissionFlowHost {
  readonly scene: Phaser.Scene;
  readonly player: Player;
  readonly input: InputManager;
  readonly score: ScoreSystem;
  readonly timeline: LevelTimeline;
  readonly progression: RunProgressionController;
  readonly presentation: GamePresentation;
  readonly boss: BossController;
  readonly studio: StudioRuntimeController;
  terrain(): TerrainRuntime | null;
  weaponLevel(): number;
  isEnding(): boolean;
  setEnding(value: boolean): void;
}

/** Mission checkpoints, pause/retry, death, and final settlement lifecycle. */
export class MissionFlowController {
  constructor(private readonly host: MissionFlowHost) {}
  syncRuntime(): void {
    this.host.progression.syncRuntime({
      score: this.host.score.value,
      weaponLevel: this.host.weaponLevel(),
      terrainState: this.host.terrain()?.snapshot(),
    });
  }
  syncCheckpointSnapshot(): void {
    const checkpoint = this.host.timeline.lastCheckpointBefore(
      this.host.timeline.levelTime,
    );
    if (checkpoint) this.captureCheckpoint(checkpoint.at, checkpoint.name);
  }
  captureCheckpoint(at: number, name?: string): void {
    const captured = this.host.progression.captureCheckpoint(at, name, {
      score: this.host.score.value,
      weaponLevel: this.host.weaponLevel(),
      terrainState: this.host.terrain()?.snapshot(),
    });
    if (captured)
      this.host.scene.events.emit(HUD_EVENTS.CREDITS, this.host.progression.totalEscrow);
  }
  trackMultiplier(tier: number): void {
    if (this.host.progression.trackMultiplier(tier)) this.syncRuntime();
  }
  openPause(): void {
    const checkpoint = this.host.timeline.lastCheckpointBefore(
      this.host.timeline.levelTime,
    );
    this.syncRuntime();
    if (checkpoint) this.captureCheckpoint(checkpoint.at, checkpoint.name);
    this.host.input.resetTransientState();
    music.pause();
    this.host.scene.scene.pause();
    this.host.scene.scene.launch(SCENES.PAUSE, {
      level: this.host.timeline.def.id,
      checkpointAt: checkpoint?.at,
      weaponLevel: this.host.weaponLevel(),
      session: this.host.progression.checkpointRetrySnapshot(checkpoint?.at),
    });
  }
  onBossDefeated(payload: BossDefeatPayload): void {
    music.setState('recovery', 0.8);
    this.host.presentation.bossDestroyed(this.host.boss.centerY);
    this.host.score.addKill(payload.totalScore);
    this.host.progression.claim({
      rewardId: `${this.host.progression.runId}:${payload.rewardId}`,
      amount: payload.creditValue,
      category: 'boss',
    });
    this.host.scene.events.emit(HUD_EVENTS.CREDITS, this.host.progression.totalEscrow);
    this.host.boss.completeDefeat();
    if (this.host.studio.isBossArena) {
      this.host.setEnding(false);
      this.host.studio.markBossArenaComplete();
      return;
    }
    if (payload.bossId !== 'boss_alpha') {
      music.setState('normal', 0.8);
      this.syncRuntime();
      return;
    }
    this.host.setEnding(true);
    this.syncRuntime();
    const record = saveData.recordRun(
      this.host.progression.score,
      this.host.timeline.levelTime,
      this.host.progression.highestMultiplier,
    );
    const unlockedBefore = saveData.profile.unlockedEquipment.length;
    const settlement = this.host.progression.settle(
      saveData.profile,
      this.host.timeline.def.id,
      difficulty.name,
      1000,
    );
    const settledProfile = settlement.profile;
    const missionRecord = settledProfile.missionRecords[this.host.timeline.def.id];
    missionRecord.bestScore = Math.max(
      missionRecord.bestScore,
      this.host.progression.score,
    );
    missionRecord.bestTimeSeconds =
      missionRecord.bestTimeSeconds === 0
        ? this.host.timeline.levelTime
        : Math.min(missionRecord.bestTimeSeconds, this.host.timeline.levelTime);
    saveData.replaceProfile(settledProfile);
    const unlockCount = Math.max(
      0,
      settledProfile.unlockedEquipment.length - unlockedBefore,
    );
    this.host.scene.time.delayedCall(1200, () => {
      this.host.scene.scene.start(SCENES.RESULTS, {
        score: this.host.progression.score,
        maxMultiplier: this.host.progression.highestMultiplier,
        timeSeconds: this.host.timeline.levelTime,
        deaths: this.host.progression.deaths,
        levelName: this.host.timeline.def.displayName,
        newHighScore: record.newHighScore,
        creditBreakdown: settlement.breakdown satisfies MissionRewardBreakdown,
        bankBalance: settledProfile.bankedCredits,
        newUnlockCount: unlockCount,
      });
    });
  }
  onPlayerDied(): void {
    if (this.host.isEnding()) return;
    this.syncRuntime();
    this.host.progression.recordDeath();
    telemetry.recordDeath(
      this.host.timeline.levelTime,
      this.host.player.x,
      this.host.player.y,
    );
    this.host.setEnding(true);
    music.setState('recovery', 0.5);
    this.host.presentation.playerDestroyed(this.host.player.x, this.host.player.y);
    const checkpoint = this.host.timeline.lastCheckpointBefore(
      this.host.timeline.levelTime,
    );
    if (checkpoint) this.captureCheckpoint(checkpoint.at, checkpoint.name);
    this.host.scene.time.delayedCall(1000, () => {
      this.host.scene.scene.start(SCENES.GAME_OVER, {
        score: this.host.progression.score,
        level: this.host.timeline.def.id,
        checkpointAt: checkpoint?.at,
        checkpointName: checkpoint?.name,
        weaponLevel: this.host.weaponLevel(),
        session: this.host.progression.checkpointRetrySnapshot(checkpoint?.at),
      });
    });
  }
}
