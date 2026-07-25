import Phaser from 'phaser';
import { DEPTHS, GAME_WIDTH, REGISTRY } from '../config/constants';
import type { Enemy, EnemyContext } from '../entities/Enemy';
import type { GroundTarget } from '../entities/GroundTarget';
import type { Pickup } from '../entities/Pickup';
import type { Player } from '../entities/Player';
import type { Projectile } from '../entities/Projectile';
import type { RuntimeShipLoadoutSnapshot } from '../equipment/RuntimeLoadoutSnapshot';
import {
  SimulationArenaConfigSchema,
  type PooledProjectileStudioSnapshot,
  type SimulationArenaConfig,
  type StudioRuntimeSnapshot,
  type StudioRuntimeState,
} from '../../schemas/studioSimulationSchema';
import { contentRegistry } from './ContentRegistry';
import type { EncounterRunner } from './EncounterRunner';
import type { FormationSpawner } from './FormationSpawner';
import { gameTime } from './GameTime';
import type { LevelTimeline } from './LevelTimeline';
import type { MultiplierSystem } from './MultiplierSystem';
import { music } from './MusicDirector';
import type { PoolManager } from './PoolManager';
import type { ScoreSystem } from './ScoreSystem';
import { studioAssetOverlay } from './StudioAssetOverlay';
import { studioMusicOverlay } from './StudioMusicOverlay';
import { StudioSimulationRuntime } from './StudioSimulationRuntime';
import { studioTuningOverlay } from './StudioTuningOverlay';
import type { TerrainRuntime } from '../terrain/TerrainRuntime';
import type { WorldScroll } from './WorldScroll';

const DEFAULT_LEVEL = 'level_01';

export interface StudioRuntimeHost {
  readonly scene: Phaser.Scene;
  timeline(): LevelTimeline | null;
  player(): Player | null;
  score(): ScoreSystem | null;
  multiplier(): MultiplierSystem | null;
  enemies(): PoolManager<Enemy> | null;
  enemyBullets(): PoolManager<Projectile> | null;
  playerBullets(): PoolManager<Projectile> | null;
  missiles(): PoolManager<Projectile> | null;
  pickups(): PoolManager<Pickup> | null;
  groundTargets(): GroundTarget[];
  terrain(): TerrainRuntime | null;
  encounterRunner(): EncounterRunner | null;
  formationSpawner(): FormationSpawner | null;
  worldScroll(): WorldScroll | null;
  shipLoadout(): RuntimeShipLoadoutSnapshot | null;
  lastMusicThreat(): number;
  enemyContext(): EnemyContext;
  nearestEnemy(): { x: number; y: number } | null;
  hardClearGameplay(): void;
  startBoss(bossId: string, silent?: boolean): void;
  tickBoss(dt: number): void;
  equipPrimaryWeapon(weaponId: string): void;
  bossId(): string | undefined;
  bossPresent(): boolean;
}

/** Owns Studio-only simulation, arena, snapshots, and asset/music/tuning previews. */
export class StudioRuntimeController {
  private readonly simulation = new StudioSimulationRuntime(5);
  private enabled = false;
  private arena: SimulationArenaConfig = {
    type: 'level',
    levelId: DEFAULT_LEVEL,
    autoFire: false,
    repeat: true,
    resetDelaySeconds: 1.5,
  };
  private resetTimer = -1;
  private autoFireEnabled = false;
  private assetPreviewObjects: Phaser.GameObjects.GameObject[] = [];
  private assetPreviewTimer: Phaser.Time.TimerEvent | null = null;
  private assetPreviewGeneration = 0;

  constructor(private readonly host: StudioRuntimeHost) {}

  get isEnabled(): boolean {
    return this.enabled;
  }
  get autoFire(): boolean {
    return this.autoFireEnabled;
  }
  get arenaConfig(): SimulationArenaConfig {
    return structuredClone(this.arena);
  }
  get isLevelArena(): boolean {
    return this.arena.type === 'level';
  }
  get isBossArena(): boolean {
    return this.enabled && this.arena.type === 'boss';
  }

  initialize(
    levelId: string,
    enabled: boolean,
    requestedArena?: string | null,
    requestedArenaId?: string,
  ): void {
    this.enabled = enabled;
    if (enabled && requestedArena) {
      const parsed = SimulationArenaConfigSchema.safeParse({
        type: requestedArena,
        id: requestedArenaId,
        levelId,
        autoFire: requestedArena === 'weapon' || requestedArena === 'loadout',
        repeat: true,
        resetDelaySeconds: 1.5,
      });
      if (parsed.success) this.arena = parsed.data;
      else this.useLevelArena(levelId);
    } else this.useLevelArena(levelId);
    this.simulation.reset(levelId, this.arena);
    this.autoFireEnabled = this.arena.autoFire;
  }

  reset(): void {
    this.resetTimer = -1;
    this.autoFireEnabled = false;
    this.clearAssetPreview();
  }

  runtimeState(): StudioRuntimeState | null {
    const timeline = this.host.timeline();
    const player = this.host.player();
    if (!timeline || !player) return null;
    return {
      levelId: timeline.def.id,
      levelTime: timeline.levelTime,
      duration: timeline.def.durationTarget,
      scene: this.host.scene.scene.key,
      paused: this.host.scene.scene.isPaused(),
      timeScale: gameTime.scale,
      snapshotInterval: this.simulation.snapshotInterval,
      music: music.getDebugState(),
      arena: this.arena,
      snapshots: this.simulation.snapshotIndex(),
      telemetry: this.simulation.telemetrySeries().slice(-400),
      metrics: {
        activeEnemies: this.host.enemies()?.activeCount() ?? 0,
        enemyProjectiles: this.host.enemyBullets()?.activeCount() ?? 0,
        playerProjectiles:
          (this.host.playerBullets()?.activeCount() ?? 0) +
          (this.host.missiles()?.activeCount() ?? 0),
        survivability: Phaser.Math.Clamp(player.survivabilityFraction, 0, 1),
        multiplier: this.host.multiplier()?.tier ?? 1,
        intensity: this.host.lastMusicThreat(),
      },
    };
  }

  seekTo(seconds: number): void {
    const timeline = this.host.timeline();
    if (!timeline || !Number.isFinite(seconds)) return;
    const target = Phaser.Math.Clamp(seconds, 0, timeline.def.durationTarget);
    const anchor = this.simulation.nearestSnapshot(target);
    if (!anchor || target - anchor.levelTime > 12) {
      timeline.seekTo(target);
      return;
    }
    timeline.seekTo(anchor.levelTime);
    this.restoreSnapshot(anchor);
    this.fastForward(Math.max(0, target - anchor.levelTime));
  }

  step(deltaSeconds: number): void {
    const timeline = this.host.timeline();
    if (!timeline || !Number.isFinite(deltaSeconds)) return;
    this.seekTo(timeline.levelTime + deltaSeconds);
  }

  setSnapshotInterval(seconds: number): number {
    const interval = this.simulation.setSnapshotInterval(
      seconds,
      this.host.timeline()?.levelTime ?? 0,
    );
    this.captureSnapshot();
    return interval;
  }

  applyTuning(input: unknown): string {
    const pkg = studioTuningOverlay.apply(input);
    const timeline = this.host.timeline();
    if (timeline) {
      if (this.arena.type === 'level') this.seekTo(timeline.levelTime);
      else this.resetArena();
    }
    return `${pkg.manifest.id}@${pkg.manifest.version}`;
  }

  restoreTuning(): void {
    studioTuningOverlay.restore();
    if (this.host.timeline()) this.resetArena();
  }

  applyAssets(input: unknown): string {
    const pkg = studioAssetOverlay.apply(input);
    if (studioAssetOverlay.currentRequest) this.renderAssetPreview();
    return `${pkg.manifest.id}@${pkg.manifest.version}`;
  }

  previewAsset(input: unknown): unknown {
    const request = studioAssetOverlay.setPreview(input);
    this.renderAssetPreview();
    return request;
  }

  applyMusic(input: unknown): string {
    const pkg = studioMusicOverlay.apply(input);
    return `${pkg.manifest.id}@${pkg.manifest.version}`;
  }

  previewMusic(input: unknown): void {
    void studioMusicOverlay.preview(input);
  }

  restoreMusic(): void {
    studioMusicOverlay.restore();
  }

  configureArena(input: unknown): SimulationArenaConfig {
    this.arena = SimulationArenaConfigSchema.parse(input);
    this.simulation.setArena(this.arena);
    this.autoFireEnabled = this.arena.autoFire;
    this.host.scene.registry.set(REGISTRY.DEBUG_INVULNERABLE, true);
    this.resetArena();
    return structuredClone(this.arena);
  }

  onRuntimeReady(): void {
    if (!this.enabled) return;
    this.host.scene.registry.set(REGISTRY.DEBUG_INVULNERABLE, true);
    if (this.arena.type !== 'level') this.resetArena();
    else this.captureSnapshot();
  }

  updateArena(dt: number): void {
    if (!this.enabled || this.arena.type === 'level' || this.arena.type === 'route')
      return;
    const enemies = this.host.enemies();
    const enemyBullets = this.host.enemyBullets();
    const encounterRunner = this.host.encounterRunner();
    if (!enemies || !enemyBullets || !encounterRunner) return;
    const complete =
      enemies.activeCount() === 0 &&
      enemyBullets.activeCount() === 0 &&
      !this.host.bossPresent() &&
      encounterRunner.allComplete();
    if (!complete) {
      this.resetTimer = -1;
      return;
    }
    if (!this.arena.repeat) return;
    if (this.resetTimer < 0) this.resetTimer = this.arena.resetDelaySeconds;
    this.resetTimer -= dt;
    if (this.resetTimer <= 0) this.resetArena();
  }

  markBossArenaComplete(): void {
    if (!this.isBossArena) return;
    this.resetTimer = this.arena.repeat ? this.arena.resetDelaySeconds : -1;
  }

  sample(dt: number, frameMs: number): void {
    const timeline = this.host.timeline();
    const player = this.host.player();
    const enemies = this.host.enemies();
    const enemyBullets = this.host.enemyBullets();
    const playerBullets = this.host.playerBullets();
    const missiles = this.host.missiles();
    const multiplier = this.host.multiplier();
    if (
      !this.enabled ||
      !timeline ||
      !player ||
      !enemies ||
      !enemyBullets ||
      !playerBullets ||
      !missiles ||
      !multiplier
    )
      return;
    this.simulation.sample(
      {
        time: timeline.levelTime,
        activeEnemies: enemies.activeCount(),
        enemyProjectiles: enemyBullets.activeCount(),
        playerProjectiles: playerBullets.activeCount() + missiles.activeCount(),
        survivability: Phaser.Math.Clamp(player.survivabilityFraction, 0, 1),
        multiplier: multiplier.tier,
        frameMs,
        intensity: this.host.lastMusicThreat(),
      },
      dt,
    );
    if (this.simulation.shouldCapture(timeline.levelTime)) this.captureSnapshot();
  }

  clearAssetPreview(): void {
    this.assetPreviewGeneration += 1;
    this.destroyAssetPreviewObjects();
  }

  private destroyAssetPreviewObjects(): void {
    this.assetPreviewTimer?.remove(false);
    this.assetPreviewTimer = null;
    this.assetPreviewObjects.forEach((object) => object.destroy());
    this.assetPreviewObjects = [];
  }

  private useLevelArena(levelId: string): void {
    this.arena = {
      type: 'level',
      levelId,
      autoFire: false,
      repeat: true,
      resetDelaySeconds: 1.5,
    };
  }

  private renderAssetPreview(): void {
    const request = studioAssetOverlay.currentRequest;
    const asset = studioAssetOverlay.asset();
    if (!request || !asset) return;
    const source = studioAssetOverlay.textureSource(asset);
    if (!source) return;
    const scene = this.host.scene;
    const generation = ++this.assetPreviewGeneration;
    const draw = () => {
      if (generation !== this.assetPreviewGeneration) return;
      this.destroyAssetPreviewObjects();
      const colors: Record<string, number> = {
        neutral: 0x182433,
        canyon: 0x6e3f28,
        ice: 0x315f78,
        space: 0x071025,
        station: 0x343e49,
        combat: 0x552838,
      };
      const background = scene.add
        .rectangle(
          GAME_WIDTH / 2,
          430,
          GAME_WIDTH - 36,
          610,
          colors[request.context] ?? colors.neutral,
          0.96,
        )
        .setDepth(DEPTHS.HUD + 20)
        .setStrokeStyle(2, 0x77b4ff, 0.8);
      const label = scene.add
        .text(
          30,
          140,
          `ASSET PREVIEW · ${request.context.toUpperCase()}\n${asset.displayName} · ${asset.id}`,
          { fontFamily: 'monospace', fontSize: '13px', color: '#d6e2f7' },
        )
        .setDepth(DEPTHS.HUD + 24);
      const scale = Math.max(1.5, asset.scale * 3);
      const shadow = scene.add
        .ellipse(
          GAME_WIDTH / 2 + asset.presentation.shadowOffsetX,
          430 + asset.presentation.shadowOffsetY,
          asset.width * scale * asset.presentation.shadowScaleX,
          asset.height * scale * asset.presentation.shadowScaleY,
          0x000000,
          asset.presentation.shadowOpacity,
        )
        .setDepth(DEPTHS.HUD + 21);
      const texture = scene.textures.get(source.key);
      const frames = asset.frames.length
        ? asset.frames
        : [
            {
              id: `${asset.id}-frame-0`,
              x: 0,
              y: 0,
              width: asset.width,
              height: asset.height,
              durationMs: 100,
            },
          ];
      frames.forEach((frame, index) => {
        const frameName = `studio-${asset.id}-${index}`;
        if (!texture.has(frameName))
          texture.add(frameName, 0, frame.x, frame.y, frame.width, frame.height);
      });
      const sprite = scene.add
        .sprite(GAME_WIDTH / 2, 430, source.key, `studio-${asset.id}-0`)
        .setOrigin(asset.pivot.x, asset.pivot.y)
        .setScale(scale)
        .setDepth(DEPTHS.HUD + 22);
      const graphics = scene.add.graphics().setDepth(DEPTHS.HUD + 23);
      graphics.lineStyle(2, 0xff6262, 0.9);
      if (asset.collision?.type === 'circle')
        graphics.strokeCircle(
          GAME_WIDTH / 2 + asset.collision.offsetX * scale,
          430 + asset.collision.offsetY * scale,
          asset.collision.radius * scale,
        );
      if (asset.collision?.type === 'rectangle')
        graphics.strokeRect(
          GAME_WIDTH / 2 +
            asset.collision.offsetX * scale -
            (asset.collision.width * scale) / 2,
          430 + asset.collision.offsetY * scale - (asset.collision.height * scale) / 2,
          asset.collision.width * scale,
          asset.collision.height * scale,
        );
      graphics.fillStyle(0xffe26a, 1);
      asset.hardpoints.forEach((hardpoint) =>
        graphics.fillCircle(
          GAME_WIDTH / 2 + (hardpoint.x - asset.width * asset.pivot.x) * scale,
          430 + (hardpoint.y - asset.height * asset.pivot.y) * scale,
          4,
        ),
      );
      const close = scene.add
        .text(GAME_WIDTH - 55, 142, '×', {
          fontFamily: 'monospace',
          fontSize: '24px',
          color: '#ffffff',
        })
        .setInteractive({ useHandCursor: true })
        .setDepth(DEPTHS.HUD + 25)
        .on('pointerdown', () => this.clearAssetPreview());
      this.assetPreviewObjects = [background, shadow, sprite, graphics, label, close];
      const animation = asset.animations.idle ?? Object.values(asset.animations)[0];
      if (animation && animation.frames.length > 1) {
        let position = 0;
        this.assetPreviewTimer = scene.time.addEvent({
          delay: 1000 / animation.fps,
          loop: animation.loop,
          callback: () => {
            const frameIndex = animation.frames[position] ?? 0;
            sprite.setFrame(`studio-${asset.id}-${frameIndex}`);
            position = (position + 1) % animation.frames.length;
          },
        });
      }
    };
    if (scene.textures.exists(source.key)) {
      draw();
      return;
    }
    if (!source.uri) return;
    scene.load.image(source.key, source.uri);
    scene.load.once(Phaser.Loader.Events.COMPLETE, draw);
    scene.load.start();
  }

  private resetArena(): void {
    const timeline = this.host.timeline();
    const encounterRunner = this.host.encounterRunner();
    const formationSpawner = this.host.formationSpawner();
    if (!timeline || !encounterRunner || !formationSpawner) return;
    this.resetTimer = -1;
    this.autoFireEnabled = this.arena.autoFire;
    timeline.seekTo(0);
    if (this.arena.type === 'level') {
      this.captureSnapshot();
      return;
    }
    this.host.hardClearGameplay();
    encounterRunner.clearAll(true);
    formationSpawner.clearAll();
    this.spawnArena();
    this.captureSnapshot();
  }

  private spawnArena(): void {
    const id = this.arena.id;
    const enemies = this.host.enemies();
    const formations = this.host.formationSpawner();
    const encounters = this.host.encounterRunner();
    if (!enemies || !formations || !encounters) return;
    switch (this.arena.type) {
      case 'enemy': {
        const enemyId =
          id && contentRegistry.enemies.has(id)
            ? id
            : contentRegistry.enemies.keys().next().value;
        if (enemyId)
          enemies
            .spawn()
            ?.activate(enemyId, GAME_WIDTH / 2, -40, this.host.enemyContext());
        break;
      }
      case 'weapon': {
        const weaponId = id && contentRegistry.weapons.has(id) ? id : 'pulse_cannon';
        this.host.equipPrimaryWeapon(weaponId);
        this.autoFireEnabled = true;
        [150, 270, 390].forEach((x) =>
          enemies.spawn()?.activate('light_fighter', x, 210, this.host.enemyContext(), {
            movementPattern: 'static_hold',
            weaponPattern: null,
          }),
        );
        break;
      }
      case 'formation': {
        const formationId =
          id && contentRegistry.formations.has(id)
            ? id
            : contentRegistry.formations.keys().next().value;
        if (formationId) formations.spawn(formationId, GAME_WIDTH / 2, -40);
        break;
      }
      case 'encounter': {
        const encounterId =
          id && contentRegistry.encounters.has(id)
            ? id
            : contentRegistry.encounters.keys().next().value;
        if (encounterId) encounters.start(encounterId);
        break;
      }
      case 'boss': {
        const bossId =
          id && contentRegistry.bosses.has(id)
            ? id
            : contentRegistry.bosses.keys().next().value;
        if (bossId) this.host.startBoss(bossId);
        break;
      }
      case 'loadout':
        this.autoFireEnabled = true;
        [180, 270, 360].forEach((x) =>
          enemies.spawn()?.activate('heavy_fighter', x, 220, this.host.enemyContext(), {
            movementPattern: 'static_hold',
            weaponPattern: null,
          }),
        );
        break;
      case 'route':
      case 'level':
        break;
    }
  }

  private captureSnapshot(): void {
    const timeline = this.host.timeline();
    const player = this.host.player();
    const score = this.host.score();
    const multiplier = this.host.multiplier();
    const enemies = this.host.enemies();
    const playerBullets = this.host.playerBullets();
    const enemyBullets = this.host.enemyBullets();
    const missiles = this.host.missiles();
    const pickups = this.host.pickups();
    if (
      !this.enabled ||
      !timeline ||
      !player ||
      !score ||
      !multiplier ||
      !enemies ||
      !playerBullets ||
      !enemyBullets ||
      !missiles ||
      !pickups
    )
      return;
    const defense = player.defense.snapshot();
    const energy = player.energy.snapshot();
    const enemyStates = enemies.group
      .getMatching('active', true)
      .map((value) => value.studioSnapshot())
      .filter((value) => value !== null);
    const projectileStates: PooledProjectileStudioSnapshot[] = [
      ...this.projectileSnapshots('player', playerBullets),
      ...this.projectileSnapshots('enemy', enemyBullets),
      ...this.projectileSnapshots('missile', missiles),
    ];
    const pickupStates = pickups.group
      .getMatching('active', true)
      .map((value) => value.studioSnapshot())
      .filter((value) => value !== null);
    this.simulation.capture(timeline.def.id, timeline.levelTime, {
      player: {
        x: player.x,
        y: player.y,
        armor: defense.armor,
        shield: defense.shield,
        energy: energy.current,
      },
      terrainState: this.host.terrain()?.snapshot() ?? {},
      score: score.value,
      multiplier: multiplier.tier,
      activeEnemies: enemyStates.length,
      activeProjectiles: projectileStates.length,
      enemyStates,
      projectileStates,
      pickupStates,
      groundTargetStates: this.host
        .groundTargets()
        .map((target) => target.studioSnapshot()),
      bossId: this.host.bossId(),
      tuningFingerprint: studioTuningOverlay.fingerprint,
    });
  }

  private projectileSnapshots(
    poolName: PooledProjectileStudioSnapshot['pool'],
    pool: PoolManager<Projectile>,
  ): PooledProjectileStudioSnapshot[] {
    return pool.group
      .getMatching('active', true)
      .map((value) => value.studioSnapshot())
      .filter((value) => value !== null)
      .map((state) => ({ pool: poolName, state }));
  }

  private restoreSnapshot(snapshot: StudioRuntimeSnapshot): void {
    const player = this.host.player();
    const score = this.host.score();
    const multiplier = this.host.multiplier();
    const enemies = this.host.enemies();
    const playerBullets = this.host.playerBullets();
    const enemyBullets = this.host.enemyBullets();
    const missiles = this.host.missiles();
    const pickups = this.host.pickups();
    const encounterRunner = this.host.encounterRunner();
    const formationSpawner = this.host.formationSpawner();
    const worldScroll = this.host.worldScroll();
    const shipLoadout = this.host.shipLoadout();
    if (
      !player ||
      !score ||
      !multiplier ||
      !enemies ||
      !playerBullets ||
      !enemyBullets ||
      !missiles ||
      !pickups ||
      !encounterRunner ||
      !formationSpawner ||
      !worldScroll ||
      !shipLoadout
    )
      return;
    this.host.hardClearGameplay();
    encounterRunner.clearAll(false);
    formationSpawner.clearAll();
    player.setPosition(snapshot.player.x, snapshot.player.y);
    player.arcadeBody.reset(snapshot.player.x, snapshot.player.y);
    player.defense.restore({
      armor: snapshot.player.armor,
      shield: snapshot.player.shield,
      rechargeDelayRemaining: 0,
    });
    player.energy.setCurrent(snapshot.player.energy);
    score.restore(snapshot.score);
    multiplier.restoreTier(snapshot.multiplier);
    this.host
      .terrain()
      ?.resetDynamicState(
        snapshot.terrainState as import('../terrain/TerrainRuntime').TerrainStateSnapshot,
      );
    for (const state of snapshot.enemyStates)
      enemies.spawn()?.restoreStudioSnapshot(state, this.host.enemyContext());
    for (const projectile of snapshot.projectileStates) {
      const pool =
        projectile.pool === 'player'
          ? playerBullets
          : projectile.pool === 'enemy'
            ? enemyBullets
            : missiles;
      pool
        .spawn()
        ?.restoreStudioSnapshot(projectile.state, () => this.host.nearestEnemy());
    }
    for (const state of snapshot.pickupStates)
      pickups.spawn()?.restoreStudioSnapshot(state, () => ({
        x: player.x,
        y: player.y,
        radius: shipLoadout.derivedStats.pickupMagnetRadius,
      }));
    const groundStateById = new Map(
      snapshot.groundTargetStates.map((state) => [state.targetId, state]),
    );
    for (const target of this.host.groundTargets()) {
      const state = groundStateById.get(target.targetId);
      if (state) target.restoreStudioSnapshot(state, worldScroll.distance);
    }
    if (snapshot.bossId) this.host.startBoss(snapshot.bossId, true);
  }

  private fastForward(seconds: number): void {
    const timeline = this.host.timeline();
    const encounters = this.host.encounterRunner();
    const formations = this.host.formationSpawner();
    const enemies = this.host.enemies();
    const playerBullets = this.host.playerBullets();
    const enemyBullets = this.host.enemyBullets();
    const missiles = this.host.missiles();
    const pickups = this.host.pickups();
    const player = this.host.player();
    const worldScroll = this.host.worldScroll();
    if (
      seconds <= 0 ||
      !timeline ||
      !encounters ||
      !formations ||
      !enemies ||
      !playerBullets ||
      !enemyBullets ||
      !missiles ||
      !pickups ||
      !player ||
      !worldScroll
    )
      return;
    const savedScale = gameTime.scale;
    gameTime.scale = 1;
    let remaining = Math.min(seconds, 30);
    const stepSeconds = 1 / 30;
    while (remaining > 1e-6) {
      const dt = Math.min(stepSeconds, remaining);
      if (this.arena.type === 'level') timeline.update(dt);
      else timeline.advanceClockOnly(dt);
      encounters.update(dt);
      formations.update(dt);
      enemies.group
        .getMatching('active', true)
        .forEach((value) => value.preUpdate(0, dt * 1000));
      [playerBullets, enemyBullets, missiles].forEach((pool) =>
        pool.group.getMatching('active', true).forEach((projectile) => {
          projectile.preUpdate(0, dt * 1000);
          if (!projectile.active) return;
          projectile.x += projectile.arcadeBody.velocity.x * dt;
          projectile.y += projectile.arcadeBody.velocity.y * dt;
          projectile.arcadeBody.updateFromGameObject();
        }),
      );
      pickups.group
        .getMatching('active', true)
        .forEach((value) => value.preUpdate(0, dt * 1000));
      this.host.tickBoss(dt);
      this.host
        .terrain()
        ?.update(worldScroll.distance, dt);
      remaining -= dt;
    }
    gameTime.scale = savedScale;
  }
}
