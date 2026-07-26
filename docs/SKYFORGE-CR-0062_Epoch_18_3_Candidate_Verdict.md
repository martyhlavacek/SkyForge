# SKYFORGE-CR-0062 — Adversarial Review: Epoch 18.3 Rebuilt Candidate

**Reviewer:** Claude (independent auditor)
**Date:** 25 July 2026
**Supersedes:** SKYFORGE-CR-0061 (review of the implementation kit)

## Bound artifact

| Field | Value |
|---|---|
| Repository | `github.com/martyhlavacek/SkyForge` |
| Commit | `a8bcf055b4111124608e840aca0ab06d3b4dd2a0` |
| Tree | `24a7e09eaeeccfba0614d14aa9e412db0ebe591d` |
| Tag | `epoch-18.3-candidate` → `a8bcf055` (annotated, resolves to HEAD) |
| Version | `skyforge@0.10.3` |
| Obtained by | fresh `git clone --depth 1` into a clean container |

This verdict is bound to that commit and no other artifact.

---

# Verdict: ACCEPT WITH REQUIRED FIXES

**Release acceptance is explicitly withheld** pending the manual browser and device checks below — your own review request forbids granting it without real-MP3 playback testing, and I have no audio device or browser in this environment. I performed the fresh-clone build half of that condition; you must perform the playback half.

CR-0061's REJECT is superseded. That rejection rested on two grounds, and both are now resolved: a bindable artifact exists, and three of the five P0 defects have been fixed correctly. The remaining defects are real but none of them block integration.

---

## Gate results — all reproduced from scratch

| Gate | Result |
|---|---|
| `npm ci` (from committed lockfile) | **PASS** — 202 packages, 11s, no mirror rewrites |
| `npm run lock:portable` | **PASS** |
| `npm run typecheck` | **PASS** — clean |
| `npm run lint` | **PASS** — zero findings |
| `npm test` | **PASS** — **382/382** across 56 files |
| `npm run build` | **PASS** |
| `npm run build:budget` | **PASS** — `"failures": []` |
| `npm run build:base:verify` | **PASS** — `/skyforge/` resources verified |
| `npm run studio:example:compile` | **PASS** — 11 resources, fingerprint `fnv1a-689cb8c5` |
| `npm run terrain:verify` | **PASS** — canyon textures + Blob-47 geometry |
| `npm run level-music:verify` | **PASS** — 3 level files, 0 issues |
| `npm run docs:evidence` | **PASS** — 382 tests / 56 files / 14 E2E |
| `npm audit --audit-level=high` | **FAIL** — 2 high (see CF-21) |

**Review priority 8 — are the verification report's automated claims reproducible?** Yes. `EPOCH_18_3_VERIFICATION_REPORT.md` claims 382 tests across 56 files, passing budgets, and level-music verification over three level files. All three reproduce exactly on a clean clone. Given this project's history of bundled reports overstating coverage, that is worth stating plainly: this one is accurate.

---

## CR-0061 findings — disposition

### Fixed, and fixed correctly

**CF-3 / CF-9 — track identity.** `createTrackId` is now content-addressed: `music-${sha256.slice(0, 24)}`, filename ignored. This is precisely the right fix and it resolves both findings at once. Re-import under a different name is now idempotent rather than destructive, and the generated ID always satisfies `SAFE_ID` and the host's `SafeIdSchema`. A new test asserts two different filenames with identical bytes produce the same ID — the exact regression probe that was missing.

**CF-6 — parallel audio lifecycle.** Resolved by taking the recommended path rather than the shipped one. `GameScene.ts:335` routes level music through `music.playCue(trackId, 'normal', startOffsetSeconds, { loop, volume, fadeSeconds })` — the canonical `MusicDirector`, which uses `decodeAudioData`, `GainNode`, and `linearRampToValueAtTime` for sample-accurate fades. No `HTMLAudioElement` in the runtime path, no `Date.now()` fade loop. This was the most consequential finding in CR-0061 and the integration did the right thing.

**CF-10 — strict typecheck.** Fixed by copying into a fresh `Uint8Array` before `crypto.subtle.digest`. `tsc --noEmit` is clean.

**CF-11 — React in the game bundle.** Non-issue as integrated. Game code imports `LevelMusicPanel` and `levelMusicCore` directly rather than through the barrel, and Vite splits `studio-music` into its own 2.3 kB chunk. Budgets pass.

**CF-17 (partial)** — `JSX.Element` → `ReactElement`.

**CF-5** — moot; the installer is not part of the candidate.

### Still open

**CF-19 → now P0: the ID fix reached one implementation, not both.**

This is the finding that matters most. `scripts/import-level-music.mjs` is **byte-identical to the kit** and still generates filename-derived IDs. The TypeScript path generates content-addressed IDs. The same MP3 now yields:

```text
CLI import  ->  coastal-assault-aaaaaaaaaaaa
UI  import  ->  music-aaaaaaaaaaaaaaaaaaaaaaaa
```

Two IDs, two files on disk, two registry rows, for one piece of audio. Both pass `SafeIdSchema`, so nothing catches it. Worse, the CLI path still carries the original CF-3 defect verbatim — its dedupe filter is unchanged, so a CLI re-import under a new filename still silently orphans every level referencing the old ID.

The `.mjs` / `.ts` divergence has been flagged in three prior audits as a structural risk. This is the first time I can show it actually diverging in shipped code, and it diverged *because a fix was applied to one side only*. The remediation pattern the project already established — route everything through a single CLI that calls the canonical TypeScript modules — should be applied here. `scripts/import-level-music.mjs` should import `createTrackId` and `upsertMusicAsset` from `src/features/levelMusic/levelMusicCore.ts` (via `tsx`, as `studio-folder.ts` already does) rather than reimplementing them.

**CF-1 / CF-2 — defective module shipped as dead code.** `Mp3MusicRuntime.ts` is byte-identical to the kit, so both lifecycle defects are intact: the orphaned-unstoppable-player race and the `stop()`-during-load no-op. Severity drops sharply because **nothing imports it** — the only references are its own declarations and the barrel `export *`. Studio preview uses an inline `HTMLAudioElement` in `FocusedStudioWorkspaces.tsx` instead.

But shipping 164 lines of known-defective audio lifecycle code, exported from the public barrel, with docs (`EPOCH_18_3_HOST_INTEGRATION.md:41`) still recommending it for preview, is an invitation. Either delete it or fix it. Do not leave it as a trap for the next epoch.

**CF-4 — verifier still passes vacuously.** `verify-level-music-assets.mjs` is byte-identical. It found 3 level files here so it happened to work, but `levelFilesChecked: 0` still yields `status: PASS` / exit 0. Fail closed on zero levels and on unparseable level JSON.

**CF-8 — symlink path traversal.** Byte-identical. `resolveContained` is still lexical; a symlink inside the project still escapes it. Use `realpath` in both scripts.

**CF-7 — dead validation branch.** Still present at `levelMusicCore.ts:212–226`. `INVALID_ASSIGNMENT` remains unreachable because normalisation clamps before validation runs. Validate raw, then normalise.

**CF-14, CF-15, CF-16, CF-18, CF-20** — unchanged; all P2, none blocking.

### New

**CF-21 — `npm run audit:release` is currently red.** Two high-severity advisories in transitive dev dependencies: `brace-expansion` (DoS via unbounded expansion) and `postcss` (path traversal in source-map auto-loading). Both are dev-time only and neither reaches the shipped bundle, but `audit:release` terminates in `npm audit --audit-level=high`, so your own release gate fails. `npm audit fix` resolves both.

**CF-22 — Studio preview bypasses the audio bus.** `FocusedStudioWorkspaces.tsx:170` constructs a bare `HTMLAudioElement` from an object URL. Object URLs *are* revoked on stop and on unmount (`:75`, `:79`) — that part is handled correctly. But preview volume comes straight from `assignment.volume`, ignoring the user's master and music settings, so a preview can be far louder than gameplay. Acceptable for authoring; worth a follow-up.

**CF-23 — no automated coverage of the music runtime path.** `MusicDirector.test.ts` has 4 tests, none exercising a single-track MP3 cue. No E2E scenario touches music (`e2e/` contains only `smoke.spec.ts` and `device.spec.ts`). The entire Epoch 18.3 runtime contract — unlock gate, loop, offset, fade, pause/resume, checkpoint restore, transition, shutdown — rests on manual verification alone.

---

## Required before release acceptance

**P0**

1. **CF-19** — make `import-level-music.mjs` consume the canonical TypeScript modules. Until then, document the CLI as unsafe to mix with UI import.

**P1**

2. **CF-1/CF-2** — delete `Mp3MusicRuntime.ts` (and its barrel export and doc references), or fix both lifecycle defects.
3. **CF-4** — verifier fails closed on zero levels / unparseable JSON.
4. **CF-8** — `realpath` containment in both `.mjs` scripts.
5. **CF-7** — validate raw assignment values.
6. **CF-21** — `npm audit fix`; get `audit:release` green.
7. **CF-23** — add a `MusicDirector` single-track test and one E2E music scenario.

**Manual, mandatory — I cannot perform these**

8. Real-MP3 playback in Chromium and WebKit from a fresh-clone build.
9. **Start offset on iOS Safari.** Highest-risk item. Verify a non-zero `startOffsetSeconds` actually applies; the Web Audio `start(0, offset)` path should be correct, but WebKit is where this breaks.
10. Audio unlock gate — nothing audible before a genuine user gesture.
11. Rapid level transitions and repeated checkpoint retries — listen for overlapping music.
12. Quit-to-menu during level load — listen for leaked playback.
13. Electron/macOS import; confirm no absolute source path persists anywhere in the project; reveal-folder resolves only the configured music directory.
14. Editor restart — assignment and bytes survive.
15. Missing-file case — editor warns, level still loads, runtime continues silently.
16. Production export with one referenced and one unused MP3 — verify exactly one ships.

---

## Assessment

The integration is better than the kit it came from. The two decisions that mattered — content-addressed identity, and routing runtime playback through `MusicDirector`'s Web Audio path instead of the bundled `HTMLAudioElement` reference implementation — were both made correctly, and they were the two I'd have argued hardest for. Every automated gate reproduces green on a clean clone, and the verification report's claims are accurate, which has not always been true here.

The residual risk is concentrated in one place: the `.mjs` scripts were carried over verbatim while the TypeScript beside them was fixed. That is the third audit in which the dual-implementation pattern has surfaced, and the first in which it has actually produced divergent behaviour. Worth treating as a standing invariant to check rather than a bug to patch.
