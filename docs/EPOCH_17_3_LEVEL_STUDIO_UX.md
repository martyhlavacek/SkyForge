# Skyforge Epoch 17.3 — Level Studio UX Redesign

**Status:** Implemented  
**Project version:** 0.8.3  
**Date:** 2026-07-13

## Purpose

Epoch 17.3 reorganizes the existing Level Studio around common creative-tool conventions. It does not change the Level Package v2 data contract. The goal is to make the existing terrain, collision, route, object, analysis, timeline and preview capabilities practical for repeated production use.

## Implemented interaction model

### Canvas-first workspace

- The map canvas is the dominant central surface.
- Resource and inspector docks may be collapsed independently.
- The Simulation Runtime can be hidden from the parent Studio toolbar when maximum map width is needed.
- Embedded mode suppresses duplicate export and navigation controls.

### Tool rail and shortcuts

| Tool | Shortcut |
|---|---|
| Select | `V` |
| Paint | `B` |
| Terrain/autotile | `T` |
| Erase | `E` |
| Collision | `C` |
| Routes | `R` |
| Objects | `O` |
| Analysis | `A` |
| Fill visible viewport | `G` |
| Fit/default view | `F` |

Select is the default non-destructive mode.

### Direct object manipulation

- Objects are selected by rectangle hit-testing rather than nearest-world-row heuristics.
- Hover and selected outlines make the active object explicit.
- Only the selected object moves during a drag.
- Clicking empty space clears the object selection and selects the map cell instead.
- Gate and barrier dimensions and gameplay fields may be edited in the contextual inspector.

### Stroke transactions

A continuous pointer gesture is accumulated in a local working copy and committed once on pointer release. Painting, collision editing, route editing and object dragging therefore create one undo entry per gesture rather than one per cell or sample.

### Navigation

- Mouse wheel pans vertically.
- Space-drag pans.
- Ctrl, Command or Alt plus wheel changes zoom.
- Start, End, Page Up, Page Down and Fit controls are available.
- A full-height minimap shows terrain, dynamic objects, event markers and the current viewport.
- The minimap supports click-and-drag navigation.

### Material browser

- Searchable visual swatches replace number-first material buttons.
- Material name, tile ID, collision role and animation status are visible.
- Recently used materials are retained in a short palette.
- Alt-click or right-click samples the active-layer tile under the pointer.

### Layer workflow

- The active layer is visually emphasized.
- Visibility, lock, solo and ordering controls remain available.
- Inactive layers are dimmed to keep the active layer readable.
- The Layer inspector exposes opacity and summary data.

### Contextual inspector

The right dock has three explicit tabs:

- **Selection** — selected object or map cell;
- **Layer** — active layer properties;
- **Analysis** — route and terrain-pressure results.

Route issues containing world coordinates include a Go To action that centers the map near the problem.

### Mode-sensitive overlays

Collision, navigation-envelope, route and object overlays are shown only when relevant to the active mode. An All Overlays toggle remains available for advanced review.

### Timeline

The timeline workspace now includes semantic lanes for:

- encounters;
- terrain state;
- flow/recovery;
- checkpoints.

Events can be selected and dragged to new times at 0.5-second precision. A playhead and timeline zoom control are included. The existing event list and detailed inspector remain available below the lane view.

## Files added

- `src/editor/LevelMinimap.tsx`
- `src/editor/TimelineEditor.tsx`
- `src/editor/LevelMinimap.test.ts`
- `src/editor/SpatialComposer.component.test.tsx`

## Files substantially updated

- `src/editor/SpatialComposer.tsx`
- `src/editor/MapViewport.tsx`
- `src/editor/EditorApp.tsx`
- `src/editor/editor.css`
- `src/studio/StudioApp.tsx`
- `src/studio/studio.css`
- `e2e/smoke.spec.ts`

## Preserved boundaries

- Level Package v2 remains unchanged.
- Existing autosave, validation, import/export and Studio capture messages remain compatible.
- The secured Epoch 17.2 package and Foundry boundaries remain unchanged.
- Runtime preview remains the actual Phaser runtime rather than a separate editor simulation.

## Remaining UX work

The following are useful next-stage improvements but were not required to establish the new interaction foundation:

- rectangular and line painting;
- marquee selection and copy/paste;
- saved multi-tile stamps and parameterized prefabs;
- drag-and-drop layer reordering and grouping;
- comment pins and spatial review notes;
- validation quick-fixes;
- live hot reload and play-from-selection;
- configurable shortcut remapping;
- a visual side-by-side Level Pack diff.

## Tester checklist

1. Open `/studio.html`, select Level and hide the runtime.
2. Press `B`, paint a multi-cell stroke and verify one Undo reverses the whole stroke.
3. Press `E` and erase cells.
4. Alt-click or right-click an existing tile and verify the material changes.
5. Use the wheel, Space-drag and minimap to navigate.
6. Press `V`, select a gate or barrier and drag it.
7. Edit object dimensions in Selection inspector.
8. Toggle collision, route and analysis modes and verify irrelevant overlays disappear.
9. Open Timeline and drag an event to a new time.
10. Capture the working copy in the parent Studio and export the Level Pack.
