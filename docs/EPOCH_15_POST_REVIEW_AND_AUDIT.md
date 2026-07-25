# Skyforge Epoch 15 Post-Epoch Review and Audit

**Version reviewed:** 0.6.0  
**Date:** 2026-07-12  
**Outcome:** Pass with documented production-hardening items

## Executive assessment

Epoch 15 meets its intended milestone. It adds a useful game-music workflow without duplicating the runtime engine or attempting to become a full DAW. Editable tracker source is separated from rendered runtime audio; pure services own scheduling and synthesis; preview uses a transient validated package overlay; audio resources use IndexedDB; and package imports remain data-only.

No release-blocking defect was identified.

## Architecture review

### Separation of responsibilities — Pass

`MusicStudioWorkspace` owns authoring UI. `MusicStudioEngine` owns scheduling, synthesis, rendering, and loop analysis. `MusicPreviewPlayer` owns browser audition. `MusicPackageStorage` owns IndexedDB. `StudioMusicOverlay` owns transient runtime application.

### Package boundary — Pass

The Music Pack owns cues, adaptive gains, transitions, instruments, compositions, resources, provenance, and licensing. Level Packs reference cue IDs. The game consumes rendered audio and does not require the tracker editor.

### Runtime integration — Pass

The iframe receives validated data-only commands. Applying a Music Pack does not mutate host package data permanently. Cue offset and initial adaptive state are supported through the production `MusicDirector`.

### Determinism — Pass for FM source

Tracker scheduling and FM rendering are deterministic. Sample decoding is outside the current deterministic boundary and generates an explicit warning.

## Security audit

- Packages contain declarative JSON and base64 resources only.
- Executable URI schemes are rejected.
- Audio media types are allow-listed.
- Embedded data, byte count, and optional SHA-256 are verified.
- Large package data uses IndexedDB instead of fragile local-storage quotas.
- No `eval`, dynamic script loading, plug-in execution, or imported HTML is used.
- The dependency audit reports zero known vulnerabilities at the configured level.

Generated WAVs do not yet always receive immediate SHA-256 values; Epoch 16 must hash every compiled artifact.

## Performance audit

The offline renderer does not run in the Phaser update loop, so ordinary gameplay receives no continuous synthesis cost. Long compositions can allocate substantial PCM arrays. Epoch 16 should add render workers, progress, cancellation, memory estimates, and configurable output quality.

The main Phaser bundle retains the existing Vite large-chunk advisory. Code splitting remains a production-hardening item.

## UX review

Strengths include the direct tracker grid, FM audition keyboard, adaptive-state preview, runtime synchronization, loop analysis, and built-in editable source.

Recommended improvements:

- Music-specific undo/redo;
- copy/paste and multi-cell selection;
- pattern cloning and drag/reorder;
- bar/beat rulers;
- sample waveform preview;
- optional short loop crossfade;
- render progress/cancellation;
- MIDI import and hardware input.

None is a release blocker for the foundation milestone.

## Findings

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| M15-01 | Medium | Deterministic render omits sample decoding | Preserve and warn; Epoch 16/later |
| M15-02 | Low | FM model is not hardware-accurate OPL | Intentional product choice |
| M15-03 | Low | Generated renders lack guaranteed immediate SHA | Epoch 16 compiler |
| M15-04 | Low | No Music-specific undo/redo | Epoch 16 UX hardening |
| M15-05 | Low | No MIDI import/hardware input | Optional later extension |
| M15-06 | Low | Loop analysis does not auto-crossfade | Later enhancement |
| M15-07 | Low | Embedded WAV enlarges JSON packages | Epoch 16 packed/folder transport |
| M15-08 | Informational | Main bundle retains large-chunk advisory | Epoch 16 code splitting |

## Release decision

Epoch 15 is approved to proceed to Epoch 16. The authoring contract is complete, prior boundaries remain intact, automated coverage is present, and the known limitations do not silently corrupt source data.
