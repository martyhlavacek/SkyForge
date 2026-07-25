# Epoch 17 Implementation — AI Asset Foundry (Historical)

> **Epoch 17.2 status:** The package and gateway security model described here was subsequently hardened. Use `EPOCH_17_2_IMPLEMENTATION.md`, `EPOCH_17_2_SECURITY_REVIEW.md`, and `AI_ASSET_FOUNDRY.md` for current operating instructions. API-backed generation remains experimental until the opt-in live smoke test passes.

## Release outcome

Epoch 17 implements the governed artwork-generation workflow requested for Skyforge. The Asset Studio can now define an art brief, compile a model-ready prompt, call a secure local image gateway or import a ChatGPT-created image, preserve candidate lineage, create a non-destructive pixel derivative, test it in the real runtime, approve it, and assign it transactionally to tuning content.

## Implemented systems

- additive Asset Pack schemas for briefs, jobs, candidates, recipes, tests, and assignments;
- versioned Skyforge prompt compiler;
- category-specific prompt requirements and originality constraints;
- local Node image gateway using environment-only credentials;
- image generation and high-fidelity edit request contracts;
- candidate count, format, size, quality, background, and input validation;
- manual ChatGPT-output import using the same job lineage;
- source and derivative separation;
- matte removal, subject-bound cropping, alpha threshold, resize, and palette reduction;
- linked Asset Studio definitions with default collision and hardpoints;
- runtime preview and evidence records;
- approval gates and warnings;
- transactional enemy and equipment visual assignment;
- Git-folder serialization for all Foundry records;
- semantic validation of every Foundry reference;
- dead-resource elimination through the existing production compiler;
- built-in complete lineage example based on the demonstration fighter;
- responsive Foundry UI within the Asset workspace.

## How to test

### Manual mode

1. Run `npm run dev` and open `studio.html`.
2. Select **Assets**; the **foundry** subtab opens by default.
3. Edit or create a brief.
4. Copy the compiled prompt.
5. Generate an image in ChatGPT.
6. Select **Import ChatGPT output** and choose the downloaded PNG/WebP/JPEG.
7. Shortlist or mark it as master.
8. Select **Process to sprite**.
9. Preview the linked asset in the runtime.
10. Record a passing test and approve it.
11. Create and apply an assignment proposal.
12. Export the Asset Pack or unpack it with `studio:unpack`.

### Integrated API mode

```bash
cp .env.example .env.local
# Configure OPENAI_API_KEY in the environment.
npm run dev:foundry
```

Then select **Check gateway** and **Generate via local API**.

## Compatibility

The new fields are additive defaults under package schema v2. Existing Epoch 16 package files continue to parse. Asset folder round trips include all new record groups. Release compilation still includes only resources referenced by production asset definitions, tilesets, and atlases.

## Deferred work

- advanced palette libraries and clustering;
- source-image region editing and masks in the Studio;
- onion skinning and frame consistency heatmaps;
- automatic shadow derivation;
- generation queue persistence and cancellation;
- cost calculator integration;
- direct player hull, projectile, boss, pickup, and terrain assignment adapters;
- final Canyon production art.
