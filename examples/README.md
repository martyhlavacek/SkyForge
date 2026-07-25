# Skyforge Studio collaboration examples

This directory demonstrates the complete Epoch 16 collaboration and release workflow.

## `studio-packages/`

Portable package envelopes for all four content types, the selected workspace, its exact dependency lock, and an earlier compiled-content manifest.

## `studio-folder/`

The same four packages unpacked into Git-friendly folders. Authored items are separated by stable ID, ordering is recorded in `payload/index.json`, and embedded resources are ordinary files.

## `compiled-release/`

A production-compiler output created from the checked workspace and lock. It contains sanitized package JSON, the workspace and lock, content-addressed live resources, and `release-manifest.json`.

## Reproduce the example

```bash
npm run studio:example:compile
```

To unpack or repack an individual package:

```bash
npm run studio:unpack -- examples/studio-packages/skyforge-placeholder-assets-1.0.0.sfassetpack /tmp/assets
npm run studio:pack -- /tmp/assets /tmp/assets.sfassetpack
```
