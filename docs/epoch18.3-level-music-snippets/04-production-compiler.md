# Production compiler integration

```ts
const assignments = exportedLevels.map((level) => readLevelMusic(level).assignment);
const liveTracks = selectLiveMusicAssets(musicRegistry, assignments);

for (const track of liveTracks) {
  const bytes = await resourceStore.read(track.relativePath);
  assertByteLength(track, bytes);
  assertSha256(track, bytes);
  await compiler.copyResource(track.relativePath, bytes);
}
```

Emit manifest references:

```ts
{
  id: track.id,
  path: compiledPath,
  sha256: track.sha256,
  byteLength: track.byteLength,
  referredByLevels: exportedLevels
    .filter((level) => readLevelMusic(level).assignment.trackId === track.id)
    .map((level) => level.id)
    .sort(),
}
```

A missing or corrupt referenced MP3 blocks production compilation. Unused valid MP3s are reported and excluded.
