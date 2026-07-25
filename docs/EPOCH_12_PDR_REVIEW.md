# Epoch 12 PDR Review — Game Design Studio

**Review status:** Approved with scoped revisions  
**Date:** 2026-07-12

## Review conclusion

The proposed four-workspace Game Design Studio is coherent and should replace the prior Epoch 12 plan that focused narrowly on asset-pipeline hardening.

The architecture is approved subject to these decisions:

1. **Four independent package contracts are authoritative.** Levels, tuning, music, and assets remain separately versioned and exportable.
2. **The Level Pack is the integration package.** It references stable IDs from tuning, music, and asset packages.
3. **The optional workspace file is a lock, not a fifth content package.** It identifies the four active versions and current level.
4. **Epoch 12 uses JSON package envelopes.** ZIP transport and Git folder mode are compatible future representations, not separate schemas.
5. **Packages contain no executable code.** This is required for safe collaboration.
6. **The actual game runtime is embedded.** The Studio must never evolve a separate simulation implementation.
7. **Epoch 12 establishes foundations, not four complete authoring suites.** Live tuning is Epoch 13, production asset tooling is Epoch 14, tracker composition is Epoch 15, and collaboration hardening is Epoch 16.
8. **The existing Epoch 11 Level Studio remains functional.** It is embedded and connected through an export/import bridge rather than rewritten during the foundation milestone.

## Risks reviewed

### Risk: four packages become tightly coupled

Mitigation: one-way dependencies, stable IDs, semantic versions, and compiler validation.

### Risk: custom files are difficult to collaborate on

Mitigation: JSON envelopes in Epoch 12, deterministic formatting, later unpacked folder mode.

### Risk: untrusted packages execute content

Mitigation: data-only schemas, no script or plug-in fields, validation before activation.

### Risk: Studio preview diverges from production

Mitigation: embed the same Phaser runtime and control it through a narrow message bridge.

### Risk: scope becomes larger than the game

Mitigation: staged epochs with a usable release gate after each specialist workspace.

### Risk: binary music and art make JSON packages huge

Mitigation: Epoch 12 packages reference declared resources. Packed portable resources are deferred until provenance, hashing, and compiler behaviour are stable.

## Approved Epoch 12 acceptance contract

- Four package schemas and custom extensions
- Package import/export
- Package manifests and dependency ranges
- Workspace lock and local persistence
- Dependency resolution and cycle detection
- Deterministic content compiler and report
- Game Design Studio shell
- Embedded Level Studio
- Unsaved Level Studio capture into `.sflevelpack`
- Loaded Level Pack transfer into Level Studio
- Foundational tuning editing and `.sftuning` export
- Music cue/instrument preview and `.sfmusic` export
- Asset metadata/shadow preview and `.sfassetpack` export
- Shared runtime start, pause, resume, restart, seek, and state reporting
- Updated PDR, roadmap, README, changelog, tests, and verification report

## Deferred by design

- Live tuning application without restart
- Deterministic state snapshots and arbitrary video-style scrub reconstruction
- Full sprite import, animation authoring, and atlas packing
- Full tracker note editor and audio rendering
- ZIP package transport
- Unpacked Git project mode
- Real-time multi-user editing
- Production build resource copying and dead-asset elimination
