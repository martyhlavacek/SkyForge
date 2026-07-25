# SkyForge Epoch 18.3 — Per-Level MP3 Music

## Decision

Add a simple external-track workflow to the Level workspace. A designer can import a finished MP3—especially a Suno export—into a project-local music folder, select it for a level, preview it, and configure loop, volume, start offset, and fade.

The removed tracker/FM composer stays removed. This feature is assignment and asset management, not music composition.

## Architectural fit

Epoch 17.6 retained runtime adaptive playback, `.sfmusic` validation, music-package persistence, and production compilation while removing composition UI. Epoch 18.3 uses those retained boundaries:

- **Level package:** owns the per-level playback assignment.
- **Music resources:** own MP3 bytes and provenance metadata.
- **Level workspace:** owns import, selection, preview, and validation UI.
- **Audio runtime:** owns playback lifecycle and category volume.
- **Production compiler:** includes referenced tracks and drops unused tracks.
- **Folder project:** persists assets at stable relative paths.

## Data model

```ts
interface LevelMusicAssignment {
  trackId: string | null;
  loop: boolean;
  volume: number;             // 0..1
  startOffsetSeconds: number; // >= 0
  fadeSeconds: number;        // 0..10
}
```

```ts
interface MusicAssetRecord {
  id: string;
  displayName: string;
  fileName: string;
  relativePath: string;       // assets/audio/music/<id>.mp3
  mimeType: 'audio/mpeg';
  byteLength: number;
  sha256: string;
  durationSeconds?: number;
  source: 'suno' | 'external';
  importedAt: string;
}
```

Legacy cue fields may remain beside the new fields during migration. The editor must not delete `mainCue`, `bossCue`, victory, or defeat fields simply because a single-track assignment is edited.

## User workflow

1. Open a level.
2. Open **Level music**.
3. Select **Import MP3**.
4. Choose a Suno download.
5. The app validates the extension, MIME type, size, recognizable MP3 header, safe path, byte count, and SHA-256.
6. The MP3 is copied into the project-local music folder.
7. The new track becomes selected for the active level.
8. Preview and adjust volume, loop, start offset, or fade.
9. Save/export the level package.
10. The compiler includes the selected track when it is reachable from an exported level.

## Failure policy

- Missing assigned music must never prevent a level from loading.
- The editor and compiler report a clear missing-track error.
- Runtime logs a recoverable audio error and continues silently.
- Path traversal, executable URI schemes, mismatched hashes, and oversized imports fail closed.
- Removing a referenced track requires either reassignment or an explicit confirmation that leaves a validation error.

## Runtime policy

- Playback begins only after the existing audio-unlock/user-gesture gate.
- The selected level track uses the existing master/music volume controls.
- A level transition fades the previous track before starting the next.
- Pause/resume preserves position.
- Restart/checkpoint restoration must not create duplicate players.
- `No music` is an explicit supported state.

## Export policy

A production release contains only track records reachable from exported levels. Every included MP3 must match its declared SHA-256 and byte count. The release manifest records track ID, source package, relative path, hash, byte length, and referring level IDs.

## Acceptance criteria

1. Import accepts a valid MP3 and rejects non-MP3 input.
2. Imported bytes are copied to a stable project-local path.
3. SHA-256 and byte count verify immediately after copy.
4. Track selection persists through editor restart.
5. `No music` persists and plays silently.
6. Preview play/stop works after audio unlock.
7. Volume, loop, offset, and fade are saved per level.
8. Missing assigned files produce visible validation without blocking editor load.
9. Runtime missing-file failure is recoverable.
10. Switching levels does not overlap duplicate music players.
11. Pause/resume and checkpoint restart preserve correct lifecycle.
12. Export includes used MP3s and excludes unused MP3s.
13. Export fails when a referenced MP3 hash or byte count is invalid.
14. Existing `.sfmusic` packages and legacy cue fields remain compatible.
15. Existing gameplay, Blob-47 terrain, and Studio tests remain green.

## Roadmap update

Treat Epoch 18.3 as a narrow Level Studio usability increment:

- external MP3 import and project-local persistence;
- per-level track assignment;
- preview and playback controls;
- compiler reachability and validation;
- no composition tools;
- no Suno API dependency;
- no cloud account integration.

Future scope may add boss overrides, stingers, playlists, loop-region editing, loudness normalization, and OGG conversion. None is required for initial acceptance.
