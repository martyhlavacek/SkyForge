# Epoch 17 Internal Post-Implementation Review (Superseded)

> **Status notice:** This was an implementer-authored internal review, not an independent security audit. It is superseded for security conclusions by `INDEPENDENT_AUDIT_EPOCH_17.md` and the Epoch 17.2 remediation reports. In particular, the original Origin and package-safety claims were incomplete.

## Decision

**PASS WITH NON-BLOCKING FOLLOW-UPS.**

The implementation establishes a safe and coherent authoring boundary. It does not place provider credentials in the client, does not permit generated package content to execute code, and does not allow an image to become a production assignment without explicit processing, testing, approval, and transaction application.

## Architecture review

### Strengths

- Foundry records are additive to the existing Asset Pack rather than creating a fifth package type.
- Generation source, processed derivative, Asset Studio definition, gameplay behaviour, and level placement remain separate.
- Manual and API modes create the same lineage records.
- Cross-package assignment uses optimistic concurrency through the recorded previous value.
- Runtime preview uses the same Phaser bridge as other Studio systems.
- Production compilation naturally removes unused candidate resources.
- Git-folder mode exposes one stable JSON file per authoring record.

### Risks and mitigations

1. **Large base64 edit inputs** — limited by gateway request size and sixteen-reference cap.
2. **Credential exposure** — key exists only in the local Node process and environment.
3. **Prompt drift** — prompt-template version and exact compiled prompt are retained.
4. **Model drift** — model and optional snapshot metadata are retained.
5. **AI inconsistency** — master/reference lineage plus runtime approval is required.
6. **Accidental cross-package overwrite** — stale assignment proposals fail.
7. **Release bloat** — unused source/candidate resources are removed by compilation.
8. **Copyright/provenance risk** — prompts require original work and provenance remains mandatory; human review is still required.

## Security audit

- No API key in browser source, local storage, IndexedDB, package data, or checked examples.
- `.env.local` is ignored by the existing `*.local` rule.
- Local gateway binds to `127.0.0.1` by default.
- Origin allow-list enforced.
- JSON body limit enforced.
- Prompt length and candidate count constrained.
- Only PNG, WebP, and JPEG generation outputs accepted.
- Edit references restricted to HTTPS or image data URLs.
- External requests use a fixed OpenAI API host and fixed endpoint selection.
- No package-provided endpoint, script, HTML, plug-in, shell command, or executable URI is accepted.
- Returned images receive server-side SHA-256 and byte metadata and are verified again in package workflows.

## Performance review

- Asset Studio remains a separately loaded application chunk.
- Production build remains under configured JS and CSS budgets.
- Pixel processing occurs on explicit user action, not in the game loop.
- Large authored image packs remain in IndexedDB.
- Candidate source images do not enter production builds unless referenced.

Potential follow-up: move high-resolution processing to a Worker for very large masters or batch jobs.

## UX review

The full pipeline is visible as five stages. The primary remaining UX gaps are visual revision comparison, editable processing recipes in the Foundry panel, generation progress/streaming, job cancellation, and automatic opening of the linked asset in the conventional Asset subtab.

## Release recommendation

Proceed to controlled Canyon asset production. Do not mass-generate all campaign art until the first eight-asset vertical slice has been reviewed on desktop and physical iPhone hardware.
