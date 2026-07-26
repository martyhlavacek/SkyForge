import { describe, expect, it } from 'vitest';
import {
  defaultLevelMusicAssignment,
  readLevelMusic,
  writeLevelMusic,
} from './index';

describe('level music host contract', () => {
  it('reads levelMusic while preserving the legacy cue string', () => {
    const level = {
      id: 'level_01',
      music: 'coastal_assault',
      levelMusic: { trackId: 'music-abc', volume: 0.4 },
    };
    const result = readLevelMusic(level);
    expect(result.assignment).toMatchObject({
      trackId: 'music-abc',
      volume: 0.4,
    });
    expect(result.level.music).toBe('coastal_assault');
  });

  it('writes only levelMusic and never replaces the cue string', () => {
    const level = { id: 'level_01', music: 'coastal_assault' };
    const result = writeLevelMusic(level, {
      ...defaultLevelMusicAssignment(),
      trackId: 'music-abc',
    });
    expect(result.music).toBe('coastal_assault');
    expect(result.levelMusic).toMatchObject({ trackId: 'music-abc' });
  });
});
