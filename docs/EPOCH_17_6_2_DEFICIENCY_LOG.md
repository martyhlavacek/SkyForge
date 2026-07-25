# Epoch 17.6.2 Deficiency Log

## Summary

No Critical or High-severity deficiency was found in the AI-free cleanup.

## Medium

### DEF-17.6.2-01 — Browser suite remains uncertified

The unit, compiler, build, and package gates pass, but Chromium/WebKit Playwright execution still requires a browser-enabled CI or local environment.

**Recommended action:** make `npm run test:e2e` a required CI gate with installed Chromium and WebKit binaries.

### DEF-17.6.2-02 — Retired Foundry metadata is not preserved on re-save

The focused Asset Pack schema strips unknown legacy authoring keys. Older Asset Packs can still yield approved assets, tilesets, atlases, and resources, but retired briefs/jobs/candidates are discarded if the package is imported and saved again.

**Recommended action:** archive any old Foundry-era packages before converting them to the focused format. This is an intentional scope reduction, not a runtime defect.

## Existing architectural debt

- Level Studio still uses an iframe boundary instead of a direct shared project store.
- `AssetStudioWorkspace.tsx` remains oversized and should be divided by asset, tileset, atlas, and import responsibilities.
- `StudioRuntimeController` remains coupled to ordinary runtime boot paths.
- The workspace contract still requires a Music Pack even when a project intends silence or externally managed music.

## Informational

Historical documentation and changelog entries may mention the removed Foundry as project history. They are non-executable and do not add packages, network clients, credentials, or runtime behavior.
