import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  base64ToBytes,
  bytesToBase64,
  sanitizeAssetId,
  sha256Hex,
  sliceAssetFrames,
  verifyEmbeddedResource,
} from './AssetResourceTools';
import {
  assertNoAtlasOverlap,
  collectAtlasInputs,
  deterministicFrameKey,
  packAtlas,
} from './AssetAtlasPacker';
import { createBuiltInAssetPack, createBuiltInTuningPack } from '../BuiltInPackages';
import { assetReferenceReport, replaceAssetReferences } from './AssetReplacementReport';
import { studioAssetOverlay } from '../../game/systems/StudioAssetOverlay';

describe('Asset Studio resource tools', () => {
  it('normalizes asset ids and round-trips base64', () => {
    expect(sanitizeAssetId('My Fighter_Sheet.PNG')).toBe('my-fighter-sheet');
    const bytes = new Uint8Array([0, 1, 2, 128, 255]);
    expect([...base64ToBytes(bytesToBase64(bytes))]).toEqual([...bytes]);
  });

  it('verifies embedded resource hashes and byte counts', async () => {
    const bytes = new TextEncoder().encode('skyforge');
    const hash = await sha256Hex(bytes);
    expect(
      await verifyEmbeddedResource({
        id: 'resource',
        uri: 'embedded/resource.png',
        mediaType: 'image/png',
        embeddedData: bytesToBase64(bytes),
        sha256: hash,
        bytes: bytes.byteLength,
      }),
    ).toEqual([]);
    expect(
      await verifyEmbeddedResource({
        id: 'resource',
        uri: 'embedded/resource.png',
        mediaType: 'image/png',
        embeddedData: bytesToBase64(bytes),
        sha256: '0'.repeat(64),
        bytes: 99,
      }),
    ).toHaveLength(2);
  });

  it('slices a sprite sheet deterministically', () => {
    const frames = sliceAssetFrames('fighter', 64, 32, 16, 16);
    expect(frames).toHaveLength(8);
    expect(frames[0]).toMatchObject({ id: 'fighter-frame-0', x: 0, y: 0 });
    expect(frames[7]).toMatchObject({ x: 48, y: 16 });
  });
});

describe('deterministic atlas packing', () => {
  it('sorts frames by stable asset id and creates non-overlapping placements', () => {
    const pack = createBuiltInAssetPack();
    pack.payload.assets[0].resourceId = 'test-a';
    pack.payload.assets[0].frames = [
      { id: 'a0', x: 0, y: 0, width: 24, height: 24, durationMs: 100 },
    ];
    pack.payload.assets[1].resourceId = 'test-b';
    pack.payload.assets[1].frames = [
      { id: 'b0', x: 0, y: 0, width: 16, height: 16, durationMs: 100 },
    ];
    const inputs = collectAtlasInputs(pack.payload.assets.slice(0, 2).reverse());
    const result = packAtlas(inputs, 128, 1);
    expect(result.frames[0].id).toBe(
      deterministicFrameKey(inputs[0].asset.id, inputs[0].frameIndex),
    );
    expect(assertNoAtlasOverlap(result)).toBe(true);
    expect(packAtlas(inputs, 128, 1)).toEqual(result);
  });
});

describe('asset replacement report', () => {
  it('reports missing references and can replace them transactionally', () => {
    const assets = createBuiltInAssetPack();
    const tuning = createBuiltInTuningPack();
    const enemy = tuning.payload.enemies[0];
    const missing = enemy.sprite;
    assets.payload.assets = assets.payload.assets.filter((asset) => asset.id !== missing);
    expect(assetReferenceReport(assets, tuning)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ assetId: missing, severity: 'error' }),
      ]),
    );
    const replacement = assets.payload.assets.find(
      (asset) => asset.kind === 'enemyAircraft',
    )!;
    const next = replaceAssetReferences(tuning, missing, replacement.id);
    expect(next.payload.enemies[0].sprite).toBe(replacement.id);
    expect(tuning.payload.enemies[0].sprite).toBe(missing);
  });
});

describe('built-in Asset Studio resources', () => {
  it('matches the checked-in PNG byte counts and SHA-256 hashes', async () => {
    const pack = createBuiltInAssetPack();
    for (const resource of pack.resources.filter((item) =>
      item.uri.startsWith('assets/studio/'),
    )) {
      const bytes = await readFile(resolve('public', resource.uri));
      expect(bytes.byteLength).toBe(resource.bytes);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(resource.sha256);
    }
  });

  it('provides a runtime-preview texture source for the built-in fighter', () => {
    const pack = createBuiltInAssetPack();
    studioAssetOverlay.apply(pack);
    studioAssetOverlay.setPreview({
      assetId: 'demo_fighter_epoch14',
      context: 'canyon',
    });
    const asset = studioAssetOverlay.asset();
    expect(asset?.animations.idle.frames).toEqual([0, 1, 2, 3]);
    expect(studioAssetOverlay.currentRequest).toEqual({
      assetId: 'demo_fighter_epoch14',
      context: 'canyon',
    });
    expect(studioAssetOverlay.textureSource(asset!)).toEqual(
      expect.objectContaining({
        key: expect.stringContaining('studio-asset-'),
        uri: expect.stringContaining('assets/studio/demo_fighter_sheet.png'),
      }),
    );
  });
});
