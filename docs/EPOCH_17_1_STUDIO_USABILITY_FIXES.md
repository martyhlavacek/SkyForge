# Epoch 17.1 Studio Usability Fixes

## Reported defects

A physical desktop review identified two issues that were not exposed by the existing build and unit gates:

1. The Simulation Runtime dock could clip its controls and preview content at common desktop widths.
2. Painting in the embedded Level Studio was difficult or appeared non-responsive, particularly during drag gestures.

## Corrections

### Level Studio

- Pointer capture now owns a complete paint stroke from pointer-down through release.
- Painting no longer relies on the browser-specific `PointerEvent.buttons` value.
- Click and drag editing use the same scaled-canvas coordinate conversion.
- The hovered tile receives an explicit blue preview outline.
- The toolbar displays the active mode, layer, and material.
- A visible Erase action selects tile zero.
- Painting automatically reveals a hidden target layer.
- Layer and material selections are repaired when a different package is loaded.
- A short in-editor instruction explains that edits autosave and can be undone.

### Simulation Runtime

- The desktop dock now receives a responsive 460–620 px width.
- Controls and status fields wrap instead of overflowing.
- The iframe and empty state are constrained to the dock width.
- Expand mode temporarily gives the runtime the full Studio work area.
- Pop Out opens the runtime in a separate browser window.

## Regression checks

- Scaled map coordinates are unit-tested at center and boundary positions.
- Browser coverage verifies that an embedded map click enables Undo.
- Browser coverage verifies that the runtime dock has no horizontal overflow and that Expand/Restore controls work.

## Manual validation requested

1. Open `studio.html` and select Level.
2. Choose Paint, an unlocked visible layer, and a material.
3. Click and drag across the map; verify the blue hover outline and immediate map changes.
4. Use Undo and Erase.
5. Start the Simulation Runtime and confirm the complete portrait canvas is visible.
6. Test Expand, Restore Studio, and Pop Out.
