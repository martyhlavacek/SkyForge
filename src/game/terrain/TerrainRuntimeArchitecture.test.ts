import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./TerrainRuntime.ts', import.meta.url), 'utf8');

describe('TerrainRuntime visual-only boundary', () => {
  it('does not resolve player or projectile collision', () => {
    for (const forbidden of [
      'resolveCircleInCorridor',
      'sweepCircleInCorridor',
      'sweepCircleAgainstRect',
      'resolvePlayer(',
      'resolveProjectiles(',
      'type { Player }',
      'type { Projectile }',
      'type { PoolManager }',
      'takeDamage(',
      'deactivate()',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('renders continuous terrain planes separately from chunked terrain cells', () => {
    expect(source).toContain("layer.renderMode === 'tileSprite'");
    expect(source).toContain("layer.renderMode === 'compositedCells'");
    expect(source).toContain('.tileSprite(');
    expect(source).toContain('terrainPlaneTextureKey');
    expect(source).toContain('tilePositionY');
    expect(source).toContain("globalCompositeOperation = 'destination-in'");
    expect(source).toContain('createCanvas');
  });

  it('documents terrain as presentation-only', () => {
    expect(source).toContain('presentation-only');
    expect(source).toContain('update(distance: number, dt: number)');
  });
});
