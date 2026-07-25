# Epoch 17.2 Implementation — Security and Reliability Remediation

## Release purpose

Epoch 17.2 responds to the independent Epoch 17 audit. It is a focused remediation release rather than a feature epoch. The release blocks unsafe collaboration paths, hardens paid Foundry requests, removes production debug exposure, deepens UI/security coverage, corrects timing and economy edge cases, and reconciles verification documentation with measured results.

## Implemented remediation

### Package and folder security

- Added one canonical `SafeIdSchema` for authored IDs and cross-package references.
- Rejected traversal sequences, path separators, encoded separators, whitespace, control characters, drive paths, and dot-only IDs.
- Replaced the unvalidated JavaScript folder tool with a typed implementation that parses and semantically validates the entire package before touching the destination.
- Added resolved-path containment checks to every generated folder path.
- Sanitized resource filenames and rejected duplicate normalized output names.
- Rejected symbolic links while packing a Git-folder project.
- Refused to replace a non-empty unpack target unless `--force` is explicitly supplied.
- Deferred all destructive removal until after complete input validation.
- Added malicious package fixtures covering authored-ID traversal, resource filename traversal, absolute paths, Windows paths, duplicate normalized names, and non-empty target protection.

### AI Asset Foundry gateway

- Required an allowed `Origin` for every state-changing generation request.
- Validated `Host` against loopback host/port values.
- Added a random per-process Studio session token sent through `X-Skyforge-Session`.
- Added token-bucket request limiting and a concurrent-request cap.
- Kept loopback binding, body limits, prompt limits, image allow-lists, fixed provider endpoints, timeout handling, and hash/byte verification.
- Added an offline provider request-shape contract test and an opt-in paid live smoke test.
- Marked API-backed generation experimental until the live smoke test is run with a maintainer-owned key; manual ChatGPT import remains fully supported.

### Runtime preview boundary

- Mutable `window.__skyforge` controls are now exposed only in development or explicit E2E builds.
- A production `?studio=1` URL does not create a public mutable debug handle.
- Embedded Studio control requires an iframe, a generated session nonce, a matching message nonce, same-origin messaging, and the actual parent window as message source.

### Correctness and test depth

- Shield recharge now applies only the portion of a coarse frame remaining after its recharge delay expires.
- Energy and defense equivalence are tested at 30, 60, and 120 updates per second.
- Re-purchasing any already-owned equipment is rejected because inventory quantities are not yet modelled.
- Added React component coverage for Level map painting and the Asset Foundry token/brief workflow.
- Retained fourteen Playwright scenarios in CI, including map painting and runtime dock scaling.

### Documentation and delivery

- Added separate implementation, verification, and security-review records.
- Preserved the external audit verbatim as `INDEPENDENT_AUDIT_EPOCH_17.md`.
- Relabelled prior post-epoch audits as internal implementation reviews.
- Updated README evidence and collaboration security instructions.
- Source handoff archives exclude `dist`, dependencies, coverage, Playwright output, caches, and transient release-compiler output.

## Remaining engineering debt

`GameScene` remains a large orchestration class and still lacks direct scene-level unit coverage. Pure gameplay services are well covered, and the highest-traffic Studio interactions now have component/E2E coverage, but scene decomposition remains a planned engineering-health task rather than a completed Epoch 17.2 item.

The live paid OpenAI smoke test is also not executed without a user-supplied API key. The current request shape is checked offline against the documented contract, and API mode is labelled experimental until a maintainer runs `SKYFORGE_LIVE_OPENAI_TEST=1 npm run test:foundry:live` successfully.
