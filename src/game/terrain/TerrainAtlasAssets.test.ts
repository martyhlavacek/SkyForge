import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface PngDimensions { width: number; height: number }
function pngDimensions(bytes: Buffer): PngDimensions {
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}
function sha256(bytes: Buffer): string { return createHash('sha256').update(bytes).digest('hex'); }

type FrameMap = Record<string, number | number[]>;

describe('Epoch 18.1 benchmark-audited canyon assets', () => {
  const root = resolve(process.cwd(), 'public/assets/terrain');
  const manifest = JSON.parse(readFileSync(resolve(root, 'skyforge_canyon_tileset.json'), 'utf8')) as {
    terrain: { columns: number; rows: number; tileSize: number; sha256: string; frames: Record<string, number[] | FrameMap> };
    planes: Record<string, { frameWidth: number; frameHeight: number; columns: number; rows: number; sha256: string }>;
    props: { columns: number; rows: number; tileSize: number; sha256: string };
  };

  it('ships the expanded Blob-47 and environment atlas with a matching hash', () => {
    const bytes = readFileSync(resolve(root, 'skyforge_canyon_terrain.png'));
    expect(pngDimensions(bytes)).toEqual({ width: 512, height: 960 });
    expect(sha256(bytes)).toBe(manifest.terrain.sha256);
    expect(manifest.terrain.columns * manifest.terrain.rows).toBe(480);
  });

  it('ships the 512px water frames and sandstone source with matching hashes', () => {
    const water = readFileSync(resolve(root, 'skyforge_canyon_water.png'));
    const sandstone = readFileSync(resolve(root, 'skyforge_canyon_sandstone.png'));
    expect(pngDimensions(water)).toEqual({ width: 1536, height: 512 });
    expect(pngDimensions(sandstone)).toEqual({ width: 512, height: 512 });
    expect(sha256(water)).toBe(manifest.planes.river.sha256);
    expect(sha256(sandstone)).toBe(manifest.planes.sandstone.sha256);
    expect(manifest.planes.river).toMatchObject({ frameWidth: 512, frameHeight: 512, columns: 3, rows: 1 });
    expect(manifest.planes.sandstone).toMatchObject({ frameWidth: 512, frameHeight: 512, columns: 1, rows: 1 });
  });

  it('ships the props atlas with a matching hash', () => {
    const bytes = readFileSync(resolve(root, 'skyforge_canyon_props.png'));
    expect(pngDimensions(bytes)).toEqual({ width: 512, height: 128 });
    expect(sha256(bytes)).toBe(manifest.props.sha256);
  });

  it('maps every Blob-47 state to four visual variants and expanded decorations', () => {
    const boundary = manifest.terrain.frames.sandstoneBoundaryBlob47 as FrameMap;
    const shoreline = manifest.terrain.frames.shorelineBlob47 as FrameMap;
    expect(Object.keys(boundary)).toHaveLength(47);
    expect(Object.keys(shoreline)).toHaveLength(47);
    expect(Object.values(boundary).every((value) => Array.isArray(value) && value.length === 4)).toBe(true);
    expect(Object.values(shoreline).every((value) => Array.isArray(value) && value.length === 4)).toBe(true);
    expect(manifest.terrain.frames.rockClusters).toHaveLength(8);
    expect(manifest.terrain.frames.cracks).toHaveLength(12);
    expect(manifest.terrain.frames.scrub).toHaveLength(10);
    expect(manifest.terrain.frames.sediment).toHaveLength(10);
    expect(manifest.terrain.frames.ruins).toHaveLength(20);
    expect(manifest.terrain.frames.metalPlatform).toHaveLength(29);
  });
});
