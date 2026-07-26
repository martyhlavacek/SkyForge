# Claude Adversarial Review Request — SkyForge Epoch 18.3 RC3

Review the complete application at annotated tag `epoch-18.3-rc3`. Compare it
against `epoch-18.3-candidate` and the findings in SKYFORGE-CR-0062.

## Required rechecks

1. Confirm `music` remains a string and all MP3 assignment paths use
   `levelMusic`.
2. Confirm UI and CLI imports produce the same content-addressed ID and one
   registry/resource identity for renamed identical bytes.
3. Confirm the UI actually executes extension, size, MIME, MP3-header, SHA-256,
   safe-path, and deduplication checks.
4. Confirm CLI import produces a `LevelSchema`-valid level and preserves the
   adaptive cue string.
5. Confirm verification fails on zero levels, malformed levels, invalid
   assignments, missing tracks, corrupt bytes, and symlink escapes.
6. Confirm the defective `Mp3MusicRuntime` and its public export/documentation
   references are absent.
7. Confirm Studio preview stops and revokes exactly the active object URL
   without a React effect cleanup race.
8. Confirm MusicDirector coverage exercises unlock deferral, loop, volume,
   offset, fade, pause/resume, and stop.
9. Re-run every release gate, including `npm audit --audit-level=high`.
10. Run the real-MP3 Chromium/WebKit scenario and identify any remaining manual
    macOS, Electron, or iOS checks.
11. Confirm the embedded Studio runtime reaches `GameScene`, reports schema-valid
    snapshot IDs, and does not regress to the menu during preload.
12. Confirm responsive Studio, runtime-dock containment, and mobile touch tests
    pass in the complete browser matrix.
13. Confirm Studio applies the Music Pack before the active level assignment and
    the real MP3 reaches MusicDirector after a genuine iframe user gesture.
14. Confirm production compilation includes the assigned MP3 resource and
    excludes an otherwise identical unused-library case.
15. Confirm WebKit audio-volume assertions use numeric tolerance while playback,
    pause, and rejection state remain exact.

Do not grant release acceptance unless the reviewed tag and its fresh-clone
artifact are reproducible and the remaining manual gates are explicitly named.
