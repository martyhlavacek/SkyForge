import type {
  StudioAssetDefinition,
  StudioAtlasDefinition,
} from '../../schemas/studioPackageSchema';

export interface AtlasPackInput {
  asset: StudioAssetDefinition;
  frameIndex: number;
  width: number;
  height: number;
}

export interface AtlasPackResult {
  width: number;
  height: number;
  frames: StudioAtlasDefinition['frames'];
}

function nextPowerOfTwo(value: number): number {
  let result = 1;
  while (result < value) result *= 2;
  return result;
}

export function deterministicFrameKey(assetId: string, frameIndex: number): string {
  return `${assetId}/frame-${String(frameIndex).padStart(3, '0')}`;
}

export function collectAtlasInputs(assets: StudioAssetDefinition[]): AtlasPackInput[] {
  return assets
    .filter((asset) => asset.status !== 'rejected' && asset.resourceId)
    .flatMap((asset) => {
      const frames = asset.frames.length
        ? asset.frames
        : [
            {
              id: `${asset.id}-frame-0`,
              x: 0,
              y: 0,
              width: asset.width,
              height: asset.height,
              durationMs: 100,
            },
          ];
      return frames.map((frame, frameIndex) => ({
        asset,
        frameIndex,
        width: frame.width,
        height: frame.height,
      }));
    })
    .sort((a, b) =>
      a.asset.id === b.asset.id
        ? a.frameIndex - b.frameIndex
        : a.asset.id.localeCompare(b.asset.id),
    );
}

export function packAtlas(
  inputs: AtlasPackInput[],
  maxWidth = 1024,
  padding = 1,
): AtlasPackResult {
  if (!inputs.length) throw new Error('atlas requires at least one frame');
  if (maxWidth < 32) throw new Error('atlas max width must be at least 32');
  let x = padding;
  let y = padding;
  let rowHeight = 0;
  let usedWidth = 0;
  const frames: StudioAtlasDefinition['frames'] = [];
  for (const input of inputs) {
    if (input.width + padding * 2 > maxWidth)
      throw new Error(`${input.asset.id} frame ${input.frameIndex} exceeds atlas width`);
    if (x + input.width + padding > maxWidth) {
      x = padding;
      y += rowHeight + padding;
      rowHeight = 0;
    }
    frames.push({
      id: deterministicFrameKey(input.asset.id, input.frameIndex),
      assetId: input.asset.id,
      sourceFrame: input.frameIndex,
      x,
      y,
      width: input.width,
      height: input.height,
      pivot: structuredClone(input.asset.pivot),
    });
    x += input.width + padding;
    rowHeight = Math.max(rowHeight, input.height);
    usedWidth = Math.max(usedWidth, x);
  }
  return {
    width: Math.min(maxWidth, nextPowerOfTwo(Math.max(32, usedWidth + padding))),
    height: nextPowerOfTwo(Math.max(32, y + rowHeight + padding)),
    frames,
  };
}

export function assertNoAtlasOverlap(result: AtlasPackResult): boolean {
  return result.frames.every((frame, index) =>
    result.frames
      .slice(index + 1)
      .every(
        (other) =>
          frame.x + frame.width <= other.x ||
          other.x + other.width <= frame.x ||
          frame.y + frame.height <= other.y ||
          other.y + other.height <= frame.y,
      ),
  );
}
