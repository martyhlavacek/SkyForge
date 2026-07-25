# Project Skyforge — Epoch 17 Independent Audit & Deficiency Log

**Artifact audited:** `skyforge-epoch17-complete.zip` (root `skyforge-epoch17/`, `package.json` version `0.8.0`)
**Audit type:** Extensive independent code review and verification
**Method:** Fresh checkout, dependency install, full toolchain execution, static review of security-critical and correctness-critical code, empirical exploitation of suspected issues, and cross-checking of every headline claim in the project's own verification reports.
**Scope:** Entire `src/` (169 files, ~27.9k LOC), server-side scripts in `scripts/`, package/studio tooling, schemas, and delivered documentation.

---

## 1. Executive summary

Skyforge at Epoch 17 is, on the whole, a **disciplined and honest codebase**. Every headline claim in the verification report that can be checked mechanically was independently reproduced: TypeScript strict passes, ESLint passes, **290 tests across 36 files pass**, the production and `/skyforge/`-base builds succeed, the build-budget gate passes, and `npm audit` reports zero vulnerabilities. Code hygiene is excellent — no `TODO`/`FIXME`, no `@ts-ignore`, no `eslint-disable`, no `any`, no `console.log` anywhere in `src/`. The core game-logic services (economy, energy, defense, save/migration) are well-designed and, in the economy's case, genuinely well-tested against exploit scenarios.

However, the audit identified **one High-severity security vulnerability that is empirically exploitable**, a **systemic root cause** behind it, and a cluster of Medium findings concentrated in the newest surface area (the AI Asset Foundry and its local gateway) and in areas the project's own prior reviews were mandated to fix but only partially did. The project's self-authored post-review documents assert at least one security property (**"Origin allow-list enforced"**) that the shipped code does **not** fully hold — which is precisely the value an independent audit adds.

**Headline deficiencies:**

| ID | Severity | Title |
|---|---|---|
| DEF-01 | **High** | Path traversal in `studio:unpack` — arbitrary file write outside the target directory (reproduced) |
| DEF-02 | **High** | Package/content `id` fields are unconstrained strings used as filesystem paths (root cause of DEF-01) |
| DEF-03 | Medium | AI gateway origin allow-list is bypassable (no `Origin` header ⇒ no check; no `Host`/rebinding defense) |
| DEF-04 | Medium | "Integrated API mode" is written to an unverified, apparently-incorrect provider contract and was never executed |
| DEF-05 | Medium | Zero automated coverage of the entire React UI layer (0/15 `.tsx`) and the 1,682-line `GameScene`; the E2E that would cover them cannot run as delivered |
| DEF-06 | Medium | `GameScene` remains a 1,682-line orchestrator — grew 2.4× since the Epoch 9 review mandated extraction; extraction only partially done |
| DEF-07 | Medium | Production debug/cheat handle reachable via `?studio=1` URL param in production builds |
| DEF-08 | Low | AI gateway has no request-rate limiting (cost-abuse amplification) |
| DEF-09 | Low | Shield recharge-delay boundary has sub-frame timing imprecision at coarse `dt` |
| DEF-10 | Low (latent) | `EconomyService.purchase` does not guard re-purchase of a *non-unique* owned item |
| DEF-11 | Low | Frame-rate-independence tests cover 1-vs-60 steps, not the 30/60/120 the acceptance criteria specify |
| DEF-12 | Low | `unpack()` force-deletes the target directory before writing |
| DEF-13 | Low | Delivery archive ships `dist/` build artifacts (29 files) |
| DEF-14 | Low | Documentation drift: top-level `README` "Acceptance evidence (current)" is stale (232/29/6 vs actual 290/36/14) |
| DEF-15 | Info | Self-authored post-review docs assert properties the code does not fully hold (non-independent review) |

---

## 2. Independent verification vs. project claims

Every row was executed by the auditor in a clean tree (`npm install` → command). "Claimed" is from `docs/EPOCH_17_VERIFICATION_REPORT.md`.

| Check | Claimed | Independently observed | Verdict |
|---|---|---|---|
| `tsc --noEmit` (strict) | Pass | Pass (0 errors) | ✅ Confirmed |
| ESLint | Pass | Pass (0 problems) | ✅ Confirmed |
| Vitest | 290 tests / 36 files | 290 tests / 36 files | ✅ Confirmed |
| Production build | Pass | Pass (`✓ built`) | ✅ Confirmed |
| Build-budget gate | Pass | Pass (`failures: []`) | ✅ Confirmed |
| `npm audit --audit-level=high` | 0 vulnerabilities | 0 vulnerabilities | ✅ Confirmed |
| Gateway origin allow-list | "enforced" | **Bypassable** (see DEF-03) | ❌ Overstated |
| "Package content … data-only" / safe tooling | asserted safe | **Path traversal in unpack** (see DEF-01) | ❌ Gap |
| Playwright E2E | "attempted; browsers absent" | Same (not runnable here) | ⚠️ Unverifiable in-env (as disclosed) |
| Live image generation | not executed | not executed (no key) | ⚠️ Unverified (as disclosed) |

**Takeaway:** the mechanical quality gates are real and green. The discrepancies are in security properties asserted in prose that were never mechanically tested, and in an external integration that was never executed.

---

## 3. Severity model

- **High** — Exploitable security vulnerability or data-integrity defect reachable in a supported workflow.
- **Medium** — Security weakness with a narrower threat model, a materially incorrect/unverified feature, or a maintainability/coverage risk that will compound.
- **Low** — Minor correctness, hygiene, precision, or documentation issue with limited blast radius.
- **Info** — Observation or process note; no direct defect.

---

## 4. Deficiency register

### DEF-01 — Path traversal in `studio:unpack` (arbitrary file write) — **High**

**Location:** `scripts/studio-folder.mjs` → `unpack()` / `categories()` / `put()`.

**Description:** `unpack()` parses a `.sfpackage`/workspace file with a raw `JSON.parse` (no schema validation) and writes one file per payload entry to `payload/<category>/${entry.id}.json` via `put(path)`, which does `join(target, path)` then `writeFile`. Resource *filenames* are passed through `safe()` (which strips `/` and `\`), but **payload entry `id` values are not sanitized at all**. Because `path.join` normalizes `..` segments, an `id` containing `../` escapes the target directory. The written content is attacker-controlled (the JSON serialization of the payload object).

**Evidence (reproduced in a contained `/tmp` sandbox):** A crafted level-pack whose single map had `"id": "../../../sentinel_escaped"` caused:

```
Unpacked evil2.sfpackage -> /tmp/travtest/target
>>> TRAVERSAL CONFIRMED: wrote /tmp/travtest/sentinel_escaped.json OUTSIDE target/
{ "id": "../../../sentinel_escaped", "displayName": "pwn" }
```

The file landed one level **above** the intended target, with content the attacker controlled.

**Impact:** Arbitrary file write (constrained to a `.json` extension and JSON content) triggered by running `npm run studio:unpack` on a package received from another author. The Package Authoring & Collaboration workflow (`docs/PACKAGE_AUTHORING_AND_COLLABORATION.md`) is explicitly built around **sharing packages between collaborators**, so untrusted input reaching this tool is a supported, expected scenario. Consequences include clobbering repository files (e.g., a nested `package.json`, `tsconfig`, or content JSON that is later loaded/compiled), corrupting adjacent projects, or planting attacker-controlled JSON that downstream tooling consumes — an integrity/DoS impact and a plausible supply-chain stepping stone. The Epoch 17 verification report's assertion that "package content remains declarative and data-only" does not cover this write-side tooling gap.

**Recommendation:**
1. In `put()`, resolve the final path and assert it stays within `target` (`const full = resolve(target, path); if (!full.startsWith(resolve(target) + sep)) throw`). Reject on violation.
2. Sanitize every `id` used as a path segment (reuse/extend `safe()` to also reject `.`/`..` and empty results), or better, validate the entire package against the Zod schema **before** writing (see DEF-02).
3. Add a regression test that unpacks a malicious-`id` fixture and asserts no file escapes `target`.

---

### DEF-02 — `id` fields are unconstrained strings used as path components — **High** (root cause)

**Location:** `src/schemas/studioPackageSchema.ts` (all `id:` declarations), and every serializer that maps `id → path`.

**Description:** Throughout the package schema, identifiers are declared as `z.string().min(1)` with **no character restriction**. By contrast, resource hashes (`/^[a-f0-9]{64}$/`), base64 (`/^[A-Za-z0-9+/]*={0,2}$/`), versions, sizes, and colors *are* regex-constrained. Because IDs double as filesystem path segments in the folder/unpack tooling (DEF-01) and as map keys elsewhere, an unconstrained ID is a latent injection vector across the whole studio pipeline, not just in one script.

**Evidence:** `grep` of `src/schemas/studioPackageSchema.ts` shows ~30 `id: z.string().min(1)` declarations and only 6 regex-constrained string fields (none of them IDs).

**Impact:** Root cause enabling DEF-01; also allows IDs containing path separators, null bytes, whitespace, or duplicate collisions to pass validation and reach code that assumes a safe `snake_case`-style token (the game's own convention elsewhere).

**Recommendation:** Introduce a shared `const SafeId = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/)` and apply it to all authored `id` fields across package, content, equipment, terrain, and simulation schemas. Add a focused schema test asserting traversal/whitespace IDs are rejected.

---

### DEF-03 — AI gateway origin allow-list is bypassable — **Medium**

**Location:** `scripts/studio-ai-server.mjs`, request handler.

**Description:** The gateway enforces its allow-list only when an `Origin` header is present:

```js
const origin = request.headers.origin;
if (origin && !allowedOrigins.has(origin)) {
  writeJson(response, 403, { error: 'origin is not allowed' });
  return;
}
```

Any request **without** an `Origin` header skips the check and reaches `POST /v1/assets/generate`, which spends the user's `OPENAI_API_KEY`. There is additionally **no `Host`-header validation**, so DNS-rebinding hardening is absent, and there is no authentication token on the endpoint. The Epoch 17 post-review states "**Origin allow-list enforced**" and "Origin restrictions" — an overstatement given this gap.

**Impact / threat model (calibrated):** The service binds to loopback by default, so the primary realistic attackers are (a) any other local process on the developer's machine, and (b) non-browser clients, both of which omit `Origin` and therefore bypass the allow-list to spend the user's paid image-generation credits. Browser-based cross-origin `fetch` generally *does* attach `Origin` (so the classic CSRF path is largely blocked for compliant browsers), which keeps this at Medium rather than High — but the control is advertised as a security boundary and does not hold for the non-browser case, and DNS-rebinding is undefended.

**Recommendation:**
1. Treat a **missing** `Origin` as untrusted for state-changing routes: require `Origin ∈ allowedOrigins` for `POST /v1/assets/generate` (do not `&&`-guard it away).
2. Validate the `Host` header against an allow-list (`127.0.0.1:PORT`, `localhost:PORT`) to defeat DNS rebinding.
3. Consider a per-session shared secret (printed on startup, sent as a header) so only the paired Studio instance can drive generation.
4. Correct the post-review wording to match the implemented behavior.

---

### DEF-04 — "Integrated API mode" is unverified and likely non-functional against the real provider — **Medium**

**Location:** `scripts/studio-ai-server.mjs` → `requestOpenAi()`; `.env.example`; `docs/EPOCH_17_IMPLEMENTATION.md` ("Integrated API mode").

**Description:** The default model is `gpt-image-2` (`SKYFORGE_IMAGE_MODEL ?? 'gpt-image-2'`), and the `edit` operation POSTs a **JSON** body to `https://api.openai.com/v1/images/edits` containing `images: [{ image_url }]` and `input_fidelity`. To the best of the auditor's knowledge (training cutoff early 2026), (a) the provider's image model is `gpt-image-1`, not `gpt-image-2`, and (b) the images **edits** endpoint expects `multipart/form-data` with uploaded image bytes, not a JSON body with `image_url` references; the generations endpoint likewise does not take `image_url`. The project itself confirms this path was **never executed** ("A paid external image-generation request was not executed … request construction … covered by tests" — but those tests validate the *local* contract, not the provider's).

**Impact:** "Integrated API mode" is presented in the implementation doc as a usable feature (`npm run dev:foundry` → "Generate via local API"), but as written it is likely to fail at the first live call. This is a functional-correctness and documentation-accuracy risk, not a security one. (Stated with appropriate uncertainty: the provider API may have changed; the point is that the contract is **unverified against any live endpoint** while being documented as working.)

**Recommendation:**
1. Validate the request/response contract against the current provider API documentation; correct the endpoint usage (multipart for edits), the field names, and the default model.
2. Add an integration smoke test behind an env flag that a maintainer can run with a real key, and mark integrated mode "experimental/unverified" in the docs until such a run passes.

---

### DEF-05 — No automated coverage for the UI layer or `GameScene`; covering E2E cannot run as delivered — **Medium**

**Location:** all `src/**/*.tsx` (15 files: `StudioApp`, `AssetStudioWorkspace`, `AssetFoundryWorkspace`, `MusicStudioWorkspace`, `EditorApp`, `SpatialComposer`, `MapViewport`, scenes' React glue, etc.); `src/game/scenes/GameScene.ts`.

**Description:** There are **0** `.test.tsx` files — the entire React surface (Studio, Asset Foundry, Music Studio, Level Composer, and their workspaces) has no unit/component tests. `GameScene.ts` (1,682 lines, the central runtime orchestrator) has no direct tests. The Playwright suite that is *intended* to exercise these paths "was attempted, but this sandbox does not contain Playwright's Chromium or WebKit binaries" — i.e., in the delivered environment it does not run. Note (in fairness): the pure services and the studio *compile/validate* transforms **are** covered — directly (economy, energy, defense, save, math, RNG, movement, autotile, terrain analysis) or indirectly (`ContentCompiler`, `ProductionCompiler`, package validation via `StudioPackages.test.ts` / `Epoch16Production.test.ts`). The gap is specifically the interactive UI and the scene orchestrator.

**Impact:** The headline "290 tests" is genuine but **breadth-weighted toward declarative content** (92 of the 290 are content-JSON schema checks) and pure services. UI/scene regressions — the layer a user actually touches — are effectively unguarded by automated means in this deliverable. Combined with DEF-06 (a very large untested orchestrator), refactors carry real regression risk.

**Recommendation:**
1. Add component tests for at least the highest-traffic workspaces (Asset Foundry candidate workflow, Hangar buy/equip/launch, Music Studio) using React Testing Library.
2. Extract testable pure helpers out of `GameScene` (see DEF-06) and unit-test them (snapshot/restore, reward-ID generation, pickup resolution).
3. Make the Playwright browser install part of the standard `test:e2e` bootstrap and run it in CI on every push, so "covered by E2E" is a checked fact rather than an unrun intention.

---

### DEF-06 — `GameScene` god-class; mandated extraction only partially done — **Medium**

**Location:** `src/game/scenes/GameScene.ts` (1,682 lines, 45 `import`s).

**Description:** The Epoch 9 technical review flagged `GameScene` at **688 lines** as a god class and made extraction a required deliverable (its "9R.5 architecture extraction," naming `RunSession`, `CombatDirector`, `LevelRuntime`, `BossController`, `GamePresentation`, `TelemetryBridge`). By Epoch 17 the file has grown to **1,682 lines** — 2.4× larger. In fairness, meaningful extraction *did* occur: business logic lives in services (`MissionEconomy`, `RuntimeLoadoutSnapshot`, `ShipEnergySystem`, `ShipDefenseSystem`, `RunSession`), so the review's worst-case fear (economy/inventory rules living *inside* `GameScene`) was avoided — `GameScene` orchestrates those services rather than containing their rules. But `RunSession` is the only one of the six named boundaries that materializes as its own module; combat direction, level runtime, boss control, presentation, and the telemetry bridge remain inlined, and the scene absorbed Epoch 10–17 responsibilities (equipment snapshotting, escrow wiring, terrain, adaptive music cues, snapshot/restore) on top.

**Impact:** Maintainability and regression risk. A 1,682-line, 45-import class with no direct tests (DEF-05) is the single riskiest file to modify, and it sits on the critical path of every future gameplay epoch.

**Recommendation:** Resume the Epoch 9 extraction plan incrementally: peel `CombatDirector` (pools/collisions/weapons/pickups), `BossController`, and `GamePresentation` (particles/shake/flash/audio) into modules with explicit `start/update/dispose`, each with unit tests, preserving behavior. Target < ~600 lines for the residual orchestrator.

---

### DEF-07 — Production debug/cheat handle reachable via `?studio=1` — **Medium**

**Location:** `src/main.ts` (handle gate) — condition is `import.meta.env.DEV || import.meta.env.VITE_E2E === '1' || params.get('studio') === '1'`.

**Description:** In a **production** build, appending `?studio=1` to the URL installs `window.__skyforge`, which exposes `setInvulnerable`, `setTimeScale`, `seek`, `pause`, `resume`, `restart`, and state snapshots. The Epoch 9 review's P1-11 remediation explicitly directed gating the handle behind `DEV || VITE_E2E` and **not** exposing it "in normal production builds." The third, URL-guessable condition re-opens that guidance. (The `postMessage` bridge itself is correctly origin-checked — `event.origin !== window.location.origin` — so cross-origin pages cannot drive it; the issue is that any script on the page, once `?studio=1` is set, can.)

**Impact:** For a single-player, local-save game with no described server authority or leaderboard integrity, the practical impact is low (players cheating their own local session). But shipping cheat/debug hooks reachable by query param contradicts explicit prior remediation and is undesirable hygiene, especially as future epochs may add competitive/online features.

**Recommendation:** Drive the Studio preview iframe through a build-time flag (a dedicated preview entry, or `VITE_E2E`-style env) or a `postMessage` handshake gated to the Studio's own origin, rather than a guessable production query param. If a param is retained, restrict the exposed surface in production to read-only snapshots (no `setInvulnerable`/`setTimeScale`/`seek`).

---

### DEF-08 — AI gateway has no request-rate limiting — **Low**

**Location:** `scripts/studio-ai-server.mjs`.

**Description:** The only limits are body size (`SKYFORGE_AI_MAX_BODY_BYTES`, 25 MB) and candidate count (1–4). There is no per-time request limit. Combined with DEF-03 (reachable without an `Origin`), a local loop could rack up provider cost.

**Recommendation:** Add a simple token-bucket / minimum-interval limit per process, and log each outbound generation with its estimated cost.

---

### DEF-09 — Shield recharge-delay boundary is sub-frame imprecise at coarse `dt` — **Low**

**Location:** `src/game/player/ShipDefenseSystem.ts` → `update()`.

**Description:** The recharge itself is linear (`shieldRechargeRate * dt`) and thus frame-rate independent, but the delay→recharge transition applies the **full** `dt` of a step that only partially exceeded the remaining delay. At coarse `dt`, recharge can begin up to `dt` seconds early and apply a full step's worth. For normal frame rates (≤16.7 ms) the error is negligible and within the addendum's stated tolerance, but it is a genuine minor frame-rate dependence.

**Recommendation:** Carry the delay overshoot: compute the fraction of `dt` remaining after the delay elapses and recharge only for that fraction. Add a 30/60/120-step equivalence test around the boundary (ties into DEF-11).

---

### DEF-10 — `purchase()` does not guard re-purchase of a *non-unique* owned item — **Low (latent)**

**Location:** `src/game/economy/EconomyService.ts` → `purchase()`.

**Description:** The already-owned guard is conditional on uniqueness: `if (this.state.inventory.owned[item.id] && item.unique) …`. For a non-unique item, a second `purchase()` charges credits again and **overwrites** the existing owned entry (resetting `upgradeLevel` to 0 and `usedInMission` to false). **Currently latent:** all 21 shipped equipment definitions set `"unique": true` (and the schema defaults `unique` to `true`), so this cannot be triggered with present content. It becomes a real double-charge/upgrade-loss bug the moment any non-unique item ships.

**Recommendation:** For non-unique items, either maintain a quantity counter or reject re-purchase; never blind-overwrite an existing owned entry. Add a test with a non-unique fixture.

---

### DEF-11 — Frame-rate-independence tests don't cover the specified 30/60/120 steps — **Low**

**Location:** `src/game/player/ShipEnergySystem.test.ts` (and by extension defense).

**Description:** The energy test compares one 1 s step against sixty 1/60 s steps — adequate for linear regen, but the Epoch 10 acceptance criterion #9 specifically requires equivalence "at 30, 60, and 120 update steps per second." The stronger claim is asserted but not directly tested, and the non-linear delay boundary (DEF-09) is exactly where such a test would have value.

**Recommendation:** Parameterize a 30/60/120 equivalence test across energy spend+regen and shield recharge including the delay boundary.

---

### DEF-12 — `unpack()` force-deletes the target directory — **Low**

**Location:** `scripts/studio-folder.mjs` → `unpack()` (`await rm(target, { recursive: true, force: true })`).

**Description:** Unpack unconditionally `rm -rf`s the user-supplied target before writing. A mistyped target argument silently destroys its contents.

**Recommendation:** Refuse to delete a non-empty target unless a `--force` flag is passed, or require the target to be empty/nonexistent.

---

### DEF-13 — Delivery archive ships `dist/` build artifacts — **Low**

**Location:** delivered archive root (`dist/`, 29 files). `.gitignore` correctly lists `dist/`, and `.git` is **not** present (the Epoch 9 P2-5 hygiene note was addressed), but the packaged handoff still includes build output.

**Recommendation:** Exclude `dist/`, `coverage/`, `test-results/`, and `playwright-report/` from handoff archives (mirror `.gitignore`).

---

### DEF-14 — Documentation drift in top-level `README` acceptance evidence — **Low**

**Location:** `README.md` §"Acceptance evidence (current)".

**Description:** The README states "**232 passing tests across 29 files**" and "Playwright contains **six** smoke tests," and its surrounding acceptance prose references Epoch 13 features. The actual Epoch 17 state (independently measured) is **290 tests / 36 files**, and `docs/EPOCH_17_VERIFICATION_REPORT.md` cites **14** Playwright scenarios. The top-level README was not carried forward through Epochs 14–17.

**Recommendation:** Regenerate the README acceptance section from the current build, or have the verification step fail if README counts diverge from measured counts.

---

### DEF-15 — Non-independent prior reviews assert unheld properties — **Info**

**Location:** `docs/EPOCH_1x_POST_REVIEW_AND_AUDIT.md` series.

**Description:** The per-epoch "Post-Epoch Review and Audit" documents are thorough but self-authored, and they conclude "PASS" while asserting at least one property the code does not fully hold (Epoch 17: "Origin allow-list enforced," contradicted by DEF-03) and not surfacing DEF-01/DEF-02. This is an observation about process, not a code defect: these are implementer self-reviews, not independent audits, and should be labeled as such.

**Recommendation:** Treat security-property claims as testable assertions (add negative tests for origin-without-header, traversal IDs, etc.) so that "enforced" is mechanically demonstrable rather than narrated.

---

## 5. Notable strengths (for balance)

These are genuine and worth preserving through future refactors:

- **Mission economy is exploit-resistant and well-tested.** `MissionEconomy` dedupes rewards via `safeAmount` + a claimed-ID set, snapshots claimed IDs at checkpoints, rolls back post-checkpoint claims on retry, and makes settlement idempotent via `processedSettlementIds`; `structuredClone` prevents input mutation. Tests cover double-claim, checkpoint rollback, double-settle, and snapshot restore — the exact addendum §25 exploit cases.
- **Banked-credit `EconomyService` is transactional.** Clone → validate → commit-only-on-success, with `structuredClone` isolation; tests confirm no mutation on failed purchase and safe invalid-equip rejection.
- **Energy/defense systems are clean and (for regen) provably frame-rate independent**, with correct shield-before-armor layering and energy-limited recharge.
- **`SaveData` fully addresses the Epoch 9 P1-8 finding:** per-field Zod sanitization with fallbacks, whole-profile schema validation with starter-profile fallback, corrupt-JSON recovery, v1→v2 migration, and the P2-1 high-score-tie bug fixed with strict `>`.
- **Launch re-validates ownership** (`loadoutValidator.validate(activeLoadout, profile)`), so tampered saves referencing unowned equipment cannot start a mission (acceptance criterion upheld); `bankedCredits` is `int().nonnegative()`, `campaignTier` bounded 0–4.
- **Exceptional code hygiene:** zero `any`, `@ts-ignore`, `eslint-disable`, `TODO/FIXME`, or `console.log` across ~28k LOC; strict `tsc`, ESLint, budget, and audit gates all pass.
- **Honest mechanical verification:** the 290/36 test count, build, budget, and zero-vuln claims all reproduced exactly.

---

## 6. Test-coverage assessment

- **290 tests / 36 files — reproduced.** Composition: ~92 are `content.test.ts` declarative schema/cross-reference checks; the remainder are pure-service and studio integration tests, most with 3–4 assertions (happy-path-weighted).
- **Well covered:** economy (exploit paths), energy, defense, save/migration, math, RNG, movement, autotile, terrain analysis/collision, loadout validation, stat calculation, music engine, and — indirectly — the studio compile/validate/lock/migrate pipeline.
- **Not covered by unit/component tests:** all 15 `.tsx` UI modules and `GameScene` (DEF-05/DEF-06). The E2E intended to cover them is not runnable in the delivered environment (disclosed).
- **Depth gaps:** frame-rate independence asserted for 30/60/120 but tested only 1-vs-60 (DEF-11); no negative security tests (traversal IDs, origin-without-header) despite security claims (DEF-15).

---

## 7. Status of prior-review items (Epoch 9 technical review)

| Prior item | Status in Epoch 17 |
|---|---|
| P1-8 — Zod-validate/clamp localStorage save | ✅ Resolved (`SaveData.ts`) |
| P2-1 — high-score shows on tie | ✅ Resolved (strict `>` in `recordRun`) |
| Addendum §10.4 — `shield` pickup wrongly repaired hull | ✅ Resolved (`restoreShield` path) |
| P1-11 — gate/limit the E2E/debug handle | ⚠️ Partially — gated, but `?studio=1` re-exposes it in prod (DEF-07) |
| P1-13 / 9R.5 — extract `GameScene` god class | ⚠️ Partially — services extracted, but `GameScene` grew to 1,682 lines (DEF-06) |
| P2-5 — handoff archive contained `.git` | ✅ `.git` absent; ⚠️ `dist/` still shipped (DEF-13) |

---

## 8. Prioritized remediation roadmap

**Before any further collaboration/package sharing is enabled (do first):**
1. **DEF-01 + DEF-02** — sanitize IDs, add a `resolve`-based containment check in `put()`, and validate packages against the schema **before** unpacking. Add malicious-fixture regression tests. *(High; small, well-scoped change.)*

**Before relying on the AI Foundry integrated mode / advertising the gateway as secure:**
2. **DEF-03** — enforce origin for state-changing routes even when the header is absent; add `Host` validation; correct the post-review wording. *(Medium.)*
3. **DEF-04** — verify and fix the provider contract; mark integrated mode experimental until a live smoke test passes. *(Medium.)*
4. **DEF-08** — add gateway rate limiting. *(Low, pairs with DEF-03.)*

**Engineering-health track (schedule alongside Epoch 18):**
5. **DEF-06 + DEF-05** — resume the `GameScene` extraction and add component/scene tests; wire runnable Playwright into CI.
6. **DEF-07** — replace the `?studio=1` production exposure with a build-time/handshake mechanism.
7. **DEF-09/DEF-10/DEF-11/DEF-12** — precision, latent-bug, test-depth, and CLI-safety hardening.
8. **DEF-13/DEF-14** — archive hygiene and README regeneration; make count-drift fail the verification step.

---

## Appendix A — Audit environment & commands

- Node/npm in a clean container; `npm install` (146 packages, 0 vulns).
- Executed: `tsc --noEmit` (pass), `npm run lint` (pass), `npm test` (290/36 pass), `npm run build` (pass), `npm run build:budget` (pass), `npm audit --audit-level=high` (0 vulns).
- Reproduced DEF-01 with two crafted `.sfpackage` fixtures unpacked into a disposable `/tmp` target; confirmed a file written one directory above the target with attacker-controlled content.
- Static review of: `studio-ai-server.mjs`, `run-foundry-dev.mjs`, `studio-folder.mjs`, `studio-release-lib.mjs`, `MissionEconomy.ts`, `EconomyService.ts`, `ShipEnergySystem.ts`, `ShipDefenseSystem.ts`, `SaveData.ts`, `profileSchema.ts`, `equipmentSchema.ts`, `studioPackageSchema.ts`, `main.ts`, `GameScene.ts` (structure/coupling), `HangarScene.ts` (launch path), plus the full docs set.

## Appendix B — Severity distribution

High ×2 · Medium ×5 · Low ×7 · Info ×1 — total **15** logged items. No defect was found in the core economy, energy, defense, or save/migration logic; the exploitable issue and its root cause are isolated to the studio **packaging tooling**, and the remaining Medium items concentrate in the newest surface (AI Foundry/gateway) and in carried-over architectural/coverage debt.
