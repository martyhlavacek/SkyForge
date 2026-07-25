import Phaser from 'phaser';
import { REGISTRY, SCENES } from '../config/constants';
import { saveData } from '../systems/SaveData';
import { audio } from '../systems/AudioManager';
import { difficulty } from '../systems/DifficultyManager';

/**
 * BootScene (Sprint 0.3).
 * Sets global registry defaults, then immediately hands off to PreloadScene.
 * Keep this scene logic-free beyond one-time global setup.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.BOOT);
  }

  create(): void {
    this.registry.set(REGISTRY.DEBUG_MODE, import.meta.env.DEV);
    this.registry.set(REGISTRY.AUDIO_UNLOCKED, false);

    // Load persisted settings and apply them before anything runs (S9.3).
    const blob = saveData.load();
    audio.setVolumes({
      master: blob.settings.masterVolume,
      music: blob.settings.musicVolume,
      sfx: blob.settings.sfxVolume,
    });
    difficulty.set(blob.settings.difficulty);
    this.registry.set(REGISTRY.DIFFICULTY, blob.settings.difficulty);

    this.scene.start(SCENES.PRELOAD);
  }
}
