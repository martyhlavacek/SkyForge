# Skyforge Package Authoring and Collaboration Guide

**Schema:** Studio package schema v2  
**Applies to:** Epoch 16 and later

## 1. Collaboration model

Skyforge intentionally uses asynchronous collaboration first. Contributors exchange portable packages or work in unpacked Git folders. Real-time multi-user editing is not required for production and is deferred until package identity and conflict rules have matured.

The Level Pack may depend on the Tuning, Music and Asset Packs. Those three package types must not depend on a Level Pack. This keeps reusable balance, music and art independent from any campaign.

## 2. Package identity

A package is identified by:

```text
<type>:<manifest.id>@<manifest.version>#<manifest.contentRevision>
```

`version` communicates public compatibility. `contentRevision` changes whenever review metadata or content changes without requiring a semantic-version decision during active collaboration.

Stable content IDs are contractual references. Removing or renaming them is a breaking change unless a migration is supplied.

## 3. Schema migration

The Studio imports schema-v1 packages and workspaces and migrates them to schema v2 by adding:

- `manifest.contentRevision` with default `1`;
- `reviewComments` with an empty list;
- workspace `reviewComments` with an empty list.

Files using a schema newer than the running Studio are rejected. Migrations are one-way; contributors should keep the original file in source control when testing a migration.

## 4. Portable and unpacked formats

Portable formats remain JSON envelopes with custom extensions. Embedded binary resources use base64 and declared media type, byte count and SHA-256.

Unpacked folder mode separates each stable content item into its own JSON file. Binary resources are restored as ordinary files. `payload/index.json` records authored array order, allowing deterministic repacking without relying on filesystem order.

## 5. Dependency locks

`.sflock` records:

- workspace fingerprint;
- exact package type, ID and semantic version;
- package content revision;
- deterministic package fingerprint;
- resource IDs, byte counts and available SHA-256 values.

The lock is not a substitute for package validation. It is a reproducibility contract applied after validation.

## 6. Review and approval

Review comments live with the package so they survive file exchange and Git branches. Use:

- `note` for context;
- `suggestion` for non-blocking improvement;
- `blocking` for a release condition.

Comments should target the smallest useful JSON path. Resolve rather than delete a completed comment so the review history remains visible.

## 7. Production compilation

The production compiler:

1. validates the workspace and all packages;
2. verifies the dependency lock;
3. rejects unresolved blocking comments;
4. resolves live resources from package content;
5. removes declared but unused resources;
6. verifies byte count and SHA-256;
7. gives each copied resource a content-addressed target path;
8. writes sanitized runtime package JSON without embedded base64;
9. emits a deterministic release manifest.

The compiler currently preserves authored atlas metadata and copies compiled atlas resources. Pixel repacking remains an Asset Studio authoring operation so the same atlas is not regenerated differently at release time.

## 8. Conflict rules

- Stable IDs are merged by identity, not array position.
- `payload/index.json` resolves deliberate ordering.
- Two edits to the same stable item require human review.
- Binary-resource changes must include a new SHA-256.
- A semantic version must change when external references or compatibility change.
- Content revision must change for any accepted package edit.

## 9. Package checklist

Before sharing a package:

- schema validation passes;
- all internal references resolve;
- no unsafe URI scheme is present;
- imported resources have provenance and licensing;
- review comments accurately reflect unresolved issues;
- the package round-trips through folder mode;
- the workspace compiles with the current lock;
- the affected runtime/editor workflow was previewed.

## AI Asset Foundry collaboration records

Asset Packs may contain the following Git-friendly authoring groups:

```text
payload/asset-briefs/
payload/generation-jobs/
payload/candidates/
payload/processing-recipes/
payload/runtime-tests/
payload/assignment-proposals/
```

Reviewers should treat the brief and exact prompt as part of the asset change. Source candidates and processed derivatives are ordinary hashed resources. Do not delete rejected candidates that are needed to explain a revision history; the production compiler removes unreferenced resources from the game build.

Never commit `.env.local` or an API key. Collaborators use their own API credentials or the manual ChatGPT import path. Assignment proposals should be reviewed with the corresponding Tuning Pack change and dependency lock update.

## Epoch 17.2 package safety rules

Packages received from collaborators are untrusted until imported and validated. The folder CLI now enforces these rules:

- authored IDs use only letters, numbers, underscores, and hyphens;
- complete package schema and semantic validation occurs before output begins;
- every output path is contained below the requested target;
- resource filenames cannot traverse directories or collide after normalization;
- symbolic links are rejected while repacking;
- a non-empty target is never replaced without explicit `--force`.

Safe first import:

```bash
npm run studio:unpack -- contributor-pack.sfassetpack ./review/contributor-assets
```

Only after inspecting the target should an intentional replacement use:

```bash
npm run studio:unpack -- contributor-pack.sfassetpack ./review/contributor-assets --force
```

Do not bypass the Studio/CLI parser by manually extracting package JSON into production folders.
