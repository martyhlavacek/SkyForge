import { describe, expect, it } from 'vitest';
import canyon from '../../content/biomes/canyon.json';
import { BiomeSchema } from '../../schemas/terrainSchema';
import {
  resolveTerrainFrame,
  resolveTerrainPlaneFrame,
  stableCellIndex,
  terrainAssetUrl,
  terrainFrameRect,
} from './TerrainTileset';

const biome = BiomeSchema.parse(canyon);

describe('TerrainTileset', () => {
  it('resolves the standalone sandstone source as a single plane frame', () => {
    expect(resolveTerrainFrame(biome, { x: 0, row: 0, tile: 3 })).toBe(0);
    expect(resolveTerrainFrame(biome, { x: 3, row: 3, tile: 3 })).toBe(0);
    expect(resolveTerrainFrame(biome, { x: 4, row: 4, tile: 3 })).toBe(0);
  });

  it('resolves deterministic variants within the correct Blob-47 frame groups', () => {
    expect([1, 2, 3, 4]).toContain(
      resolveTerrainFrame(biome, { x: 2, row: 3, tile: 7, variant: 0 }),
    );
    expect([185, 186, 187, 188]).toContain(
      resolveTerrainFrame(biome, { x: 2, row: 3, tile: 7, variant: 255 }),
    );
    expect([189, 190, 191, 192]).toContain(
      resolveTerrainFrame(biome, { x: 2, row: 3, tile: 4, variant: 0 }),
    );
    expect([373, 374, 375, 376]).toContain(
      resolveTerrainFrame(biome, { x: 2, row: 3, tile: 4, variant: 255 }),
    );
  });

  it('animates the shared water plane globally at its slower benchmark-audited rate', () => {
    const plane = biome.tileset?.planes.find(
      (candidate) => candidate.materialId === 'river',
    );
    if (!plane) throw new Error('river plane fixture missing');
    expect(resolveTerrainPlaneFrame(plane, 0)).toBe(0);
    expect(resolveTerrainPlaneFrame(plane, 1.6)).toBe(1);
    expect(resolveTerrainPlaneFrame(plane, 3.1)).toBe(2);
    expect(resolveTerrainPlaneFrame(plane, 4.7)).toBe(0);
  });

  it('calculates frame rectangles and base-aware asset URLs', () => {
    expect(terrainFrameRect(33, 16, 32)).toEqual({ x: 32, y: 64, width: 32, height: 32 });
    expect(terrainAssetUrl('assets/terrain/a.png', '/skyforge/')).toBe(
      '/skyforge/assets/terrain/a.png',
    );
  });

  it('returns an index within the requested range', () => {
    expect(stableCellIndex(99, 1234, 'cliff', 7)).toBeGreaterThanOrEqual(0);
    expect(stableCellIndex(99, 1234, 'cliff', 7)).toBeLessThan(7);
  });
});
