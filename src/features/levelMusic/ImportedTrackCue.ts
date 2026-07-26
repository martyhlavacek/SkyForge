import type { MusicCueDef } from '../../schemas/musicSchema';

export interface ImportedTrackCueSource {
  id: string;
  displayName: string;
  durationSeconds?: number;
}

const UNITY_GAINS = {
  recovery: 1,
  normal: 1,
  combat: 1,
  critical: 1,
  boss: 1,
} as const;

/**
 * Converts a verified imported MP3 into the canonical one-stem cue consumed by
 * MusicDirector. Studio preview and compiled production content use this same
 * representation.
 */
export function importedTrackCue(
  track: ImportedTrackCueSource,
  asset: string,
): MusicCueDef {
  return {
    id: track.id,
    displayName: track.displayName,
    bpm: 120,
    beatsPerBar: 4,
    loopStartSeconds: 0,
    loopEndSeconds: track.durationSeconds ?? 86_400,
    fullMix: asset,
    stems: [
      {
        id: 'full-mix',
        asset,
        defaultGain: 1,
        gains: { ...UNITY_GAINS },
      },
    ],
    transitions: {},
  };
}
