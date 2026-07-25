import type { BiomeDef, TerrainCellDef } from '../../schemas/terrainSchema';
import { normalizeBlob47Mask } from './Autotile';

export const terrainTextureKey = (tilesetId: string): string =>
  `terrain-tileset-${tilesetId}`;

export const terrainPlaneTextureKey = (tilesetId: string, materialId: string): string =>
  `terrain-plane-${tilesetId}-${materialId}`;

export interface TerrainFrameRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function terrainAssetUrl(uri: string, baseUrl = import.meta.env.BASE_URL): string {
  const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${cleanBase}${uri.replace(/^\/+/, '')}`;
}

export function terrainFrameRect(
  frame: number,
  columns: number,
  tileSize: number,
): TerrainFrameRect {
  return {
    x: (frame % columns) * tileSize,
    y: Math.floor(frame / columns) * tileSize,
    width: tileSize,
    height: tileSize,
  };
}

export function resolveTerrainFrame(
  biome: BiomeDef,
  cell: Pick<TerrainCellDef, 'x' | 'row' | 'tile' | 'variant' | 'frame'>,
  layerId = '',
  elapsedSeconds = 0,
): number | null {
  const tileset = biome.tileset;
  if (!tileset) return null;
  const material = biome.materials.find((candidate) => candidate.tile === cell.tile);
  if (!material) return null;
  const visual = tileset.materials.find(
    (candidate) => candidate.materialId === material.id,
  );
  if (!visual) return null;

  if (cell.frame !== undefined) return cell.frame;

  if (cell.variant !== undefined && visual.blob47Frames) {
    const blob = visual.blob47Frames[String(normalizeBlob47Mask(cell.variant))];
    if (blob !== undefined) {
      if (Array.isArray(blob)) {
        return blob[stableCellIndex(cell.x, cell.row, `${layerId}:blob47`, blob.length)] ?? blob[0] ?? null;
      }
      return blob;
    }
  }

  if (cell.variant !== undefined && cell.variant !== 15 && visual.cardinalFrames) {
    const cardinal = visual.cardinalFrames[String(cell.variant)];
    if (cardinal !== undefined) return cardinal;
  }

  if (visual.metatileFrames) {
    const frameX = positiveModulo(cell.x, visual.metatileFrames.columns);
    const frameY = positiveModulo(cell.row, visual.metatileFrames.rows);
    const index = frameY * visual.metatileFrames.columns + frameX;
    return visual.metatileFrames.frames[index] ?? visual.baseFrames[0] ?? null;
  }

  const animationFrames = visual.animationFrames ?? [];
  if (animationFrames.length > 0 && (visual.animationFps ?? 0) > 0) {
    const phase = visual.synchronizedAnimation
      ? 0
      : stableCellIndex(cell.x, cell.row, layerId, animationFrames.length);
    const frame = Math.floor(elapsedSeconds * (visual.animationFps ?? 1) + phase);
    return animationFrames[frame % animationFrames.length] ?? animationFrames[0] ?? null;
  }

  if (visual.baseFrames.length === 0) return null;
  return (
    visual.baseFrames[
      stableCellIndex(cell.x, cell.row, layerId, visual.baseFrames.length)
    ] ??
    visual.baseFrames[0] ??
    null
  );
}

export function stableCellIndex(
  x: number,
  row: number,
  salt: string,
  length: number,
): number {
  if (length <= 1) return 0;
  let hash = Math.imul(x + 1, 0x45d9f3b) ^ Math.imul(row + 1, 0x119de1f3);
  for (let index = 0; index < salt.length; index += 1) {
    hash = Math.imul(hash ^ salt.charCodeAt(index), 0x01000193);
  }
  return (hash >>> 0) % length;
}

export function resolveTerrainPlaneFrame(
  plane: NonNullable<BiomeDef['tileset']>['planes'][number],
  elapsedSeconds: number,
): number {
  const frames = plane.animationFrames;
  if (frames.length === 0) return 0;
  const frameIndex = Math.floor(elapsedSeconds * plane.animationFps) % frames.length;
  return frames[frameIndex] ?? frames[0] ?? 0;
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
