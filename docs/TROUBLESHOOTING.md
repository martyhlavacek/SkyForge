# Skyforge Studio Troubleshooting Reference

## Installation

### Unsupported Node version

Use Node 22 LTS. Remove `node_modules` after changing Node and run `npm ci`.

### Dependencies will not install

Confirm network access, supported Node, and an unchanged `package-lock.json`.

## Package import

### Unknown file

Confirm the extension is one of `.sflevelpack`, `.sftuning`, `.sfmusic`, `.sfassetpack`, `.sfworkspace`, or `.sflock`.

### Schema is newer than the Studio

Use a newer Studio build. Do not downgrade the package by editing its schema version.

### Missing dependency

Import the package named in the error and confirm its ID/version matches the requirement.

### Duplicate stable ID

Find both definitions. Rename only the new conflicting content and update its internal references.

## Locks and release

### Lock drift

A package changed after the lock was created. Review and approve the change, then create a new lock.

### Resource hash mismatch

The binary differs from the declaration. Restore the authoritative file or re-import and repack. Never edit the hash to hide the mismatch.

### Blocking review comment

Resolve the issue and mark the comment resolved. Production compilation intentionally refuses unresolved blockers.

### Dead resources

Dead resources are not necessarily errors. They may be rejected Foundry candidates or old renders. Confirm nothing approved depends on them.

## Level Studio

### Export blocked

Review structural, cross-reference, collision, and route warnings. Complete all Level Package v2 documents.

### Preview differs after seek

Snapshot seek reconstructs authored gameplay state but not every particle, animation, audio, or boss-internal detail. Confirm final behaviour with an uninterrupted run.

## Tuning

### Live value did not update

Some values require arena reset. Restart the arena after applying the change.

### A/B result is inconclusive

Run longer, isolate one parameter group, and repeat the same timeline region.

## Music

### No sound

Interact with the page to unlock browser audio, verify settings, and reload.

### Loop clicks

Review the discontinuity report and adjust notes, envelopes, or loop boundaries. Automatic repair is not yet included.

### Package is very large

Rendered WAV stems are embedded. Use folder mode for Git collaboration and keep only approved renders in production references.

## Assets

### Imported image disappears after reload

Re-import the exported Asset Pack. Browser origin changes, private mode, quotas, and cleanup can remove IndexedDB data.

### Generated artwork is not available in Studio

Epoch 17.6 has no integrated generation gateway. Export the approved result from the external tool as PNG or WebP, then import it through **Assets**.

### Asset reference is stale

Open the **References** panel, choose an approved replacement asset, apply the replacement to the Tuning Pack, and re-run validation.

## Browser tests

### Playwright browser executable missing

```bash
npx playwright install chromium webkit
```

### Localhost blocked by managed environment

Run the tests on a normal local machine or CI runner. This is an environment restriction, not an application assertion failure.

## Recovery practice

Always keep exported packages and Git history. Browser persistence is not the master copy.

## Package target is not empty

Epoch 17.2 no longer deletes an unpack destination automatically. Choose a new empty folder, remove the old folder yourself after inspection, or deliberately add `--force`:

```bash
npm run studio:unpack -- package.sfassetpack ./work/assets --force
```

## Package rejected because an ID is unsafe

Authored IDs now use the portable grammar `[A-Za-z0-9][A-Za-z0-9_-]*`. Replace spaces, slashes, dots, colons, or encoded separators with `_` or `-`, then update references to that ID. The Studio does not silently rename IDs because that could break collaboration references.

## Removed authoring command is unavailable

Commands such as `dev:foundry` and `studio:ai` were intentionally removed in Epoch 17.6. Use `npm run dev` for the focused Studio and external tools for asset or music creation.

## Level Studio interaction problems (Epoch 17.3)

### Painting does not change the map

1. Press `B` to enter Paint mode.
2. Confirm the intended layer is active and unlocked.
3. Select a material in the Materials tab.
4. Confirm the help strip names the expected tool, layer and material.
5. Use `E` to enter erasing mode; use Alt-click or right-click to sample an existing tile.

### An object will not move

Press `V`, click inside the visible gate or barrier rectangle, confirm the yellow selection outline, then drag. Clicking empty space intentionally clears the object selection.

### The map canvas is too narrow

Collapse the left or right dock using the edge arrows. In the parent Game Design Studio, choose **Hide Runtime**. The runtime can be restored at any time.

### Undo removes only part of a stroke

Epoch 17.3 should treat one mouse-down-to-mouse-up drag as one undo entry. If this fails, record the tool, browser, input device and exact pointer sequence.

### I cannot find a part of the level

Use the minimap to jump directly, or use Start, End and Page controls. Mouse wheel pans and Space-drag provides direct navigation.
