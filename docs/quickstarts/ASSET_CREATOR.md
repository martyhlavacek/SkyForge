# Quick Start - Asset Creator

## Your output

```text
.sfassetpack
```

## Start

```bash
npm ci
npm run dev
```

Open `http://localhost:5173/studio.html`, select **Assets**, and import approved PNG or WebP artwork created with an external tool.

## Focused workflow

1. Import one or more approved image files.
2. Record author, source, license, creation tool, and notes.
3. Classify each asset by semantic kind, role, tags, and approval status.
4. Configure dimensions, pivot, collision, hardpoints, altitude, and shadow.
5. Slice sprite sheets and define animations where required.
6. Preview the asset in neutral, canyon, ice, space, station, and combat contexts.
7. Create or update tilesets and deterministic atlases.
8. Check the **References** panel and repair missing or replaced asset IDs.
9. Export the verified `.sfassetpack`.

## Handoff minimum

- resources pass byte-count and SHA-256 verification where declared;
- provenance and licensing are complete;
- gameplay metadata matches the intended role;
- animation frames and pivots are tested;
- collision, hardpoints, altitude, and shadow are reviewed;
- reference-health warnings are resolved or documented.
