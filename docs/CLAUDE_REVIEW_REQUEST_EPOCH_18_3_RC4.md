# Claude Adversarial Review Request — SkyForge Epoch 18.3 RC4

Review the complete application at annotated tag `epoch-18.3-rc4` in:

<https://github.com/martyhlavacek/SkyForge>

Resolve the tag to its commit and tree before testing. Compare it against both
`epoch-18.3-candidate` and `epoch-18.3-rc3`.

Primary prior-review evidence is checked in at:

- `docs/SKYFORGE-CR-0062_Epoch_18_3_Candidate_Verdict.md`
- `docs/SKYFORGE-CR-0063_RC3_REVIEW_SUMMARY.md`

The CR-0063 summary clearly identifies itself as a maintainer summary and links
the completed reviewer conversation. Do not treat it as the full
reviewer-authored artifact.

## Required RC4 rechecks

1. Build an input Music Pack containing one assigned imported MP3 and one
   unassigned imported MP3. Run the actual
   `scripts/compile-studio-release.mjs` path.
2. Confirm the assigned track metadata and bytes survive, the unused track and
   resource are removed, and `runtimeMusicCueIds` contains the assigned
   content-addressed ID.
3. Confirm authored cue URIs are rewritten to their content-addressed
   `resources/music/` targets.
4. Serve the compiled content alongside the application without `studio=1`.
   Confirm `BootScene` loads and semantically validates all four packages
   before `GameScene`, the imported track becomes a canonical one-stem
   MusicDirector cue, and the assigned MP3 decodes and plays after a genuine
   unlock gesture.
5. Confirm `ContentRegistry` rejects a `levelMusic.trackId` that is not present
   in the runtime music map.
6. Re-run the new `e2e/production-music.spec.ts` in Chromium and WebKit and
   confirm it exercises the non-Studio branch.
7. Confirm the mobile frame threshold is again greater than 20 frames over one
   second, the global Playwright timeout is 45 seconds, scenario timeouts were
   restored, and no replacement gate weakening was introduced.
8. Inject a TypeScript error and an ESLint error independently into each
   level-music TypeScript script. Confirm typecheck and lint fail.
9. Confirm `level-music:verify` is part of both `audit:release` and CI.
10. Re-run verifier cases for zero levels, malformed level JSON, invalid
    assignment, missing track, missing file, corrupt bytes, invalid MP3 header,
    duplicate identity/path, traversal, and symlink escape.
11. Reproduce the rejected-preview race: let preview A reject after preview B
    becomes active. Confirm only A is released and B remains active.
12. Confirm browser imports default to `external` provenance and claim Suno
    only when the source is explicitly supplied.
13. Confirm the unrelated `GameScene.update` player/body guard from RC2 is
    absent.
14. Re-run strict typecheck, ESLint, all 400 Vitest tests, both production
    builds, bundle budgets, portable-lock validation, example release
    compilation, level-music verification, the 20 Playwright executions, and
    `npm audit --audit-level=high`.
15. Audit the complete candidate-to-RC4 diff for undisclosed behavioral or gate
    changes, not just the files named above.

## Acceptance boundary

Do not grant release acceptance unless the production imported-MP3 path is
reachable in a non-Studio runtime and all automated claims reproduce from a
fresh clone.

Continue to name audible device output, Electron/macOS import and
reveal-folder behavior, and physical iOS Safari as manual gates unless you can
actually test them. Headless decode/playback API evidence must not be described
as audible hardware certification.
