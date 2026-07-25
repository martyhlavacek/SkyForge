# Epoch 17.2 Security Review

## Review classification

This is an **internal remediation security review** based on the independent Epoch 17 audit. It is not represented as a new independent third-party audit. Security claims below are tied to negative automated tests or explicitly marked unverified.

## Threat model

Supported collaboration workflows accept package files and unpacked projects from other contributors. Those inputs are untrusted until validated. The local AI gateway can spend a maintainer's paid API credits and therefore treats all generation requests as authenticated state-changing operations even though it binds to loopback.

## Negative security controls

### Filesystem boundary

Mechanically tested:

- traversal IDs cannot pass package schemas;
- `../`, absolute, Windows-drive and backslash paths fail containment checks;
- malicious packages are rejected before target creation or deletion;
- resource filename traversal is rejected;
- case-normalized resource filename collisions are rejected;
- non-empty targets survive unless `--force` is explicit;
- pack operations reject symlinks.

### Foundry gateway boundary

Mechanically tested:

- missing Origin is rejected for generation;
- disallowed Origin is rejected;
- disallowed Host is rejected;
- missing or incorrect session token is rejected;
- request-rate limits return 429;
- concurrent generation is bounded;
- health responses do not reveal the token;
- fixed endpoints, allowed media types, candidate limits, input limits and timeouts remain enforced.

### Runtime boundary

Mechanically tested:

- production mode does not expose mutable global controls merely because `studio=1` is present;
- an embedded production Studio bridge requires a session nonce;
- Studio messages additionally require same-origin and parent-window identity.

## Provider contract status

`gpt-image-2` is a supported current image model, and the Images API supports generation and JSON image references for edits. The gateway request shape is checked offline. A paid live provider request was not run because no user API key was supplied. Until the opt-in smoke test passes in a maintainer environment, integrated generation is **experimental**; manual ChatGPT import is the recommended production path.

## Residual risks

- A local process that learns the printed session token can use the loopback gateway within the configured rate limit. This is an accepted local-machine trust boundary.
- Very large collaboration packs may benefit from streaming pack/unpack rather than whole-file JSON parsing.
- `GameScene` remains a maintainability concentration and should be decomposed before major additional runtime systems are introduced.
- Physical-device and browser QA remains necessary even though CI installs Chromium and WebKit.

## Decision

The High-severity package traversal vulnerability and its unsafe-ID root cause are resolved and regression-tested. Gateway origin/host/token/rate controls are mechanically demonstrated. Epoch 17.2 is suitable for controlled package collaboration, subject to the residual risks above and the experimental label on paid API generation.
