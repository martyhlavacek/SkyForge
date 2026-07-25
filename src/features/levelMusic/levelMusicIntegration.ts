import {
  defaultLevelMusicAssignment,
  normalizeLevelMusicAssignment,
  type LevelMusicAssignment,
  type MusicAssetRecord,
  type MusicAssetRegistry,
} from './levelMusicCore';

export interface LevelLike {
  id: string;
  music?: Record<string, unknown> | null;
}

export interface LevelMusicHostValue {
  level: LevelLike;
  assignment: LevelMusicAssignment;
}

/**
 * Reads the Epoch 18-compatible level object without discarding legacy cue fields.
 * New single-track fields live alongside mainCue/bossCue/stingers during migration.
 */
export function readLevelMusic(level: LevelLike): LevelMusicHostValue {
  const raw = level.music ?? {};
  return {
    level,
    assignment: normalizeLevelMusicAssignment({
      trackId: typeof raw.trackId === 'string' ? raw.trackId : null,
      loop: typeof raw.loop === 'boolean' ? raw.loop : undefined,
      volume: typeof raw.volume === 'number' ? raw.volume : undefined,
      startOffsetSeconds:
        typeof raw.startOffsetSeconds === 'number' ? raw.startOffsetSeconds : undefined,
      fadeSeconds: typeof raw.fadeSeconds === 'number' ? raw.fadeSeconds : undefined,
    }),
  };
}

export function writeLevelMusic(
  level: LevelLike,
  assignment: Partial<LevelMusicAssignment> | null,
): LevelLike {
  const current = level.music ?? {};
  const normalized = assignment
    ? normalizeLevelMusicAssignment(assignment)
    : defaultLevelMusicAssignment();

  return {
    ...level,
    music: {
      ...current,
      ...normalized,
    },
  };
}

export function findAssignedTrack(
  registry: MusicAssetRegistry,
  assignment: LevelMusicAssignment,
): MusicAssetRecord | null {
  if (!assignment.trackId) return null;
  return registry.tracks.find((track) => track.id === assignment.trackId) ?? null;
}
