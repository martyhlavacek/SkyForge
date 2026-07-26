import Phaser from 'phaser';
import { REGISTRY, SCENES } from '../config/constants';
import { BOSS_EVENTS } from '../entities/Boss';
import { ENEMY_EVENTS } from '../entities/Enemy';
import { GroundTarget } from '../entities/GroundTarget';
import { PICKUP_EVENTS } from '../entities/Pickup';
import { Player, PLAYER_EVENTS } from '../entities/Player';
import { InputManager, isTouchDevice } from '../input/InputManager';
import { audio } from '../systems/AudioManager';
import { BossController } from '../systems/BossController';
import { CombatDirector } from '../systems/CombatDirector';
import { contentRegistry } from '../systems/ContentRegistry';
import { difficulty } from '../systems/DifficultyManager';
import { GamePresentation } from '../systems/GamePresentation';
import { scaledDt, gameTime } from '../systems/GameTime';
import { LevelTimeline } from '../systems/LevelTimeline';
import {
  MissionFlowController,
  type BossDefeatPayload,
} from '../systems/MissionFlowController';
import { MultiplierSystem, MULTIPLIER_EVENTS } from '../systems/MultiplierSystem';
import { music } from '../systems/MusicDirector';
import { MusicIntensityModel } from '../systems/MusicIntensityModel';
import { RunProgressionController } from '../systems/RunProgressionController';
import {
  runtimeQualityProfile,
  type RuntimeQualityProfile,
} from '../systems/RuntimeQualityProfile';
import { saveData } from '../systems/SaveData';
import { ScoreSystem } from '../systems/ScoreSystem';
import { ScrollController } from '../systems/ScrollController';
import {
  StudioRuntimeController,
  type StudioRuntimeHost,
} from '../systems/StudioRuntimeController';
import { WorldScroll } from '../systems/WorldScroll';
import { telemetry } from '../debug/Telemetry';
import {
  renderContentErrors,
  setupGameDebug,
  setupTouchControls,
} from '../debug/GameSceneDiagnostics';
import type { GameDebugController } from '../debug/GameSceneDiagnostics';
import type { DifficultyName } from '../../schemas/difficultySchema';
import { LevelSchema } from '../../schemas/levelSchema';
import type { PickupDef } from '../../schemas/pickupSchema';
import type { StudioRuntimeState } from '../../schemas/studioSimulationSchema';
import {
  BiomeSchema,
  LevelPackageSchema,
  TerrainMapSchema,
  TerrainObjectSetSchema,
} from '../../schemas/terrainSchema';
import { TerrainRuntime } from '../terrain/TerrainRuntime';
import { Hud, HUD_EVENTS } from '../ui/Hud';
import type { RunSessionSnapshot } from '../systems/RunSession';
import { productionContent } from '../systems/ProductionContent';

const DEFAULT_LEVEL = 'level_01';

export interface GameSceneData {
  level?: string;
  startAt?: number;
  weaponLevel?: number;
  session?: RunSessionSnapshot;
}

/**
 * Runtime composition root. Gameplay, progression, presentation, boss, and
 * Studio simulation responsibilities are delegated to focused controllers.
 */
export class GameScene extends Phaser.Scene {
  private player!: Player;
  private inputMgr!: InputManager;
  private scroll!: ScrollController;
  private score!: ScoreSystem;
  private multiplier!: MultiplierSystem;
  private combat!: CombatDirector;
  private timeline!: LevelTimeline;
  private worldScroll!: WorldScroll;
  private terrain: TerrainRuntime | null = null;
  private groundTargets: GroundTarget[] = [];
  private progression!: RunProgressionController;
  private bossController!: BossController;
  private presentation!: GamePresentation;
  private missionFlow!: MissionFlowController;
  private debugOverlay: GameDebugController | null = null;
  private startData: GameSceneData = {};
  private ending = false;
  private previewMode = false;
  private touchPrimary = false;
  private quality: RuntimeQualityProfile = { maxEnemyBullets: 500, particleScale: 1 };
  private lastMusicThreat = 0;
  private readonly studioRuntime: StudioRuntimeController;

  constructor() {
    super(SCENES.GAME);
    const host: StudioRuntimeHost = {
      scene: this,
      timeline: () => this.timeline ?? null,
      player: () => this.player ?? null,
      score: () => this.score ?? null,
      multiplier: () => this.multiplier ?? null,
      enemies: () => this.combat?.enemies ?? null,
      enemyBullets: () => this.combat?.enemyBullets ?? null,
      playerBullets: () => this.combat?.playerBullets ?? null,
      missiles: () => this.combat?.missiles ?? null,
      pickups: () => this.combat?.pickups ?? null,
      groundTargets: () => this.groundTargets,
      terrain: () => this.terrain,
      encounterRunner: () => this.combat?.encounterRunner ?? null,
      formationSpawner: () => this.combat?.formationSpawner ?? null,
      worldScroll: () => this.worldScroll ?? null,
      shipLoadout: () => this.progression?.shipLoadout ?? null,
      lastMusicThreat: () => this.lastMusicThreat,
      enemyContext: () => this.combat.enemyContext(),
      nearestEnemy: () => this.combat.nearestEnemy(),
      hardClearGameplay: () => this.hardClearGameplay(),
      startBoss: (bossId, silent) => this.startBoss(bossId, silent),
      tickBoss: (dt) => this.bossController?.tick(dt),
      equipPrimaryWeapon: (weaponId) => this.combat.weapon.equipPrimary(weaponId, false),
      bossId: () => this.bossController?.definitionId,
      bossPresent: () => this.bossController?.isPresent ?? false,
    };
    this.studioRuntime = new StudioRuntimeController(host);
  }

  init(data: GameSceneData): void {
    this.startData = data ?? {};
  }

  get playerPosition(): { x: number; y: number } | null {
    return this.player ? { x: this.player.x, y: this.player.y } : null;
  }

  get levelSnapshot(): { id: string; levelTime: number } | null {
    return this.timeline
      ? { id: this.timeline.def.id, levelTime: this.timeline.levelTime }
      : null;
  }

  get terrainSnapshot(): Record<string, string> | null {
    return this.terrain?.snapshot() ?? null;
  }

  get studioRuntimeState(): StudioRuntimeState | null {
    return this.studioRuntime.runtimeState();
  }

  studioSeekTo(seconds: number): void {
    this.studioRuntime.seekTo(seconds);
  }
  studioStep(deltaSeconds: number): void {
    this.studioRuntime.step(deltaSeconds);
  }
  studioSetSnapshotInterval(seconds: number): number {
    return this.studioRuntime.setSnapshotInterval(seconds);
  }
  studioApplyTuning(input: unknown): string {
    return this.studioRuntime.applyTuning(input);
  }
  studioRestoreTuning(): void {
    this.studioRuntime.restoreTuning();
  }
  studioApplyAssets(input: unknown): string {
    return this.studioRuntime.applyAssets(input);
  }
  studioPreviewAsset(input: unknown): unknown {
    return this.studioRuntime.previewAsset(input);
  }
  studioApplyMusic(input: unknown): string {
    return this.studioRuntime.applyMusic(input);
  }
  studioPreviewMusic(input: unknown): void {
    this.studioRuntime.previewMusic(input);
  }
  studioRestoreMusic(): void {
    this.studioRuntime.restoreMusic();
  }
  studioConfigureArena(input: unknown) {
    return this.studioRuntime.configureArena(input);
  }

  create(): void {
    gameTime.scale = 1;
    this.physics.world.timeScale = 1;
    this.resetRunState();
    if (!this.startData.startAt && !this.startData.session) telemetry.reset();

    const storedDifficulty = this.registry.get(REGISTRY.DIFFICULTY) as
      DifficultyName | undefined;
    if (storedDifficulty) difficulty.set(storedDifficulty);
    if (contentRegistry.errors.length > 0) {
      renderContentErrors(this, contentRegistry.errors);
      return;
    }

    const params =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const levelId =
      this.startData.level ??
      params?.get('level') ??
      productionContent.activeLevelId ??
      DEFAULT_LEVEL;
    const urlStartAt = params?.get('t') ? Number.parseFloat(params.get('t')!) : undefined;
    this.previewMode = params?.get('preview') === '1';
    this.studioRuntime.initialize(
      levelId,
      params?.get('studio') === '1',
      params?.get('arena'),
      params?.get('arenaId') ?? undefined,
    );

    this.progression = RunProgressionController.restore(
      saveData.profile,
      levelId,
      this.startData.session,
    );
    this.scroll = new ScrollController(this);
    this.touchPrimary = isTouchDevice();
    this.quality = runtimeQualityProfile(
      this.touchPrimary,
      saveData.settings.reducedParticles,
    );
    this.player = new Player(this, this.progression.shipLoadout.derivedStats);
    this.inputMgr = new InputManager(this);
    this.input.once('pointerdown', this.unlockAudio, this);
    this.input.keyboard?.once('keydown', this.unlockAudio, this);
    this.input.gamepad?.once('down', this.unlockAudio, this);
    this.applySettings();
    if (this.touchPrimary) setupTouchControls(this, this.inputMgr);

    this.score = new ScoreSystem(this.events);
    this.multiplier = new MultiplierSystem(
      (tier, meter, decaying) =>
        this.events.emit(MULTIPLIER_EVENTS.CHANGED, tier, meter, decaying),
      (bonus) => this.score.addKill(bonus),
    );
    this.combat = new CombatDirector(
      this,
      this.player,
      this.scroll,
      this.quality,
      this.progression,
      {
        weaponLabel: (label) => this.events.emit(HUD_EVENTS.WEAPON, label),
        energyStarved: () => this.events.emit(HUD_EVENTS.ENERGY_STARVED),
        startBoss: (bossId) => this.startBoss(bossId),
        bossActive: () => this.bossController?.isActive ?? false,
        encounterComplete: (id) =>
          telemetry.recordEncounterComplete(id, this.timeline?.levelTime ?? 0),
      },
    );
    this.bossController = new BossController(
      this,
      this.combat.playerBullets,
      this.combat.missiles,
      () => this.combat.enemyContext(),
    );
    this.presentation = new GamePresentation(this, this.quality);
    new Hud(this, this.progression.shipLoadout.derivedStats);
    this.score.restore(this.progression.score);
    this.events.emit(HUD_EVENTS.CREDITS, this.progression.totalEscrow);

    let levelDef = contentRegistry.levels.get(levelId);
    if (this.previewMode) {
      this.registry.set(REGISTRY.DEBUG_INVULNERABLE, true);
      levelDef = this.loadPreviewOverride(levelId) ?? levelDef;
    }
    this.worldScroll = new WorldScroll(
      levelDef ?? { baseScrollSpeed: 100, scrollProfile: undefined },
      this.scroll,
    );
    this.terrain = this.createTerrainRuntime(levelDef);
    this.timeline = new LevelTimeline(
      levelId,
      this.combat.encounterRunner,
      this.scroll,
      this.worldScroll,
      () => this.hardClearGameplay(),
      levelDef,
      this.terrain
        ? {
            setState: (target, state) => this.terrain?.setObjectState(target, state),
            reset: () =>
              this.terrain?.resetDynamicState(
                this.progression.session.terrainState ?? {},
              ),
          }
        : undefined,
    );
    this.groundTargets = (levelDef?.groundObjects ?? []).map(
      (definition) => new GroundTarget(this, definition, this.combat.enemyContext()),
    );
    this.groundTargets.forEach((target) => this.combat.bindGroundTarget(target));

    this.missionFlow = new MissionFlowController({
      scene: this,
      player: this.player,
      input: this.inputMgr,
      score: this.score,
      timeline: this.timeline,
      progression: this.progression,
      presentation: this.presentation,
      boss: this.bossController,
      studio: this.studioRuntime,
      terrain: () => this.terrain,
      weaponLevel: () => this.combat.weapon.currentLevel,
      isEnding: () => this.ending,
      setEnding: (value) => {
        this.ending = value;
      },
    });

    if (!this.startData.startAt && !this.startData.session) {
      telemetry.beginRun({
        runId: this.progression.runId,
        levelId,
        difficulty: difficulty.name,
        deviceProfile: this.touchPrimary ? 'touch' : 'desktop',
      });
    }
    const startAt = this.startData.startAt ?? urlStartAt;
    if (startAt && startAt > 0) this.timeline.seekTo(startAt);

    this.bindRuntimeEvents();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdownRuntime, this);
    if (this.registry.get(REGISTRY.DEBUG_MODE)) {
      this.debugOverlay = setupGameDebug({
        scene: this,
        combat: this.combat,
        timeline: this.timeline,
        boss: this.bossController,
        spawnStressScene: () => this.spawnStressScene(),
        toggleWeapon: () => this.combat.togglePrimaryWeapon(),
      });
    }
    if (!this.previewMode)
      this.presentation.showLevelIntro(this.timeline.def.displayName);
    const levelMusic = this.timeline.def.levelMusic;
    if (!this.studioRuntime.isEnabled) {
      if (levelMusic?.trackId) {
        void music.playCue(
          levelMusic.trackId,
          'normal',
          levelMusic.startOffsetSeconds,
          {
            loop: levelMusic.loop,
            volume: levelMusic.volume,
            fadeSeconds: levelMusic.fadeSeconds,
          },
        );
      } else {
        void music.playCue(this.timeline.def.music, 'normal');
      }
    }
    this.studioRuntime.onRuntimeReady();

    if (!this.previewMode) {
      this.game.events.on(Phaser.Core.Events.BLUR, this.onBlur, this);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
        this.game.events.off(Phaser.Core.Events.BLUR, this.onBlur, this),
      );
    }
  }

  update(_time: number, delta: number): void {
    if (contentRegistry.errors.length > 0) return;
    const dt = scaledDt(delta);
    const input = this.inputMgr.getState();
    const touchDelta = this.touchPrimary ? this.inputMgr.consumeTouchDelta() : undefined;
    this.player.handleInput(input, touchDelta);
    this.combat.updateWeapon(dt, input, this.studioRuntime.autoFire);
    this.scroll.update(dt);
    this.multiplier.update(dt);
    this.events.emit(HUD_EVENTS.SECONDARY, this.combat.weapon.secondaryReadiness);

    if (!this.ending) {
      if (!this.studioRuntime.isEnabled || this.studioRuntime.isLevelArena) {
        this.timeline.update(dt);
        this.missionFlow.syncCheckpointSnapshot();
      } else this.timeline.advanceClockOnly(dt);
      this.combat.updateSpawners(dt);
      this.studioRuntime.updateArena(dt);
    }
    this.terrain?.update(this.worldScroll.distance, dt);
    this.groundTargets.forEach((target) =>
      target.updateWorld(this.worldScroll.distance, delta),
    );
    this.bossController.tick(dt);
    this.debugOverlay?.update(delta);

    telemetry.sampleProjectiles(this.combat.activeProjectileCount());
    telemetry.sampleFps(this.game.loop.actualFps, dt);
    telemetry.sampleFrame(delta);
    telemetry.sampleMultiplier(this.multiplier.tier, dt);
    telemetry.addWeaponTime(this.combat.weapon.currentPrimaryId, dt);
    this.lastMusicThreat = MusicIntensityModel.threatValue({
      activeEnemies: this.combat.enemies.activeCount(),
      activeEnemyProjectiles: this.combat.enemyBullets.activeCount(),
      bossActive: this.bossController.isActive,
      playerHullFraction: Phaser.Math.Clamp(this.player.survivabilityFraction, 0, 1),
    });
    music.updateIntensity(this.lastMusicThreat, dt);
    this.studioRuntime.sample(dt, delta);
    if (input.pause && !this.ending && !this.previewMode) this.missionFlow.openPause();
  }

  applySettings(): void {
    if (this.inputMgr)
      this.inputMgr.setTouchSensitivity(saveData.settings.touchSensitivity);
  }

  private bindRuntimeEvents(): void {
    this.events.on(ENEMY_EVENTS.KILLED, this.onKilled, this);
    this.events.on(PLAYER_EVENTS.DAMAGED, this.onPlayerDamaged, this);
    this.events.on(PLAYER_EVENTS.DIED, this.onPlayerDied, this);
    this.events.on(PICKUP_EVENTS.COLLECTED, this.onPickupCollected, this);
    this.events.on(BOSS_EVENTS.PART_DESTROYED, this.onKilled, this);
    this.events.on(BOSS_EVENTS.DEFEATED, this.onBossDefeated, this);
    this.events.on(MULTIPLIER_EVENTS.CHANGED, this.trackMultiplier, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(ENEMY_EVENTS.KILLED, this.onKilled, this);
      this.events.off(PLAYER_EVENTS.DAMAGED, this.onPlayerDamaged, this);
      this.events.off(PLAYER_EVENTS.DIED, this.onPlayerDied, this);
      this.events.off(PICKUP_EVENTS.COLLECTED, this.onPickupCollected, this);
      this.events.off(BOSS_EVENTS.PART_DESTROYED, this.onKilled, this);
      this.events.off(BOSS_EVENTS.DEFEATED, this.onBossDefeated, this);
      this.events.off(MULTIPLIER_EVENTS.CHANGED, this.trackMultiplier, this);
    });
  }

  private createTerrainRuntime(
    levelDef: ReturnType<typeof LevelSchema.parse> | undefined,
  ): TerrainRuntime | null {
    if (!levelDef?.levelPackage) return null;
    const preview = this.previewMode ? this.loadTerrainPreview(levelDef.id) : null;
    const pkg =
      preview?.packageDef ?? contentRegistry.levelPackages.get(levelDef.levelPackage);
    if (!pkg) return null;
    const map = preview?.map ?? contentRegistry.terrainMaps.get(pkg.mapId);
    const objects =
      preview?.objects ?? contentRegistry.terrainObjects.get(pkg.objectSetId);
    const biome = preview?.biome ?? contentRegistry.biomes.get(pkg.biomeId);
    if (!map || !objects || !biome) return null;
    return new TerrainRuntime(
      this,
      pkg,
      map,
      objects,
      biome,
      this.progression.session.terrainState ?? {},
    );
  }

  private loadTerrainPreview(levelId: string): {
    packageDef: ReturnType<typeof LevelPackageSchema.parse>;
    map: ReturnType<typeof TerrainMapSchema.parse>;
    objects: ReturnType<typeof TerrainObjectSetSchema.parse>;
    biome: ReturnType<typeof BiomeSchema.parse>;
  } | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(`skyforge_preview_project_${levelId}`);
      if (!raw) return null;
      const source = JSON.parse(raw) as Record<string, unknown>;
      return {
        packageDef: LevelPackageSchema.parse(source.packageDef),
        map: TerrainMapSchema.parse(source.map),
        objects: TerrainObjectSetSchema.parse(source.objects),
        biome: BiomeSchema.parse(source.biome),
      };
    } catch {
      return null;
    }
  }

  private loadPreviewOverride(
    levelId: string,
  ): ReturnType<typeof LevelSchema.parse> | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(`skyforge_preview_level_${levelId}`);
      if (!raw) return null;
      const parsed = LevelSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  private onKilled(target: {
    x: number;
    y: number;
    scoreValue: number;
    creditValue?: number;
    rewardId?: string;
    rewardCategory?: 'enemy' | 'ground' | 'boss';
    enemyId?: string;
    drops?: { pickup: string; chance: number }[];
  }): void {
    this.presentation.enemyDestroyed(target.x, target.y);
    this.score.addKill(this.multiplier.registerKill(target.scoreValue));
    if (target.rewardId && target.creditValue) {
      this.progression.claim({
        rewardId: target.rewardId,
        amount: target.creditValue,
        category: target.rewardCategory ?? 'enemy',
      });
      this.events.emit(HUD_EVENTS.CREDITS, this.progression.totalEscrow);
    }
    target.drops?.forEach((drop) => {
      if (this.progression.random() < drop.chance)
        this.combat.spawnPickup(drop.pickup, target.x, target.y);
    });
    if (target.enemyId) this.combat.encounterRunner.notifyEnemyDestroyed(target.enemyId);
  }

  private onPlayerDamaged(): void {
    this.multiplier.registerDamage();
    telemetry.recordDamage(this.timeline.levelTime, this.player.x, this.player.y);
    this.presentation.playerDamaged();
  }

  private onPickupCollected(payload: { def: PickupDef; rewardId: string }): void {
    const { def, rewardId } = payload;
    switch (def.effect) {
      case 'weapon_upgrade':
        this.combat.weapon.setLevel(this.combat.weapon.currentLevel + 1);
        break;
      case 'weapon_swap':
        if (def.weapon) {
          this.progression.primaryWeapon = def.weapon;
          this.combat.weapon.equipPrimary(def.weapon, true);
        }
        break;
      case 'shield': {
        const restored = this.player.restoreShield(def.magnitude);
        if (restored < def.magnitude) this.player.repairArmor(def.magnitude - restored);
        break;
      }
      case 'armorRepair':
        this.player.repairArmor(def.magnitude);
        break;
      case 'credits':
        if (
          this.progression.claim({
            rewardId,
            amount: Math.floor(def.magnitude),
            category: 'pickup',
          })
        ) {
          audio.playCreditPickup(this.progression.nextFeedbackSequence());
          this.events.emit(HUD_EVENTS.CREDITS, this.progression.totalEscrow);
        }
        break;
    }
    this.presentation.pickupCollected(this.player.x, this.player.y);
  }

  private onBossDefeated(payload: BossDefeatPayload): void {
    this.missionFlow.onBossDefeated(payload);
  }
  private onPlayerDied(): void {
    this.missionFlow.onPlayerDied();
  }
  private trackMultiplier(tier: number): void {
    this.missionFlow.trackMultiplier(tier);
  }

  private startBoss(bossId: string, silent = false): void {
    this.bossController.start(bossId, silent);
  }

  private hardClearGameplay(): void {
    this.combat?.hardClear();
    this.groundTargets.forEach((target) => target.resetState());
    this.bossController?.destroy();
  }

  private spawnStressScene(): void {
    if (!this.bossController.isPresent) this.startBoss('boss_alpha');
    this.bossController.forceNextPhase();
    this.combat.formationSpawner.spawn('pinch_attack', -40, 100);
    this.combat.formationSpawner.spawn('staggered_column', 270, -40);
    this.combat.formationSpawner.spawn('escort_heavy', 130, -60);
  }

  private unlockAudio(): void {
    void audio.unlock().then((unlocked) => {
      this.registry.set(REGISTRY.AUDIO_UNLOCKED, unlocked);
    });
  }

  private resetRunState(): void {
    this.ending = false;
    this.previewMode = false;
    this.touchPrimary = false;
    this.lastMusicThreat = 0;
    this.studioRuntime.reset();
    this.bossController?.destroy();
    this.groundTargets = [];
    this.terrain = null;
    this.debugOverlay = null;
  }

  private shutdownRuntime(): void {
    this.debugOverlay?.destroy();
    this.debugOverlay = null;
    this.inputMgr?.destroy();
    this.game.events.off(Phaser.Core.Events.BLUR, this.onBlur, this);
    this.terrain?.destroy();
    this.terrain = null;
    this.bossController?.destroy();
    this.studioRuntime.clearAssetPreview();
    music.stop();
  }

  private onBlur(): void {
    if (!this.ending && !this.scene.isPaused() && this.scene.isActive())
      this.missionFlow.openPause();
  }
}
