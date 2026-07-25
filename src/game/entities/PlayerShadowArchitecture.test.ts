import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLAYER } from '../config/playerConfig';

const playerSource = readFileSync(new URL('./Player.ts', import.meta.url), 'utf8');
const preloadSource = readFileSync(new URL('../scenes/PreloadScene.ts', import.meta.url), 'utf8');

describe('player aircraft shadow', () => {
  it('uses a dedicated ship-shaped texture below the player', () => {
    expect(preloadSource).toContain('TEX.PLAYER_SHADOW');
    expect(preloadSource).toContain('Three nested silhouettes');
    expect(playerSource).toContain('TEX.PLAYER_SHADOW');
    expect(playerSource).toContain('DEPTHS.PLAYER - 1');
    expect(playerSource).not.toContain('.ellipse(');
  });

  it('uses a close readable offset and recognizable flattening', () => {
    expect(PLAYER.shadowOffsetX).toBeGreaterThanOrEqual(8);
    expect(PLAYER.shadowOffsetX).toBeLessThanOrEqual(12);
    expect(PLAYER.shadowOffsetY).toBeGreaterThanOrEqual(12);
    expect(PLAYER.shadowOffsetY).toBeLessThanOrEqual(16);
    expect(PLAYER.shadowScaleY).toBeGreaterThanOrEqual(0.58);
    expect(PLAYER.shadowScaleY).toBeLessThanOrEqual(0.7);
    expect(PLAYER.shadowOpacity).toBeGreaterThanOrEqual(0.3);
    expect(PLAYER.shadowOpacity).toBeLessThanOrEqual(0.38);
  });

  it('tracks visibility, blinking, death, and destruction', () => {
    expect(playerSource).toContain('this.shadow.setPosition');
    expect(playerSource).toContain('this.shadow.setVisible(this.visible)');
    expect(playerSource).toContain('this.alpha * PLAYER.shadowOpacity');
    expect(playerSource).toContain('this.shadow.setVisible(false)');
    expect(playerSource).toContain('this.shadow.destroy()');
  });
});
