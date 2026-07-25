import Phaser from 'phaser';
import { gameConfig } from './game/config/gameConfig';
import { music } from './game/systems/MusicDirector';
import { gameTime } from './game/systems/GameTime';
import { contentRegistry } from './game/systems/ContentRegistry';
import {
  shouldEnableEmbeddedStudioBridge,
  shouldExposeGlobalRuntimeApi,
} from './game/studio/RuntimeBridgePolicy';

const game = new Phaser.Game(gameConfig);
const params = new URLSearchParams(window.location.search);

declare global {
  interface Window {
    __skyforge?: {
      activeScenes: () => string[];
      sceneStatus: (key: string) => 'active' | 'paused' | 'sleeping' | 'stopped';
      playerPos: () => { x: number; y: number } | null;
      levelSnapshot: () => { id: string; levelTime: number } | null;
      terrainState: () => Record<string, string> | null;
      musicState: () => unknown;
      contentErrorCount: () => number;
      setInvulnerable: (enabled: boolean) => void;
      setTimeScale: (scale: number) => void;
      seek: (seconds: number) => void;
      pause: () => void;
      resume: () => void;
      restart: () => void;
      studioState: () => unknown;
      applyTuning: (value: unknown) => string | null;
      applyAssets: (value: unknown) => string | null;
      previewAsset: (value: unknown) => unknown;
      applyMusic: (value: unknown) => string | null;
      previewMusic: (value: unknown) => void;
      restoreMusic: () => void;
      restoreTuning: () => void;
      configureArena: (value: unknown) => unknown;
      step: (seconds: number) => void;
      setSnapshotInterval: (seconds: number) => number | null;
    };
  }
}

const runtimeApi = {
    activeScenes: () => game.scene.getScenes(true).map((scene) => scene.scene.key),
    sceneStatus: (key) => {
      if (game.scene.isPaused(key)) return 'paused';
      if (game.scene.isSleeping(key)) return 'sleeping';
      if (game.scene.isActive(key)) return 'active';
      return 'stopped';
    },
    playerPos: () => {
      const scene = game.scene.getScene('GameScene') as Phaser.Scene & {
        playerPosition?: { x: number; y: number } | null;
      };
      return scene?.playerPosition ?? null;
    },
    levelSnapshot: () => {
      const scene = game.scene.getScene('GameScene') as Phaser.Scene & {
        levelSnapshot?: { id: string; levelTime: number } | null;
      };
      return scene?.levelSnapshot ?? null;
    },
    terrainState: () => {
      const scene = game.scene.getScene('GameScene') as Phaser.Scene & {
        terrainSnapshot?: Record<string, string> | null;
      };
      return scene?.terrainSnapshot ?? null;
    },
    musicState: () => music.getDebugState(),
    contentErrorCount: () => contentRegistry.errors.length,
    setInvulnerable: (enabled) => game.registry.set('debugInvulnerable', enabled),
    setTimeScale: (scale) => {
      const clamped = Phaser.Math.Clamp(scale, 0.25, 4);
      gameTime.scale = clamped;
      const scene = game.scene.getScene('GameScene') as Phaser.Scene | undefined;
      if (scene?.physics?.world) scene.physics.world.timeScale = 1 / clamped;
    },
    seek: (seconds) => {
      const scene = game.scene.getScene('GameScene') as Phaser.Scene & {
        studioSeekTo?: (value: number) => void;
      };
      scene?.studioSeekTo?.(seconds);
    },
    pause: () => {
      if (game.scene.isActive('GameScene')) game.scene.pause('GameScene');
    },
    resume: () => {
      if (game.scene.isPaused('GameScene')) game.scene.resume('GameScene');
    },
    restart: () => {
      const snapshot = runtimeApi.levelSnapshot();
      game.scene.stop('PauseScene');
      game.scene.stop('GameScene');
      game.scene.start('GameScene', { level: snapshot?.id ?? 'level_01' });
    },
    studioState: () => {
      const scene = game.scene.getScene('GameScene') as Phaser.Scene & {
        studioRuntimeState?: unknown;
      };
      return scene?.studioRuntimeState ?? null;
    },
    applyTuning: (value) => {
      const scene = game.scene.getScene('GameScene') as Phaser.Scene & {
        studioApplyTuning?: (input: unknown) => string;
      };
      return scene?.studioApplyTuning?.(value) ?? null;
    },
    applyAssets: (value) => {
      const scene = game.scene.getScene('GameScene') as Phaser.Scene & {
        studioApplyAssets?: (input: unknown) => string;
      };
      return scene?.studioApplyAssets?.(value) ?? null;
    },
    previewAsset: (value) => {
      const scene = game.scene.getScene('GameScene') as Phaser.Scene & {
        studioPreviewAsset?: (input: unknown) => unknown;
      };
      return scene?.studioPreviewAsset?.(value) ?? null;
    },
    applyMusic: (value) => {
      const scene = game.scene.getScene('GameScene') as Phaser.Scene & {
        studioApplyMusic?: (input: unknown) => string;
      };
      return scene?.studioApplyMusic?.(value) ?? null;
    },
    previewMusic: (value) => {
      const scene = game.scene.getScene('GameScene') as Phaser.Scene & {
        studioPreviewMusic?: (input: unknown) => void;
      };
      scene?.studioPreviewMusic?.(value);
    },
    restoreMusic: () => {
      const scene = game.scene.getScene('GameScene') as Phaser.Scene & {
        studioRestoreMusic?: () => void;
      };
      scene?.studioRestoreMusic?.();
    },
    restoreTuning: () => {
      const scene = game.scene.getScene('GameScene') as Phaser.Scene & {
        studioRestoreTuning?: () => void;
      };
      scene?.studioRestoreTuning?.();
    },
    configureArena: (value) => {
      const scene = game.scene.getScene('GameScene') as Phaser.Scene & {
        studioConfigureArena?: (input: unknown) => unknown;
      };
      return scene?.studioConfigureArena?.(value) ?? null;
    },
    step: (seconds) => {
      const scene = game.scene.getScene('GameScene') as Phaser.Scene & {
        studioStep?: (value: number) => void;
      };
      scene?.studioStep?.(seconds);
    },
    setSnapshotInterval: (seconds) => {
      const scene = game.scene.getScene('GameScene') as Phaser.Scene & {
        studioSetSnapshotInterval?: (value: number) => number;
      };
      return scene?.studioSetSnapshotInterval?.(seconds) ?? null;
    },
  } satisfies NonNullable<Window['__skyforge']>;

const e2eMode = import.meta.env.VITE_E2E === '1';
if (shouldExposeGlobalRuntimeApi({ dev: import.meta.env.DEV, e2e: e2eMode })) {
  window.__skyforge = runtimeApi;
}

const studioSession = params.get('session');
const studioMode = shouldEnableEmbeddedStudioBridge({
  studioRequested: params.get('studio') === '1',
  embedded: window.parent !== window,
  session: studioSession,
});

if (
  params.get('preview') === '1' &&
  (import.meta.env.DEV || e2eMode || studioMode)
) {
  game.registry.set('debugMode', true);
  game.registry.set('audioUnlocked', false);
  game.scene.start('GameScene');
}

if (studioMode) {
  const sendStudioState = () => {
    const state = runtimeApi.studioState() as Record<string, unknown> | null;
    window.parent.postMessage(
      {
        type: 'skyforge-studio-state',
        session: studioSession,
        state: state ?? {
          scene: runtimeApi.activeScenes().join(', ') || 'none',
          paused: runtimeApi.sceneStatus('GameScene') === 'paused',
          music: runtimeApi.musicState(),
        },
      },
      window.location.origin,
    );
  };
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin || event.source !== window.parent) return;
    const data = event.data as {
      type?: string;
      command?: string;
      value?: unknown;
      session?: string;
    };
    if (data.type !== 'skyforge-studio-command' || data.session !== studioSession) return;
    switch (data.command) {
      case 'pause':
        runtimeApi.pause();
        break;
      case 'resume':
        runtimeApi.resume();
        break;
      case 'restart':
        runtimeApi.restart();
        break;
      case 'seek':
        runtimeApi.seek(Number(data.value));
        break;
      case 'setInvulnerable':
        runtimeApi.setInvulnerable(Boolean(data.value));
        break;
      case 'setTimeScale':
        runtimeApi.setTimeScale(Number(data.value));
        break;
      case 'step':
        runtimeApi.step(Number(data.value));
        break;
      case 'applyTuning':
        runtimeApi.applyTuning(data.value);
        break;
      case 'applyAssets':
        runtimeApi.applyAssets(data.value);
        break;
      case 'previewAsset':
        runtimeApi.previewAsset(data.value);
        break;
      case 'applyMusic':
        runtimeApi.applyMusic(data.value);
        break;
      case 'previewMusic':
        runtimeApi.previewMusic(data.value);
        break;
      case 'restoreMusic':
        runtimeApi.restoreMusic();
        break;
      case 'restoreTuning':
        runtimeApi.restoreTuning();
        break;
      case 'configureArena':
        runtimeApi.configureArena(data.value);
        break;
      case 'setSnapshotInterval':
        runtimeApi.setSnapshotInterval(Number(data.value));
        break;
    }
    window.setTimeout(sendStudioState, 0);
  });
  window.setInterval(sendStudioState, 250);
}
