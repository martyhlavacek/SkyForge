# Skyforge Epoch 15 Implementation

**Version:** 0.6.0  
**Date:** 2026-07-12  
**Milestone:** Tracker/FM Music Studio

## Outcome

Epoch 15 converts the Game Design Studio's music metadata view into an editable tracker/FM composition environment. Authors can create and arrange tracker patterns, design FM and sample instruments, route channels into adaptive stems, synchronize the composition with the embedded game runtime, render deterministic WAV output, analyse loop boundaries, and export a portable `.sfmusic` package containing editable source and runtime resources.

The implementation is a focused game-music tool rather than a general-purpose DAW.

## Delivered systems

### Tracker source and arrangement

A composition owns BPM, meter, rows per beat, swing, master gain, ordered patterns, loop order, channels, stem routing, gain, pan, mute/solo state, and row events. Row events contain note, instrument, velocity, duration, and one of six tracker effects: none, slide up, slide down, vibrato, retrigger, or cut.

The UI includes a pattern grid, order list, cell inspector, row quantization, stable IDs, and semantic reference validation.

### FM and sample instruments

FM instruments expose waveform, carrier/modulator ratios, modulation index, feedback, detune, vibrato, ADSR, gain, and pan. An on-screen chromatic keyboard supports audition and note entry.

Sample instruments preserve resource ID, root note, loop, gain, pan, attack, and release. WAV, OGG, MP3, and M4A imports record byte count, SHA-256, embedded data, source, author, tool, timestamp, licence, and notes.

The deterministic renderer does not yet decode sample instruments. It preserves them and reports the omission rather than silently dropping source data.

### Deterministic render engine

`MusicStudioEngine` converts pattern order into scheduled events, applies swing and effects, synthesizes FM voices, renders synchronized stereo stems and a full mix, writes PCM WAV files, embeds output into a Music Pack, and measures loop-boundary discontinuity.

The same package and render settings produce stable timing and PCM output.

### Adaptive score authoring

Authors can route channels to stems; preview recovery, normal, combat, critical, and boss states; tune per-state stem gains; set boss, victory, and defeat transitions; and preview the package through the shared game runtime.

### Runtime synchronization

The Studio can scrub its playhead, synchronize it to the current level position, apply a transient Music Pack overlay inside the game iframe, preview a cue from an offset and adaptive state, and restore canonical runtime music.

### Storage and resource integrity

Audio-bearing working Music Packs use IndexedDB. Local storage keeps only a lightweight shell. Imports validate media type, safe URI, base64, byte count, SHA-256 when declared, and internal cue/sample references.

### Built-in demonstration source

Coastal Assault now includes editable drums, bass, arpeggio, and lead channels; FM kick, snare, hat, bass, arpeggio, and lead instruments; four harmonic patterns; swing; tracker effects; and adaptive stem routing. The checked-in collaboration example uses the Epoch 15 schema.

## Primary files

```text
src/studio/music/MusicStudioWorkspace.tsx
src/studio/music/MusicStudioEngine.ts
src/studio/music/MusicPreviewPlayer.ts
src/studio/music/MusicPackageStorage.ts
src/studio/music/MusicResourceTools.ts
src/game/systems/StudioMusicOverlay.ts
src/game/systems/MusicDirector.ts
src/schemas/studioPackageSchema.ts
src/schemas/musicSchema.ts
```

## Authoring workflow

1. Select or create a composition.
2. Configure tempo, row resolution, swing, order, and loop range.
3. Create FM instruments or import sample resources.
4. Enter notes and effects into patterns.
5. Route channels into stems.
6. Tune adaptive-state gains and cue transitions.
7. Synchronize and preview against the embedded runtime.
8. Render stems and full mix.
9. Inspect loop discontinuity.
10. Embed approved resources and export `.sfmusic`.

## Automated coverage

Epoch 15 adds tests for note conversion, deterministic scheduling, synchronized stems, WAV encoding, render embedding, loop analysis, invalid music references, base64 conversion, and audio byte-count/SHA validation. The complete suite continues to cover all previous gameplay and Studio systems.

## Known limitations

1. FM synthesis is simplified and is not hardware-accurate OPL2/OPL3 emulation.
2. Sample instruments are preserved but not decoded by the deterministic renderer.
3. Loop discontinuity is reported but automatic crossfading is not applied.
4. Music-specific undo/redo, MIDI input, render workers, and progress/cancellation are not implemented.
5. JSON packages can become large when WAV resources are embedded.
6. Generated resources carry byte counts; final production compilation should add SHA-256 to every render.
7. Mobile audio requires a valid user gesture and physical-device QA.

Epoch 16 resolved folder transport, package locks, release hashing, dead-resource removal, review gates, and device-test configuration. Deterministic sample decoding, Music-specific undo/redo, MIDI, render workers, and automatic loop repair remain optional post-foundation extensions.

## Tester checklist

- [ ] Load Coastal Assault and play/scrub the arrangement.
- [ ] Edit note, instrument, velocity, duration, and effect values.
- [ ] Quantize a pattern.
- [ ] Edit and audition an FM instrument.
- [ ] Import a supported audio resource.
- [ ] Route, mute, and solo channels.
- [ ] Tune all five adaptive states and transitions.
- [ ] Preview from a synchronized runtime offset.
- [ ] Render WAV output and inspect loop analysis.
- [ ] Embed renders, export, reload, re-import, and compile the workspace.
