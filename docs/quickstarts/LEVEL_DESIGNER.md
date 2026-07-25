# Quick Start - Level Designer

## Your output

```text
.sflevelpack
```

## Start

```bash
npm ci
npm run dev
```

Open `http://localhost:5173/editor.html`.

## Workflow

1. Import the current Level, Tuning, Music, and Asset Packs into the Game Design Studio if you need full-context preview.
2. Open the Level Studio and select the assigned level.
3. In **Spatial**, paint terrain and run Autotile.
4. Edit collision independently of visual artwork.
5. Edit the expected route and inspect clearance warnings.
6. Position gates, barriers, and other existing dynamic objects.
7. In **Timeline**, add encounters, recovery periods, terrain states, and checkpoints.
8. Use Preview to run unsaved changes.
9. Use the Game Design Studio transport to loop and scrub attention points.
10. Resolve all validation errors.
11. Export the `.sflevelpack`.

## Do not change

- stable enemy, music, or asset IDs without coordinating with their package owners;
- Tuning, Music, or Asset Package content unless explicitly assigned;
- collision merely to match decorative art if it makes the route unfair.

## Return

- revised `.sflevelpack`;
- level IDs changed;
- change summary;
- screenshots or recording;
- unresolved review comments;
- validation result.
