# Skyforge Epoch 16 Post-Epoch Review and Audit

**Version reviewed:** 0.7.0  
**Date:** 2026-07-12  
**Outcome:** Pass with limited post-roadmap hardening items

## Executive assessment

Epoch 16 satisfies the planned collaboration and production-compiler milestone. The four package formats now have a migration path, reproducible dependency locks, Git-friendly folder projects, review gates, deterministic release-resource processing, campaign-scale assembly examples, build budgets and a cross-browser test matrix.

No release-blocking architecture, security, dependency or data-integrity defect was identified during the review.

## Architecture audit

### Package/compiler separation — Pass

Migration, lock, folder transport, review and production compilation are pure services independent of React. The Studio UI invokes these services but does not own package semantics.

### Runtime/editor separation — Pass

Production compilation operates on package data and resources. It does not boot Phaser or depend on the editor runtime. Preview overlays remain transient and separate from release output.

### Stable identity — Pass

Unpacked content uses one stable-ID file per object. Authored order is explicit in `payload/index.json`. Package version, content revision and lock fingerprint serve different purposes and are not conflated.

### Migration boundary — Pass

The v1-to-v2 migration is explicit and one-way. Newer schemas are rejected. Migration does not rewrite stable IDs or reinterpret gameplay values.

### Compiler determinism — Pass with timestamp qualification

For fixed workspace, packages, lock and `generatedAt`, compiler planning and resource paths are deterministic. Release timestamps intentionally vary unless supplied by a build system.

## Security audit

- Package and workspace input remains declarative JSON.
- No executable plugins, imported HTML, `eval`, dynamic script loading or URI execution was introduced.
- Unsafe URI schemes continue to be rejected by schema validation.
- Embedded resources are decoded only as declared binary media.
- Production compilation verifies bytes and SHA-256 when declared, then hashes every output.
- Content-addressed target paths are sanitized and cannot preserve directory traversal.
- Unpacked-folder tooling sanitizes binary filenames and writes under the selected output root.
- Blocking comments cannot be bypassed by ordinary production compilation.
- Dependency audit reports zero known high-severity vulnerabilities.

### Security finding

The standalone Node folder CLI is a trusted developer tool and performs structural conversion rather than full Zod semantic validation. Repacked output is validated when imported or compiled. A future convenience improvement could expose the TypeScript schema validator directly to Node without duplicating logic.

## Data-integrity audit

- Lock drift detects package content, version, revision and resource-metadata changes.
- Folder-mode binary resources round-trip with original base64 content.
- Array order is independent of filesystem ordering.
- Production compiler rejects hash and byte-count mismatches.
- Dead resources are reported instead of silently retained.
- Compiled package JSON removes embedded binary data and rewrites resource URIs to hashed paths.
- Review comments remain part of the package fingerprint and collaboration history.

## Performance audit

Manual Vite chunking separates the large Phaser dependency from application and Studio workspaces. The release build is below all configured budgets. The Phaser vendor chunk remains the largest asset, as expected, but it no longer obscures application-bundle regressions.

Production compilation currently loads each resource into memory while hashing. This is acceptable for the present package sizes. Very large future packs should use streaming hashes and worker-based compilation.

## Browser/device audit

The test matrix now covers desktop Chromium, mobile Chromium and mobile WebKit profiles. Browser automation remains limited to simulated device profiles. Physical-device validation is required for:

- Safari audio unlock and background resume;
- Bluetooth route changes;
- thermal throttling;
- controller pairing and mapping;
- touch latency;
- IndexedDB quota behaviour.

## UX audit

Strengths:

- lock export and production compilation are visible in the Build workspace;
- package revisions and open-comment counts are visible per package;
- comments can be added and resolved without editing JSON;
- release compiler explains live and removed resources;
- CLI commands are shown directly in the Studio;
- collaboration examples are immediately available.

Remaining UX opportunities:

- package history browser;
- visual side-by-side diff rather than Markdown-only diff;
- multi-author identity settings instead of the current default author;
- Git status integration;
- ZIP export convenience;
- release-progress display and cancellation for very large packs.

## Findings

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| E16-01 | Low | Node folder CLI performs conversion without Zod semantic validation | Output is validated on import/compile; future shared Node validator |
| E16-02 | Low | Compiler hashes resources in memory | Acceptable now; stream/worker for very large packs |
| E16-03 | Low | No automatic three-way merge | Intentional; stable-ID folder model and human review |
| E16-04 | Low | No ZIP package transport | Folder and JSON transport complete; ZIP is convenience only |
| E16-05 | Informational | Phaser remains a large vendor chunk | Isolated and within explicit budget |
| E16-06 | Informational | Mobile automation is emulated, not physical | Manual QA matrix supplied |
| E16-07 | Informational | Built-in review author defaults to Marty | Add user identity preference later |

## Release decision

Epoch 16 is approved. It completes the planned Epoch 12–16 Game Design Studio foundation and is suitable for collaborative content production and controlled release assembly.

Future work should shift from foundational editor architecture toward authored game content, production art/audio, campaign expansion, accessibility, device QA and usability refinement rather than another major package-system rewrite.
