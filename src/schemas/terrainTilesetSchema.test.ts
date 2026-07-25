import { describe, expect, it } from 'vitest';
import canyon from '../content/biomes/canyon.json';
import { BiomeSchema } from './terrainSchema';

describe('runtime terrain tileset schema', () => {
  it('accepts the built-in normalized canyon tileset', () => {
    expect(BiomeSchema.safeParse(canyon).success).toBe(true);
  });

  it('rejects a frame outside the atlas', () => {
    const copy = structuredClone(canyon);
    copy.tileset.materials[0].baseFrames = [999];
    expect(BiomeSchema.safeParse(copy).success).toBe(false);
  });

  it('rejects incomplete Blob-47 mappings', () => {
    const copy = structuredClone(canyon);
    const boundary = copy.tileset.materials.find(
      (material) => material.materialId === 'sandstone_boundary',
    );
    if (!boundary?.blob47Frames)
      throw new Error('boundary fixture is missing blob47 mappings');
    delete (boundary.blob47Frames as Record<string, number | number[]>)['255'];
    expect(BiomeSchema.safeParse(copy).success).toBe(false);
  });

  it('rejects non-canonical Blob-47 mappings', () => {
    const copy = structuredClone(canyon);
    const boundary = copy.tileset.materials.find(
      (material) => material.materialId === 'sandstone_boundary',
    );
    if (!boundary?.blob47Frames)
      throw new Error('boundary fixture is missing blob47 mappings');
    (boundary.blob47Frames as Record<string, number | number[]>)['16'] = 17;
    expect(BiomeSchema.safeParse(copy).success).toBe(false);
  });

  it('rejects a sandstone frame outside its single-frame source plane', () => {
    const copy = structuredClone(canyon);
    const sandstonePlane = copy.tileset.planes.find(
      (plane) => plane.materialId === 'sandstone',
    );
    if (!sandstonePlane) throw new Error('sandstone plane fixture missing');
    sandstonePlane.animationFrames = [1];
    expect(BiomeSchema.safeParse(copy).success).toBe(false);
  });

  it('rejects a plane frame outside its spritesheet', () => {
    const copy = structuredClone(canyon);
    copy.tileset.planes[0].animationFrames = [3];
    expect(BiomeSchema.safeParse(copy).success).toBe(false);
  });

  it('rejects traversal in a runtime asset URI', () => {
    const copy = structuredClone(canyon);
    copy.tileset.uri = '../outside.png';
    expect(BiomeSchema.safeParse(copy).success).toBe(false);
  });
});
