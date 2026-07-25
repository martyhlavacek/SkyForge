# Level workspace integration

```tsx
import {
  LevelMusicPanel,
  importMp3File,
  readLevelMusic,
  upsertMusicAsset,
  writeLevelMusic,
} from '../features/levelMusic';

const { assignment } = readLevelMusic(selectedLevel);

<LevelMusicPanel
  tracks={musicRegistry.tracks}
  value={assignment}
  onChange={(next) => updateSelectedLevel((level) => writeLevelMusic(level, next))}
  onImportMp3={async (file) => {
    const imported = await importMp3File(file, { source: 'suno' });
    await persistMusicBytes(imported.record.relativePath, imported.bytes);
    setMusicRegistry((current) => upsertMusicAsset(current, imported.record));
    updateSelectedLevel((level) => writeLevelMusic(level, {
      ...readLevelMusic(level).assignment,
      trackId: imported.record.id,
    }));
  }}
  onPreview={(track, next) => previewLevelTrack(track, next)}
  onStopPreview={() => stopLevelTrackPreview()}
  onRevealFolder={electronBridge?.revealMusicFolder}
/>
```

Use the real immutable package mutation and history APIs in place of placeholder callback names above.
