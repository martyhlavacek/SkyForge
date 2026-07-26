import {
  MAX_LEVEL_MUSIC_FILE_BYTES,
  appearsToBeMp3,
  createTrackId,
  isSafeMusicRelativePath,
  musicRelativePath,
  type MusicAssetRecord,
  type MusicAssetSource,
} from './levelMusicCore';

export interface ImportedMusicAsset {
  record: MusicAssetRecord;
  bytes: Uint8Array;
}

export interface MusicImportOptions {
  displayName?: string;
  source?: MusicAssetSource;
  maxBytes?: number;
  now?: () => Date;
  readDurationSeconds?: (file: File) => Promise<number | undefined>;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto is unavailable; MP3 import cannot verify integrity.');
  }
  const input = new Uint8Array(bytes.byteLength);
  input.set(bytes);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', input);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}

export async function readAudioDurationSeconds(file: File): Promise<number | undefined> {
  if (typeof Audio === 'undefined' || typeof URL === 'undefined') return undefined;

  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise<number | undefined>((resolve) => {
      const audio = new Audio();
      const settle = (value?: number): void => {
        audio.removeAttribute('src');
        audio.load();
        resolve(value);
      };
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => {
        const duration = Number.isFinite(audio.duration) && audio.duration >= 0
          ? audio.duration
          : undefined;
        settle(duration);
      };
      audio.onerror = () => settle(undefined);
      audio.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function importMp3File(
  file: File,
  options: MusicImportOptions = {},
): Promise<ImportedMusicAsset> {
  const maxBytes = options.maxBytes ?? MAX_LEVEL_MUSIC_FILE_BYTES;
  if (!file.name.toLowerCase().endsWith('.mp3')) {
    throw new Error('Only .mp3 files can be imported as per-level music.');
  }
  if (file.size <= 0 || file.size > maxBytes) {
    throw new Error(`MP3 must be between 1 byte and ${maxBytes} bytes.`);
  }
  if (file.type && file.type !== 'audio/mpeg' && file.type !== 'audio/mp3') {
    throw new Error(`Unsupported media type: ${file.type}`);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!appearsToBeMp3(bytes)) {
    throw new Error('The selected file does not contain a recognizable MP3 header.');
  }

  const sha256 = await sha256Hex(bytes);
  const id = createTrackId(file.name, sha256);
  const relativePath = musicRelativePath(id);
  if (!isSafeMusicRelativePath(relativePath)) {
    throw new Error('Generated music path failed the safe-path policy.');
  }

  const durationReader = options.readDurationSeconds ?? readAudioDurationSeconds;
  const durationSeconds = await durationReader(file);
  const displayName = (options.displayName?.trim() || file.name.replace(/\.mp3$/i, '')).slice(0, 120);

  return {
    bytes,
    record: {
      id,
      displayName,
      fileName: file.name,
      relativePath,
      mimeType: 'audio/mpeg',
      byteLength: bytes.byteLength,
      sha256,
      durationSeconds,
      source: options.source ?? 'external',
      importedAt: (options.now ?? (() => new Date()))().toISOString(),
    },
  };
}
