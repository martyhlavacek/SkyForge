# Runtime integration

Preferred: add a single-track branch to the canonical `MusicDirector` so all audio remains on the existing music bus and lifecycle.

```ts
const assignment = normalizeLevelMusicAssignment(level.levelMusic);
const track = findAssignedTrack(compiledMusicRegistry, assignment);

if (!track) {
  if (assignment.trackId) telemetry.recoverableAudioError('missing-level-track', assignment.trackId);
  await musicDirector.stop(assignment.fadeSeconds);
} else {
  await musicDirector.playSingleTrack({
    track,
    loop: assignment.loop,
    volume: assignment.volume,
    startOffsetSeconds: assignment.startOffsetSeconds,
    fadeSeconds: assignment.fadeSeconds,
  });
}
```

Required cleanup paths:

- level transition;
- restart;
- checkpoint restore;
- abandon run;
- scene shutdown;
- Studio preview restore.

Never create a second unmanaged HTML audio player beside an active `MusicDirector` instance.
