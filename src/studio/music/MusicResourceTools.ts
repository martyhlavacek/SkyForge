import type { StudioResource } from '../../schemas/studioPackageSchema';
import { bytesToBase64, sha256Hex } from '../assets/AssetResourceTools';

const AUDIO_TYPES = new Set([
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
]);

export async function importAudioFile(file: File): Promise<StudioResource> {
  if (!AUDIO_TYPES.has(file.type))
    throw new Error(`${file.name}: supported sample formats are WAV, OGG, MP3, and M4A`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sha256 = await sha256Hex(bytes);
  return {
    id: `audio-${file.name
      .toLowerCase()
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-z0-9]+/g, '-')}-${sha256.slice(0, 12)}`,
    uri: `samples/${file.name}`,
    filename: file.name,
    mediaType: file.type,
    sha256,
    bytes: bytes.byteLength,
    embeddedData: bytesToBase64(bytes),
    license: 'Unspecified — review before distribution',
    provenance: {
      source: 'local-import',
      author: '',
      createdWith: 'unknown',
      importedAt: new Date().toISOString(),
      notes: 'Imported as a verified Skyforge runtime audio resource',
    },
  };
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function verifyMusicPackageResources(
  resources: StudioResource[],
): Promise<void> {
  const failures: string[] = [];
  for (const resource of resources) {
    if (!resource.mediaType.startsWith('audio/')) continue;
    if (!AUDIO_TYPES.has(resource.mediaType))
      failures.push(`${resource.id}: unsupported audio media type ${resource.mediaType}`);
    if (!resource.embeddedData) continue;
    let bytes: Uint8Array;
    try {
      bytes = decodeBase64(resource.embeddedData);
    } catch {
      failures.push(`${resource.id}: embedded audio is not valid base64`);
      continue;
    }
    if (resource.bytes !== undefined && resource.bytes !== bytes.byteLength)
      failures.push(
        `${resource.id}: byte count mismatch (${resource.bytes} declared, ${bytes.byteLength} decoded)`,
      );
    if (resource.sha256) {
      const actual = await sha256Hex(bytes);
      if (actual !== resource.sha256) failures.push(`${resource.id}: SHA-256 mismatch`);
    }
  }
  if (failures.length)
    throw new Error(`music resource verification failed: ${failures.join('; ')}`);
}
