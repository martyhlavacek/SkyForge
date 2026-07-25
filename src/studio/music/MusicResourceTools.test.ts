import { describe, expect, it } from 'vitest';
import type { StudioResource } from '../../schemas/studioPackageSchema';
import { bytesToBase64, sha256Hex } from '../assets/AssetResourceTools';
import { verifyMusicPackageResources } from './MusicResourceTools';

function audioResource(bytes: Uint8Array): StudioResource {
  return {
    id: 'audio-test',
    uri: 'samples/test.wav',
    filename: 'test.wav',
    mediaType: 'audio/wav',
    bytes: bytes.byteLength,
    embeddedData: bytesToBase64(bytes),
  };
}

describe('MusicResourceTools', () => {
  it('accepts an embedded audio resource with matching bytes and hash', async () => {
    const bytes = new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4]);
    const resource = audioResource(bytes);
    resource.sha256 = await sha256Hex(bytes);
    await expect(verifyMusicPackageResources([resource])).resolves.toBeUndefined();
  });

  it('rejects byte-count and SHA-256 mismatches', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const resource = audioResource(bytes);
    resource.bytes = 99;
    resource.sha256 = '0'.repeat(64);
    await expect(verifyMusicPackageResources([resource])).rejects.toThrow(
      /byte count mismatch.*SHA-256 mismatch/,
    );
  });

  it('rejects unsupported embedded audio media types', async () => {
    const resource = audioResource(new Uint8Array([1, 2, 3]));
    resource.mediaType = 'audio/flac';
    await expect(verifyMusicPackageResources([resource])).rejects.toThrow(
      /unsupported audio media type audio\/flac/,
    );
  });
});
