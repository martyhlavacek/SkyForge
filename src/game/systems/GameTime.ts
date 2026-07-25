/**
 * Global game time scale (Sprint 2.5).
 * Every gameplay system converts Phaser's ms delta once via scaledDt() so
 * slow motion / fast forward affects bullets, cooldowns, i-frames, spawners
 * and particles uniformly. Arcade physics is synchronized separately in
 * DebugOverlay (world.timeScale is a divisor in Phaser: 2 = half speed).
 */
export const gameTime = {
  scale: 1,
};

/** Convert a Phaser ms delta to scaled seconds. */
export function scaledDt(deltaMs: number): number {
  return (deltaMs / 1000) * gameTime.scale;
}
