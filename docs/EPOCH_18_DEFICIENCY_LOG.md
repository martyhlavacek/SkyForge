# Epoch 18 Deficiency Log

No Critical or High-severity defect was found by the executable non-browser release gates.

## Medium

### E18-M1 — Browser rendering is not certified

The audit environment did not contain Playwright Chromium or WebKit binaries. CanvasTexture compositing and the final in-game visual result have strong structural and pixel-level evidence, but no automated browser assertion was completed.

**Next action:** make desktop Chromium, mobile Chromium, and mobile WebKit mandatory CI gates with fixed-distance screenshots.

### E18-M2 — Chunk CanvasTextures require device profiling

The continuous sandstone system creates temporary 544×512 CanvasTextures for visible chunks and removes them as chunks unload. This is materially cleaner than thousands of repeated sprites, but memory allocation and texture-upload behaviour have not been measured on low-memory phones or integrated GPUs.

**Next action:** record live texture count, peak GPU/JS memory, chunk creation time, and frame-time spikes on target devices.

### E18-M3 — Set dressing is generator-owned rather than editor-authored

Rocks, cracks, scrub, sediment, and landmarks are deterministic and stored as normal layers, but the current Level Studio does not expose biome-aware placement rules or density controls.

**Next action:** add decoration palettes, exclusion zones, density controls, deterministic reseeding, and manual lock/preserve operations.

### E18-M4 — Landmark artwork remains demonstration quality

The ruins and platform clusters improve environmental readability, but they do not yet approach the bespoke installations and large set pieces used by the benchmark games.

**Next action:** author a coherent canyon landmark kit with bridges, docks, pipes, ruins, bases, and destructible ground-target variants.

## Low

### E18-L1 — Shoreline geometry is limited by the 17-column grid

Blob-47 provides correct topology, but the 32-pixel, 17-column map still produces visible stepped macro-contours at some bends.

**Next action:** evaluate a 16-pixel logical shoreline grid, spline-to-mask rasterization, or larger handcrafted macro-stamps while retaining the 32-pixel runtime atlas.

### E18-L2 — Water animation is frame-based

The quieter water is substantially improved, but three global frames can still become familiar over a long mission.

**Next action:** add low-amplitude UV drift, sparse independent highlight overlays, or a longer animation cycle without increasing visual noise.

### E18-L3 — Terrain collision remains intentionally dormant

The environment is presentation-only by design. Collision schemas remain as non-blocking compatibility documents.

**Next action:** reconsider terrain interaction only after movement, combat readability, and level-authoring requirements are stable.
