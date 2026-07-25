# Quick Start - Master Integrator

## You own

```text
.sfworkspace
.sflock
accepted package set
compiled release
```

## Receive a contribution

1. Preserve the previous approved package.
2. Import the contribution into a copy of the master workspace.
3. Review version, content revision, migration messages, comments, and change summary.
4. Compare stable IDs and cross-package references.
5. Preview affected content.
6. Check provenance for new image or audio resources.
7. Run package validation and lock-drift check.
8. Resolve blocking comments.

## Accept

1. Update the workspace package reference.
2. Generate a new dependency lock.
3. Run production compilation.
4. Run:

```bash
npm run audit:release
npm run build:base:verify
npx playwright install chromium webkit
npm run test:e2e
```

5. Archive the four packages, workspace, lock, release manifest, validation result, and change summary.

## Reject or return

Add blocking comments to the smallest useful target path and state the pass condition. Do not manually bypass lock or hash errors.
