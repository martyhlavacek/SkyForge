import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './constants';
import { scenes } from '../scenes';

/**
 * Core Phaser configuration (Sprint 0.1).
 * - Logical portrait resolution 540x960, letterboxed via Scale.FIT.
 * - Arcade physics, zero gravity (vertical shmup — all motion is explicit).
 * - pixelArt renderer hint for crisp placeholder sprites.
 */
export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-root',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0a0c14',
  input: {
    gamepad: true,
    activePointers: 3,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  render: {
    pixelArt: true,
  },
  scene: scenes,
};
