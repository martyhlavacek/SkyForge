import Phaser from 'phaser';
import { DEPTHS, GAME_WIDTH } from '../config/constants';
import { TOUCH_LAYOUT, type InputManager } from '../input/InputManager';
import type { BossController } from '../systems/BossController';
import type { CombatDirector } from '../systems/CombatDirector';
import type { LevelTimeline } from '../systems/LevelTimeline';
import { music } from '../systems/MusicDirector';
import { sweepSpawnX } from '../systems/MovementRunner';
import { DebugOverlay } from './DebugOverlay';

const SEEK_STEP = 10;
const MOVEMENT_DEMOS = [
  { key: 'F1', movement: 'straight_descent', x: 270, y: -40 },
  { key: 'F2', movement: 'sine_descent', x: 270, y: -40 },
  { key: 'F3', movement: 'sweep_left', x: sweepSpawnX('left'), y: 160 },
  { key: 'F4', movement: 'patrol_mid', x: 270, y: -40 },
  { key: 'F5', movement: 'bezier_s_curve', x: 270, y: -40 },
  { key: 'F6', movement: 'dive_retreat_fast', x: 130, y: -40 },
  { key: 'F7', movement: 'stop_and_fire_mid', x: 270, y: -40 },
  { key: 'F8', movement: 'enter_attack_exit_left', x: sweepSpawnX('left'), y: 120 },
];
const FORMATION_DEMOS = [
  { key: 'FOUR', formation: 'v_scouts', x: 270, y: -40 },
  { key: 'FIVE', formation: 'horizontal_row', x: 270, y: -40 },
  { key: 'SIX', formation: 'left_sweep', x: -40, y: 160 },
  { key: 'SEVEN', formation: 'right_sweep', x: 580, y: 240 },
  { key: 'EIGHT', formation: 'staggered_column', x: 270, y: -40 },
  { key: 'NINE', formation: 'pinch_attack', x: -40, y: 120 },
  { key: 'ZERO', formation: 'escort_heavy', x: 270, y: -60 },
];

export interface GameDebugController {
  update(deltaMs: number): void;
  destroy(): void;
}

export interface DebugSetupHost {
  readonly scene: Phaser.Scene;
  readonly combat: CombatDirector;
  readonly timeline: LevelTimeline;
  readonly boss: BossController;
  spawnStressScene(): void;
  toggleWeapon(): void;
}

export function setupGameDebug(host: DebugSetupHost): GameDebugController {
  const overlay = new DebugOverlay(host.scene, {
    poolLines: () => host.combat.poolStatLines(),
    levelTime: () => host.timeline.levelTime,
    encounterName: () => host.combat.encounterRunner.activeNames().join(', ') || '—',
    musicLine: () => {
      const state = music.getDebugState();
      const cue = state.cueId ?? state.pendingCueId ?? '—';
      return `music: ${cue} ${state.state} b${state.bar}.${state.beat} (${state.contextState})`;
    },
    killAllEnemies: () => host.combat.killAllEnemies(),
  });
  const keyboard = host.scene.input.keyboard;
  const handlers: { event: string; callback: () => void }[] = [];
  const bind = (event: string, callback: () => void): void => {
    if (!keyboard) return;
    keyboard.on(event, callback);
    handlers.push({ event, callback });
  };
  bind('keydown-ONE', () => host.combat.weapon.setLevel(1));
  bind('keydown-TWO', () => host.combat.weapon.setLevel(2));
  bind('keydown-THREE', () => host.combat.weapon.setLevel(3));
  bind('keydown-Q', host.toggleWeapon);
  bind('keydown-COMMA', () => host.timeline.seekTo(host.timeline.levelTime - SEEK_STEP));
  bind('keydown-PERIOD', () => host.timeline.seekTo(host.timeline.levelTime + SEEK_STEP));
  bind('keydown-B', () => host.boss.forceNextPhase());
  bind('keydown-T', host.spawnStressScene);
  bind('keydown-C', () => {
    const checkpoints = host.timeline.checkpoints;
    if (checkpoints.length === 0) return;
    const next =
      checkpoints.find((checkpoint) => checkpoint.at > host.timeline.levelTime + 0.01) ??
      checkpoints[0];
    host.timeline.seekTo(next.at);
  });
  for (const demo of MOVEMENT_DEMOS) {
    keyboard?.addCapture(demo.key);
    bind(`keydown-${demo.key}`, () => {
      host.combat.enemies
        .spawn()
        ?.activate('light_fighter', demo.x, demo.y, host.combat.enemyContext(), {
          movementPattern: demo.movement,
        });
    });
  }
  for (const demo of FORMATION_DEMOS)
    bind(`keydown-${demo.key}`, () =>
      host.combat.formationSpawner.spawn(demo.formation, demo.x, demo.y),
    );
  return {
    update: (deltaMs) => overlay.update(deltaMs),
    destroy: () => {
      handlers.forEach(({ event, callback }) => keyboard?.off(event, callback));
      MOVEMENT_DEMOS.forEach((demo) => keyboard?.removeCapture(demo.key));
      overlay.destroy();
    },
  };
}

export function setupTouchControls(
  scene: Phaser.Scene,
  inputManager: InputManager,
): void {
  const secondaryConfig = TOUCH_LAYOUT.secondaryButton;
  const secondary = scene.add
    .circle(secondaryConfig.x, secondaryConfig.y, secondaryConfig.r, 0x4477aa, 0.35)
    .setScrollFactor(0)
    .setDepth(DEPTHS.HUD)
    .setInteractive({ useHandCursor: true });
  scene.add
    .text(secondaryConfig.x, secondaryConfig.y, 'M', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#cde',
    })
    .setOrigin(0.5)
    .setDepth(DEPTHS.HUD + 1);
  secondary.on('pointerdown', () => inputManager.setSecondaryButton(true));
  secondary.on('pointerup', () => inputManager.setSecondaryButton(false));
  secondary.on('pointerout', () => inputManager.setSecondaryButton(false));
  const pauseConfig = TOUCH_LAYOUT.pauseButton;
  const pause = scene.add
    .circle(pauseConfig.x, pauseConfig.y, pauseConfig.r, 0x333844, 0.5)
    .setScrollFactor(0)
    .setDepth(DEPTHS.HUD)
    .setInteractive({ useHandCursor: true });
  scene.add
    .text(pauseConfig.x, pauseConfig.y, 'II', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#cde',
    })
    .setOrigin(0.5)
    .setDepth(DEPTHS.HUD + 1);
  pause.on('pointerdown', () => inputManager.pressPauseButton());
  inputManager.enableTouch([secondaryConfig, pauseConfig]);
}

export function renderContentErrors(
  scene: Phaser.Scene,
  errors: ReadonlyArray<{ file: string; message: string }>,
): void {
  const lines = errors
    .slice(0, 20)
    .map((error) => `${error.file}\n  ${error.message}`)
    .join('\n');
  scene.add
    .rectangle(GAME_WIDTH / 2, 480, GAME_WIDTH - 40, 900, 0x330000, 0.95)
    .setDepth(DEPTHS.DEBUG);
  scene.add
    .text(30, 50, `CONTENT VALIDATION FAILED (${errors.length}):\n\n${lines}`, {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ff8888',
      wordWrap: { width: GAME_WIDTH - 80 },
    })
    .setDepth(DEPTHS.DEBUG + 1);
}
