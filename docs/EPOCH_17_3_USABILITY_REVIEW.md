# Skyforge Epoch 17.3 — Internal Usability Review

**Review type:** Implementer usability review  
**Date:** 2026-07-13

## Review outcome

**PASS for production-level usability testing.**

Epoch 17.3 directly addresses the highest-impact interaction deficiencies identified through hands-on use and comparison with established editors: canvas dominance, safe selection, direct manipulation, gesture-level undo, standard navigation, visual materials, contextual inspection and lane-based sequencing.

## Findings closed

| Prior deficiency | Resolution |
|---|---|
| Map canvas constrained by fixed sidebars | Both docks collapse; runtime can be hidden |
| No safe selection tool | Select is now the default tool |
| Object clicks moved nearest object | Geometric hit-testing selects only the object under the pointer |
| Drag stroke generated many undo entries | Local gesture transaction commits once on release |
| Row and zoom sliders were primary navigation | Wheel pan, Space-drag, modifier zoom, minimap and jump controls added |
| Materials were number-first | Searchable visual material swatches and recent palette added |
| Inspector always showed analysis | Explicit Selection, Layer and Analysis contexts added |
| All overlays appeared simultaneously | Overlays are mode-sensitive with opt-in All Overlays |
| Timeline was only a sorted list | Semantic lanes, playhead and event dragging added |
| Embedded editor duplicated controls | Embedded toolbar is compact and parent runtime is hideable |

## Risks reviewed

### Data integrity

The Level Package schema and project serialization were not changed. Edits continue to use structured clones and the existing autosave/export path.

### Undo integrity

Pointer gestures use a local working project. The parent history receives only the final gesture state. A component regression test verifies a three-cell drag emits one project commit.

### Object movement safety

The prior nearest-worldY behavior was removed. Object selection now requires the pointer to be inside the object rectangle. Overlapping objects resolve to the visually last object.

### Accessibility and discoverability

Buttons retain text titles, the canvas remains keyboard-focusable and shortcuts are documented in the help strip and manual. Full screen-reader authoring remains out of scope for a graphical map editor, but controls and status text are labelled.

### Mobile use

The editor remains desktop-first. Narrow layouts collapse the resource and inspector panels and hide the minimap. Mobile runtime preview remains supported, but full map authoring is not promoted as a phone workflow.

## Open usability debt

- No marquee selection or copy/paste.
- No stamps/prefabs.
- No line or rectangle tools.
- Timeline durations other than recovery are not resizable.
- Layer ordering still uses buttons instead of drag-and-drop.
- No user-configurable shortcut map.
- No production user study has yet measured task completion time.

## Recommended validation study

Ask at least two users unfamiliar with the implementation to complete:

1. paint and erase a canyon wall;
2. select and move a gate;
3. modify a collision corridor;
4. add and retime an encounter;
5. validate and export a Level Pack.

Record completion time, wrong-tool errors, undo count, help requests and a 1–5 ease score. Use the results to prioritize stamps/prefabs, selection regions and validation quick-fixes.
