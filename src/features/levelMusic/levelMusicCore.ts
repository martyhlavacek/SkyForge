export const LEVEL_MUSIC_FORMAT_VERSION = '1.0' as const;
export const DEFAULT_LEVEL_MUSIC_VOLUME = 0.8;
export const DEFAULT_LEVEL_MUSIC_FADE_SECONDS = 1;
export const MAX_LEVEL_MUSIC_FILE_BYTES = 100 * 1024 * 1024;

export type MusicAssetSource = 'suno' | 'external';

export interface MusicAssetRecord {
  id: string;
  displayName: string;
  fileName: string;
  relativePath: string;
  mimeType: 'audio/mpeg';
  byteLength: number;
  sha256: string;
  durationSeconds?: number;
  source: MusicAssetSource;
  importedAt: string;
}

export interface MusicAssetRegistry {
  formatVersion: typeof LEVEL_MUSIC_FORMAT_VERSION;
  tracks: MusicAssetRecord[];
}

export interface LevelMusicAssignment {
  trackId: string | null;
  loop: boolean;
  volume: number;
  startOffsetSeconds: number;
  fadeSeconds: number;
}

export interface LevelMusicIssue {
  severity: 'error' | 'warning';
  code:
    | 'DUPLICATE_TRACK_ID'
    | 'DUPLICATE_TRACK_PATH'
    | 'INVALID_TRACK_ID'
    | 'INVALID_SHA256'
    | 'UNSAFE_TRACK_PATH'
    | 'MISSING_TRACK'
    | 'INVALID_ASSIGNMENT';
  message: string;
  levelId?: string;
  trackId?: string;
}

const SAFE_ID = /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/;
const SHA256 = /^[a-f0-9]{64}$/;

export function defaultLevelMusicAssignment(): LevelMusicAssignment {
  return {
    trackId: null,
    loop: true,
    volume: DEFAULT_LEVEL_MUSIC_VOLUME,
    startOffsetSeconds: 0,
    fadeSeconds: DEFAULT_LEVEL_MUSIC_FADE_SECONDS,
  };
}

export function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

export function normalizeLevelMusicAssignment(
  value: Partial<LevelMusicAssignment> | null | undefined,
): LevelMusicAssignment {
  const defaults = defaultLevelMusicAssignment();
  const trackId = typeof value?.trackId === 'string' && value.trackId.trim()
    ? value.trackId.trim()
    : null;

  return {
    trackId,
    loop: value?.loop ?? defaults.loop,
    volume: clamp(value?.volume ?? defaults.volume, 0, 1),
    startOffsetSeconds: clamp(value?.startOffsetSeconds ?? 0, 0, 86_400),
    fadeSeconds: clamp(value?.fadeSeconds ?? defaults.fadeSeconds, 0, 10),
  };
}

export function slugifyTrackName(value: string): string {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\.mp3$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return normalized || 'music-track';
}

export function createTrackId(_fileName: string, sha256: string): string {
  if (!SHA256.test(sha256)) {
    throw new Error('createTrackId requires a lowercase 64-character SHA-256 value.');
  }
  return `music-${sha256.slice(0, 24)}`;
}

export function isSafeTrackId(value: string): boolean {
  return SAFE_ID.test(value);
}

export function isSafeMusicRelativePath(value: string): boolean {
  if (!value || value.includes('\\') || value.startsWith('/') || value.includes('\0')) return false;
  const segments = value.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) return false;
  return value.startsWith('assets/audio/music/') && value.toLowerCase().endsWith('.mp3');
}

export function upsertMusicAsset(
  registry: MusicAssetRegistry,
  asset: MusicAssetRecord,
): MusicAssetRegistry {
  const withoutSameIdentity = registry.tracks.filter(
    (track) => track.id !== asset.id && track.sha256 !== asset.sha256,
  );
  return {
    formatVersion: LEVEL_MUSIC_FORMAT_VERSION,
    tracks: [...withoutSameIdentity, asset].sort((a, b) => a.id.localeCompare(b.id)),
  };
}

export function collectReferencedTrackIds(
  assignments: Iterable<LevelMusicAssignment | null | undefined>,
): Set<string> {
  const ids = new Set<string>();
  for (const value of assignments) {
    const assignment = normalizeLevelMusicAssignment(value);
    if (assignment.trackId) ids.add(assignment.trackId);
  }
  return ids;
}

export function selectLiveMusicAssets(
  registry: MusicAssetRegistry,
  assignments: Iterable<LevelMusicAssignment | null | undefined>,
): MusicAssetRecord[] {
  const liveIds = collectReferencedTrackIds(assignments);
  return registry.tracks
    .filter((track) => liveIds.has(track.id))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function validateLevelMusicModel(
  registry: MusicAssetRegistry,
  levels: ReadonlyArray<{ id: string; music?: Partial<LevelMusicAssignment> | null }>,
): LevelMusicIssue[] {
  const issues: LevelMusicIssue[] = [];
  const ids = new Set<string>();
  const paths = new Set<string>();

  for (const track of registry.tracks) {
    if (!isSafeTrackId(track.id)) {
      issues.push({
        severity: 'error',
        code: 'INVALID_TRACK_ID',
        trackId: track.id,
        message: `Music track ID is unsafe: ${track.id}`,
      });
    }
    if (!SHA256.test(track.sha256)) {
      issues.push({
        severity: 'error',
        code: 'INVALID_SHA256',
        trackId: track.id,
        message: `Music track ${track.id} has an invalid SHA-256 value.`,
      });
    }
    if (!isSafeMusicRelativePath(track.relativePath)) {
      issues.push({
        severity: 'error',
        code: 'UNSAFE_TRACK_PATH',
        trackId: track.id,
        message: `Music track ${track.id} has an unsafe path: ${track.relativePath}`,
      });
    }
    if (ids.has(track.id)) {
      issues.push({
        severity: 'error',
        code: 'DUPLICATE_TRACK_ID',
        trackId: track.id,
        message: `Music track ID is duplicated: ${track.id}`,
      });
    }
    if (paths.has(track.relativePath)) {
      issues.push({
        severity: 'error',
        code: 'DUPLICATE_TRACK_PATH',
        trackId: track.id,
        message: `Music asset path is duplicated: ${track.relativePath}`,
      });
    }
    ids.add(track.id);
    paths.add(track.relativePath);
  }

  for (const level of levels) {
    const assignment = normalizeLevelMusicAssignment(level.music);
    if (assignment.trackId && !ids.has(assignment.trackId)) {
      issues.push({
        severity: 'error',
        code: 'MISSING_TRACK',
        levelId: level.id,
        trackId: assignment.trackId,
        message: `Level ${level.id} references missing music track ${assignment.trackId}.`,
      });
    }
    if (
      assignment.volume < 0 ||
      assignment.volume > 1 ||
      assignment.startOffsetSeconds < 0 ||
      assignment.fadeSeconds < 0 ||
      assignment.fadeSeconds > 10
    ) {
      issues.push({
        severity: 'error',
        code: 'INVALID_ASSIGNMENT',
        levelId: level.id,
        trackId: assignment.trackId ?? undefined,
        message: `Level ${level.id} contains invalid music playback settings.`,
      });
    }
  }

  return issues;
}
