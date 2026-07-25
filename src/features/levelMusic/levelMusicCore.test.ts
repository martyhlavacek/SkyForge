import { describe, expect, it } from 'vitest';
import {
  LEVEL_MUSIC_FORMAT_VERSION,
  collectReferencedTrackIds,
  createTrackId,
  defaultLevelMusicAssignment,
  isSafeMusicRelativePath,
  normalizeLevelMusicAssignment,
  selectLiveMusicAssets,
  slugifyTrackName,
  upsertMusicAsset,
  validateLevelMusicModel,
  type MusicAssetRecord,
} from './levelMusicCore';

const SHA = 'a'.repeat(64);
const track: MusicAssetRecord = {
  id: 'coastal-assault-aaaaaaaaaaaa',
  displayName: 'Coastal Assault',
  fileName: 'Coastal Assault.mp3',
  relativePath: 'assets/audio/music/coastal-assault-aaaaaaaaaaaa.mp3',
  mimeType: 'audio/mpeg',
  byteLength: 123,
  sha256: SHA,
  source: 'suno',
  importedAt: '2026-07-25T00:00:00.000Z',
};

describe('level music core', () => {
  it('normalizes safe defaults and clamps numeric controls', () => {
    expect(defaultLevelMusicAssignment()).toEqual({
      trackId: null,
      loop: true,
      volume: 0.8,
      startOffsetSeconds: 0,
      fadeSeconds: 1,
    });
    expect(normalizeLevelMusicAssignment({ volume: 9, fadeSeconds: -2 })).toMatchObject({
      volume: 1,
      fadeSeconds: 0,
    });
  });

  it('creates stable safe IDs from filenames and hashes', () => {
    expect(slugifyTrackName('Pobřežní Útok.mp3')).toBe('pobrezni-utok');
    expect(createTrackId('Coastal Assault.mp3', SHA)).toBe(
      'music-aaaaaaaaaaaaaaaaaaaaaaaa',
    );
    expect(createTrackId('Renamed.mp3', SHA)).toBe(
      'music-aaaaaaaaaaaaaaaaaaaaaaaa',
    );
  });

  it('rejects traversal and non-MP3 paths', () => {
    expect(isSafeMusicRelativePath('assets/audio/music/track.mp3')).toBe(true);
    expect(isSafeMusicRelativePath('../track.mp3')).toBe(false);
    expect(isSafeMusicRelativePath('assets/audio/music/../../track.mp3')).toBe(false);
    expect(isSafeMusicRelativePath('assets/audio/music/track.wav')).toBe(false);
  });

  it('deduplicates by identity and returns deterministic ordering', () => {
    const registry = upsertMusicAsset(
      { formatVersion: LEVEL_MUSIC_FORMAT_VERSION, tracks: [track] },
      { ...track, displayName: 'Renamed' },
    );
    expect(registry.tracks).toHaveLength(1);
    expect(registry.tracks[0]?.displayName).toBe('Renamed');
  });

  it('collects references and includes only live exported tracks', () => {
    const ids = collectReferencedTrackIds([
      { ...defaultLevelMusicAssignment(), trackId: track.id },
      defaultLevelMusicAssignment(),
    ]);
    expect([...ids]).toEqual([track.id]);
    expect(
      selectLiveMusicAssets(
        { formatVersion: LEVEL_MUSIC_FORMAT_VERSION, tracks: [track] },
        [{ ...defaultLevelMusicAssignment(), trackId: track.id }],
      ),
    ).toEqual([track]);
  });

  it('reports missing track assignments without blocking silent levels', () => {
    const issues = validateLevelMusicModel(
      { formatVersion: LEVEL_MUSIC_FORMAT_VERSION, tracks: [track] },
      [
        { id: 'level_01', music: { trackId: track.id } },
        { id: 'level_02', music: { trackId: 'missing-track' } },
        { id: 'level_03', music: { trackId: null } },
      ],
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe('MISSING_TRACK');
  });
});
