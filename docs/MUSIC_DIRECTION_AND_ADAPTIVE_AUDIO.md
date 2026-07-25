# Skyforge

> **Epoch 17.6 status:** Runtime adaptive music remains supported, but the in-Studio composer is deferred. Treat this as soundtrack direction and future-authoring reference.


## Music Direction and Adaptive Audio Addendum

**Document status:** Approved and implemented through Epoch 15  
**Applies to:** Core game, campaign, hangar, equipment economy, bosses, and level editor  
**Primary goal:** Establish an original musical identity rooted in 1990s DOS tracker and FM-synthesis aesthetics while supporting modern adaptive playback in a Phaser web game.

---

## 1. Purpose

This addendum defines the musical direction, asset format, runtime architecture, adaptive scoring rules, implementation milestones, and acceptance criteria for Skyforge.

The intended result is not an imitation of an existing soundtrack. Skyforge should instead use the broad production language associated with classic DOS shooters:

- memorable melodic hooks;
- limited and recognizable digital instrument palettes;
- tracker-like rhythmic sequencing;
- FM-style basses, bells, brass, and leads;
- short sampled drums and synthetic impacts;
- compact looping arrangements;
- distinct cues for missions, bosses, victory, failure, and the hangar;
- adaptive changes that respond to gameplay intensity without sounding random.

All music must remain original in melody, harmony, arrangement, samples, presets, and final audio.

---

## 2. Design objectives

The music system shall:

1. Give Skyforge a recognizable identity within the first ten seconds of a cue.
2. Support prolonged play without becoming fatiguing.
3. React to enemy pressure, boss phases, recovery windows, and mission state.
4. Maintain musical timing when layers are added, removed, paused, resumed, or transitioned.
5. Work reliably in desktop and mobile browsers.
6. Integrate with settings, pause flow, mission lifecycle, economy, and the editor.
7. Avoid coupling music logic directly to `GameScene`.
8. Support both finished stereo mixes and synchronized adaptive stems.
9. Permit deterministic testing of cue selection and transition logic.
10. Preserve source files and licensing records required for future releases.

---

## 3. Musical identity

### 3.1 Core aesthetic

Skyforge music should combine:

- DOS-era FM synthesis;
- tracker sequencing;
- compact sampled percussion;
- industrial science-fiction textures;
- strong minor-key motifs;
- energetic arpeggios;
- military urgency without orchestral pastiche;
- atmospheric contrast during recovery sections.

The score should sound digitally constructed rather than like a modern cinematic soundtrack with a retro filter applied afterward.

### 3.2 Voice budget

Each cue should generally use 8–12 clearly differentiated voices.

| Function      | Recommended character                                |
| ------------- | ---------------------------------------------------- |
| Bass          | Two-operator or four-operator FM bass                |
| Pulse         | Fast arpeggio or gated sequence                      |
| Harmony       | Digital pad, chord stab, or sampled texture          |
| Lead          | Bright FM lead with restrained vibrato               |
| Countermelody | Bell, pluck, or narrow pulse wave                    |
| Kick          | Short synthesized or tracker-style sample            |
| Snare         | Compact noise/snare sample                           |
| Hats          | Metallic short samples                               |
| Accent        | Orchestra hit, reverse cymbal, or synthetic impact   |
| Atmosphere    | Filtered noise, drone, or radio texture              |
| Boss layer    | Distorted bass, toms, metallic brass, or alarm pulse |

The arrangement should preserve space. Excessive layering will move the sound toward contemporary synthwave rather than a tracker/FM aesthetic.

### 3.3 Harmonic and melodic language

Preferred techniques:

- natural minor, harmonic minor, Dorian, and Phrygian colours;
- pedal tones beneath changing upper harmony;
- suspended fourths and minor-seventh sonorities;
- concise two- to four-bar motifs;
- chromatic approach tones;
- melodic sequences;
- octave doubling;
- bright countermelody against darker bass;
- rhythmic displacement of repeated motifs;
- arpeggiated harmony rather than dense sustained chords.

Every mission theme should contain at least one motif that can be transformed for the hangar, boss cue, victory sting, or campaign narrative.

### 3.4 Tempo

| Context                | Recommended tempo |
| ---------------------- | ----------------: |
| Hangar / equipment     |        88–112 BPM |
| Early mission          |       116–132 BPM |
| High-intensity mission |       128–148 BPM |
| Standard boss          |       136–156 BPM |
| Major boss phase       |       148–168 BPM |
| Story / debrief        |        72–100 BPM |

Most gameplay cues should remain in 4/4. Occasional 3+3+2 accents, half-time sections, or odd-length phrases may be used without changing the underlying meter.

---

## 4. Soundtrack structure

The initial soundtrack should include:

| Cue                | Function                                 |
| ------------------ | ---------------------------------------- |
| Main title         | Establishes the principal Skyforge motif |
| Hangar             | Equipment, purchasing, and configuration |
| Loadout test range | Rhythmic but non-threatening             |
| Mission 1          | Introductory action identity             |
| Mission 2          | Industrial escalation                    |
| Mission 3          | Atmospheric or orbital identity          |
| Standard boss      | Reusable high-intensity boss cue         |
| Major boss         | Unique multi-phase composition           |
| Mission complete   | 5–10 second resolved sting               |
| Mission failed     | Short restrained failure cue             |
| Debrief / story    | Lower-energy thematic variation          |
| Credits            | Expanded version of the principal motif  |

Each campaign region should have a distinct palette while retaining a common harmonic and melodic vocabulary.

---

## 5. Adaptive music model

Skyforge should use vertical layering and horizontal transitions.

### 5.1 Vertical layering

A mission cue is exported as synchronized stems of identical duration:

- `pulse`
- `drums`
- `harmony`
- `melody`
- `intensity`
- optional `atmosphere`

All stems shall:

- begin at the same sample position;
- use the same BPM and meter;
- use identical loop boundaries;
- use the same sample rate and channel layout;
- contain silence where a layer is inactive;
- avoid independent mastering limiters that change timing or phase;
- remain phase-aligned after pause and resume.

Suggested states:

| State    |                             Pulse | Drums | Harmony | Melody | Intensity |
| -------- | --------------------------------: | ----: | ------: | -----: | --------: |
| Recovery |                               45% |   20% |     70% |    35% |        0% |
| Normal   |                               75% |   65% |     75% |    55% |        0% |
| Combat   |                               90% |   90% |     80% |    75% |       35% |
| Critical |                              100% |  100% |     85% |    85% |       80% |
| Boss     | Dedicated cue or full layer state |       |         |        |           |

Layer changes should ramp over beats or bars rather than occur abruptly.

### 5.2 Horizontal transitions

The system should support:

- mission entry;
- normal combat;
- escalation;
- warning;
- boss introduction;
- boss loop;
- victory;
- defeat;
- hangar return.

Transitions should be scheduled at a beat or bar boundary. A boss may spawn at any time, but the score should wait for the next valid boundary, play a transition sting, and then enter the boss loop.

### 5.3 Intensity calculation

The soundtrack should not respond directly to every kill or projectile. A normalized target intensity should be derived from broad gameplay conditions:

```text
targetIntensity =
    activeEnemyWeight
  + projectileDensityWeight
  + eliteEnemyWeight
  + groundThreatWeight
  + encounterDifficultyWeight
  + bossPhaseWeight
  + playerDangerWeight
```

The value should be:

- clamped to `0.0–1.0`;
- smoothed over time;
- divided into broad bands;
- protected by hysteresis;
- required to remain in a band for a minimum dwell time before changing.

Recommended bands:

```text
0.00–0.24  recovery
0.25–0.49  normal
0.50–0.74  combat
0.75–1.00  critical
```

Recommended dwell time: 1.5–3 seconds.

The `MusicDirector` should receive intensity from a separate gameplay-intensity service. It should not calculate threat internally.

---

## 6. Runtime architecture

Music must be owned by a dedicated service rather than `GameScene`.

### 6.1 Responsibilities

`MusicDirector` shall:

- load cue metadata;
- start all synchronized stems at a shared audio-context time;
- maintain a single musical clock;
- set adaptive state;
- schedule transitions on beats or bars;
- pause and resume without losing synchronization;
- stop and unload mission-specific assets;
- expose current cue, bar, beat, and state for debugging;
- obey master, music, and mute settings;
- survive ordinary scene changes when appropriate;
- reset cleanly when a run is abandoned or restarted.

`AudioManager` shall continue to handle:

- sound effects;
- UI sounds;
- pickup tones;
- one-shot stingers that do not require musical scheduling;
- master audio settings.

### 6.2 Proposed interfaces

```ts
export type MusicIntensityState = 'recovery' | 'normal' | 'combat' | 'critical' | 'boss';

export interface MusicStemDefinition {
  id: string;
  assetKey: string;
  defaultGain: number;
}

export interface MusicCueDefinition {
  id: string;
  bpm: number;
  beatsPerBar: number;
  loopStartSeconds: number;
  loopEndSeconds: number;
  stems: MusicStemDefinition[];
  transitions?: {
    boss?: string;
    victory?: string;
    defeat?: string;
  };
}

export interface MusicDirector {
  playCue(cueId: string): Promise<void>;
  setIntensity(state: MusicIntensityState): void;
  setIntensityValue(value: number): void;
  scheduleTransition(cueId: string, timing: 'beat' | 'bar'): void;
  playStinger(stingerId: string): void;
  pause(): void;
  resume(): void;
  stop(fadeSeconds?: number): void;
  getDebugState(): MusicDebugState;
}
```

### 6.3 Cue metadata example

```json
{
  "id": "music_mission_01",
  "bpm": 128,
  "beatsPerBar": 4,
  "loopStartSeconds": 7.5,
  "loopEndSeconds": 67.5,
  "stems": [
    { "id": "pulse", "assetKey": "music_mission_01_pulse", "defaultGain": 0.8 },
    { "id": "drums", "assetKey": "music_mission_01_drums", "defaultGain": 0.75 },
    { "id": "harmony", "assetKey": "music_mission_01_harmony", "defaultGain": 0.7 },
    { "id": "melody", "assetKey": "music_mission_01_melody", "defaultGain": 0.65 },
    { "id": "intensity", "assetKey": "music_mission_01_intensity", "defaultGain": 0 }
  ],
  "transitions": {
    "boss": "music_boss_standard",
    "victory": "sting_mission_complete",
    "defeat": "sting_mission_failed"
  }
}
```

### 6.4 Level reference

```json
{
  "id": "level_01",
  "music": {
    "mainCue": "music_mission_01",
    "bossCue": "music_boss_standard",
    "victoryStinger": "sting_mission_complete",
    "failureStinger": "sting_mission_failed"
  }
}
```

Level definitions should reference cue IDs only. They should not contain file paths or individual stem automation.

---

## 7. Browser and mobile requirements

### 7.1 Audio unlock

Audio initialization must occur after a valid user gesture such as pressing Start, tapping the screen, or pressing a controller button after focus.

The game shall display a recoverable state when the browser suspends the Web Audio context.

### 7.2 Shared scheduling

All stems must be scheduled using the same Web Audio context and shared start time. Sequential independent `play()` calls are not sufficient for reliable alignment.

### 7.3 Pause and background handling

The system shall define behaviour for:

- game pause;
- browser tab hidden;
- mobile app backgrounded;
- audio context suspended;
- settings opened during a paused run;
- checkpoint restart;
- return to hangar;
- full run abandonment.

On resume, stems must remain aligned. If precise resume is unavailable, restart the cue at the next valid bar boundary rather than allow drift.

---

## 8. File formats and mastering

### 8.1 Archive

Retain:

- Renoise, tracker, MIDI, or DAW projects;
- synth presets;
- source samples;
- sample licences;
- unprocessed stem renders;
- final mastered stems;
- full stereo mixes;
- loop metadata;
- cue manifests;
- ownership or commissioning documents.

### 8.2 Runtime delivery

Recommended:

- OGG Vorbis or Opus for tested browsers;
- a tested fallback where needed;
- WAV only for short effects or development diagnostics;
- identical encoding settings across synchronized stems.

Suggested source archive:

```text
48 kHz
stereo
24-bit or 32-bit float
```

Compressed loops must be tested for encoder padding.

### 8.3 Loudness

Initial target:

```text
Integrated loudness: approximately -16 to -14 LUFS
True peak: no higher than -1 dBTP
```

Final values should be selected after balancing music against weapons, explosions, pickups, and UI.

---

## 9. Economy and hangar integration

Music should reinforce the mission-and-purchase loop.

### 9.1 Hangar cue

The hangar should use a slower or reharmonized form of the campaign motif. It should communicate preparation, technological possibility, accumulated wealth, anticipation, and safety without complete relaxation.

### 9.2 Transaction feedback

| Event                  | Response                                    |
| ---------------------- | ------------------------------------------- |
| Currency pickup        | Quiet pitched confirmation                  |
| Rapid currency chain   | Notes cycle through a chord or scale        |
| Purchase accepted      | Short ascending flourish                    |
| Sale accepted          | Short neutral confirmation                  |
| Upgrade installed      | Strong resolved flourish                    |
| Insufficient credits   | Muted descending response                   |
| Invalid configuration  | Distinct non-musical warning                |
| New equipment unlocked | Short thematic fanfare                      |
| Mission payout         | Count-up layer synchronized with results UI |

Rapid pickup tones should rotate through a consonant note set so repeated collection creates an arpeggio. Example in D minor:

```text
D → F → A → C → D
```

The sequence should reset after a short period without collection.

### 9.3 Mission settlement

The results screen should synchronize:

- mission-complete sting;
- base reward;
- destruction bonus;
- collected currency;
- repair deductions;
- total payout;
- newly affordable equipment.

The soundtrack must not imply provisional in-mission currency has become permanent before checkpoint or mission settlement rules commit it.

---

## 10. Level editor integration

The future Level Composer should support:

- selecting main and boss cues;
- previewing stems;
- displaying BPM and a bar grid;
- placing transition markers;
- previewing intensity bands;
- auditioning a boss transition from any timeline position;
- validating cue IDs and loop metadata;
- showing music events beside encounters and scroll changes.

Music events should remain high level:

```text
set music state: recovery
set music state: combat
schedule boss transition
play stinger
return to mission cue
```

Raw stem automation should be reserved for an advanced mode.

---

## 11. Debugging and telemetry

### 11.1 Debug overlay

Display:

- current cue ID;
- musical time;
- bar and beat;
- current intensity value and band;
- active stem gains;
- pending transition;
- audio-context state;
- measured stem drift;
- current loop iteration.

### 11.2 Telemetry

Development telemetry may record:

- cue start and stop;
- transition reason;
- time spent in intensity states;
- number of state changes;
- boss transition latency;
- pause and resume success;
- audio-context suspension;
- stem desynchronization;
- missing asset or definition errors.

---

## 12. Production workflow

1. Receive the level concept, pacing map, encounter intensity map, and visual reference.
2. Establish BPM, key, motif, and voice palette.
3. Compose a complete looping cue.
4. Divide it into synchronized stems.
5. Create boss transition and required stingers.
6. Export uncompressed review mixes.
7. Test loops and transitions in a standalone harness.
8. Encode runtime assets.
9. Test desktop and iPhone browsers.
10. archive source, stems, metadata, and licensing records.

Suggested naming:

```text
music/
  mission_01/
    mission_01_full.ogg
    mission_01_pulse.ogg
    mission_01_drums.ogg
    mission_01_harmony.ogg
    mission_01_melody.ogg
    mission_01_intensity.ogg
    mission_01_manifest.json
  boss_standard/
    boss_standard_full.ogg
    boss_standard_drums.ogg
    boss_standard_harmony.ogg
    boss_standard_melody.ogg
    boss_standard_manifest.json
  stingers/
    mission_complete.ogg
    mission_failed.ogg
    equipment_unlock.ogg
```

### Originality requirement

The project may reference the broad category of tracker/FM DOS music, but must not reproduce recognizable melodies, distinctive arrangements, proprietary samples, extracted game audio, or recordings from another game.

Every commissioned cue should include a representation that the work is original and commercially licensed.

---

## 13. Initial musical vertical slice

Before commissioning a full soundtrack, build:

- one 2–3 minute mission composition;
- four or five synchronized stems;
- one boss transition;
- one 30–45 second boss loop;
- one victory sting;
- one failure sting;
- one 60–90 second hangar cue;
- a currency pickup note family;
- purchase, sale, upgrade, and insufficient-credit sounds.

This slice must validate:

- sample-accurate stem start;
- seamless looping;
- bar-aligned transitions;
- pause and resume;
- browser audio unlock;
- iPhone playback;
- settings persistence;
- checkpoint and game-over lifecycle;
- music/SFX balance;
- adaptive-state stability;
- loading and memory usage.

---

## 14. Roadmap placement

### Epoch 9R — Audio lifecycle and music foundation — implemented

Completed in the current project:

- reliable user-gesture AudioContext creation;
- Pause → Settings → active run preservation;
- restart, checkpoint, and scene-shutdown cleanup;
- persistent category volumes;
- cue schemas and content validation;
- shared-clock `MusicDirector`;
- synchronized stem playback;
- intensity state machine with hysteresis and dwell time;
- music debug overlay and automated pure-model tests;
- one original 60-second four-stem demonstration cue.

Physical iPhone/controller QA remains an external release check because it cannot be completed by source-level automation alone.

### Epoch 10 parallel soundtrack workstream

Epoch 10 is primarily the ship configuration, credits, equipment, economy, and progression epoch. Music work during that epoch should focus on integration with the new loop rather than replacing its core implementation:

- final or near-final Mission 1 arrangement;
- dedicated standard boss cue;
- bar-aligned boss transition;
- victory and failure stings;
- hangar theme derived from the campaign motif;
- currency, purchase, sale, upgrade, unlock, and insufficient-credit feedback;
- browser and physical-device QA.

### Later epochs

- region-specific palettes;
- multi-phase boss music;
- thematic transformations;
- editor music timeline;
- soundtrack album exports;
- accessibility controls for intensity and dynamic range.

---

## 15. Acceptance criteria

The adaptive music milestone is complete only when:

1. All stems begin from one shared scheduled context time.
2. Stem drift remains inaudible during a ten-minute loop test.
3. Loops are seamless in every supported browser.
4. Music starts only after a valid user gesture.
5. Pause and resume do not desynchronize stems.
6. Opening Settings from Pause returns to the same run.
7. Checkpoint restart stops or restores the correct cue exactly once.
8. Boss music is scheduled on a beat or bar boundary.
9. Intensity changes use smoothing, dwell time, and hysteresis.
10. Cue and stem definitions are validated.
11. Missing audio produces a recoverable error.
12. Master, music, and mute settings persist.
13. Keyboard, touch, and gamepad entry flows work.
14. The mission-to-hangar economy loop uses appropriate musical feedback.
15. Tests cover cue selection, transitions, pause, resume, restart, and cleanup.
16. The vertical slice is tested on desktop and iPhone.
17. All music and samples have documented ownership or licensing.
18. No final cue reproduces protected music or recordings.

---

## 16. Deliverables

- approved design addendum;
- cue schemas and TypeScript types;
- runtime `MusicDirector`;
- manifest validation;
- adaptive-state integration;
- debug and telemetry support;
- one full musical vertical slice;
- synchronized stems;
- boss transition and loop;
- economy feedback sounds;
- source project and preset archive;
- licensing register;
- automated tests;
- device QA record.

---

## 17. Final recommendation

Use offline tracker-style composition and FM/sample synthesis as the musical source, then ship synchronized compressed stems controlled by a dedicated adaptive `MusicDirector`.

Direct procedural synthesis or tracker-module playback may be explored later, but should not complicate the first production implementation. The immediate objective is a reliable, original soundtrack system that strengthens pacing, bosses, and the currency-to-hangar progression loop across desktop and mobile browsers.

---

## Game Design Studio music-package boundary

Epoch 12 introduces `.sfmusic` as the collaboration and source-metadata boundary for the Music Studio.

A Music Pack contains:

- validated runtime cue definitions;
- declared rendered audio resources;
- adaptive stem metadata;
- FM and sample instrument definitions;
- tracker composition metadata, order, patterns, and notes;
- authorship, licensing, and dependency metadata.

The Epoch 12 workspace can audition the rendered full mix, inspect stems and FM instruments, edit cue/source BPM metadata, and export/import the package. Changing source BPM metadata does not time-stretch existing rendered stems. The full pattern editor, instrument synthesis, rendering, loop analysis, and level-synchronized composition workflow remain Epoch 15 work.

Imported resources must use relative or HTTP(S) URIs and must be declared in the package resource manifest. Executable URI schemes are rejected.


## 18. Epoch 15 Music Studio implementation

Epoch 15 implements the editable music-source layer: a tracker pattern/order editor, simplified two-operator FM instruments, sample resource metadata, adaptive stem routing and gains, transition targets, runtime synchronization, deterministic rendering, WAV packaging, and loop-boundary analysis.

The `.sfmusic` package preserves tracker/instrument source and declared rendered resources. The game consumes cue definitions and rendered audio through `MusicDirector`; it does not depend on the React editor or synthesize tracker voices during gameplay.

The deterministic renderer covers FM instruments, tracker timing, supported effects, channel gain/pan, stem routing, and WAV output. It does not decode imported sample instruments. A render reports that omission and preserves the resource. Production sample rendering and worker-based long renders are Epoch 16 work.

The Studio measures absolute loop-end/start discontinuity for both channels and reports the maximum. Authors must listen and correct high-discontinuity loops. Automatic crossfades are not applied because they may alter transient character. Re-test after compressed-codec conversion.

Imported WAV, OGG, MP3, and M4A resources are data-only and may be embedded. The Studio verifies media type, base64, byte count, and declared SHA-256. Generated WAV resources include byte counts; the production compiler must add final hashes.

## 19. Epoch 16 production and collaboration workflow

Music Packs now participate in the locked production pipeline rather than being copied directly from the Studio workspace.

For collaborative authoring:

1. unpack the `.sfmusic` package into Git folder mode;
2. edit tracker source, instruments, cues, transition metadata, and declared resources as stable-ID files;
3. retain rendered audio as ordinary files under the package resource folder;
4. create or refresh the workspace dependency lock after review;
5. compile the release through the production compiler.

The compiler includes only audio resources referenced by the selected Music Pack, verifies declared byte counts and SHA-256 values where available, calculates a hash for every compiled resource, removes embedded base64 from release JSON, and rewrites each live resource to a content-addressed output path. Unreferenced renders are reported as dead resources and excluded from the release.

Open blocking review comments prevent release compilation. This makes incomplete licensing, unresolved loop defects, missing stems, and unapproved mixes enforceable collaboration gates rather than informal notes.

The Epoch 15 deterministic FM renderer remains the authoring renderer. Epoch 16 does not change synthesis results or silently re-render music during release compilation. Imported sample-instrument decoding, worker-based long renders, automatic crossfades, and physical-device audio QA remain explicit post-foundation hardening items.
