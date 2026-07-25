# Epoch 17.6.2 — AI-Free Focused Studio Cleanup

## Purpose

Epoch 17.6.2 removes the remaining Asset Foundry data model after the authoring interface and provider gateway were removed in Epoch 17.6. It confirms that SkyForge has no AI-provider SDK or runtime dependency.

## Dependency result

The production dependency set remains Phaser, React, React DOM, and Zod. Development dependencies are build, lint, test, and TypeScript tooling. No OpenAI SDK, generic AI SDK, model client, agent framework, or provider package is installed.

## Code removed

- Asset brief and generation-operation schemas.
- Generation job and usage schemas.
- Candidate and processing-recipe schemas.
- Runtime-test and assignment-proposal schemas.
- Their semantic validation branches.
- Their Git-folder pack/unpack serialization paths.
- Their empty fields in built-in and example Asset Packs.

## Compatibility policy

Asset Packs now use the focused payload contract: `assets`, `tilesets`, and `atlases`. Zod strips unknown legacy keys during import, so old packages can still yield their approved runtime assets, but retired authoring lineage is not retained when re-saved.

## Unchanged

- PNG, WebP, and JPEG import.
- Asset definitions, frames, animations, pivots, shadows, tilesets, autotile mappings, and atlases.
- Runtime game rendering.
- Existing demonstration image bytes.
- Music package import and adaptive runtime playback.
