#!/usr/bin/env python3
"""Perceptual geometry gate for Blob-47 inner curves and diagonal banks.

This release gate exists because mapping all 47 masks is not enough: the
corresponding artwork must make diagonal-bit changes visible at gameplay scale,
inner corners must have a readable radius, and the authored map must actually
exercise sustained diagonals and all four concave-corner orientations.
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageStat

ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "public/assets/terrain"
MANIFEST = json.loads((ASSET_DIR / "skyforge_canyon_tileset.json").read_text())
MAP = json.loads((ROOT / "src/content/maps/canyon_passage.json").read_text())
ATLAS = Image.open(ASSET_DIR / "skyforge_canyon_terrain.png").convert("RGBA")
TILE = MANIFEST["terrain"]["tileSize"]
COLUMNS = MANIFEST["terrain"]["columns"]
BOUNDARY = MANIFEST["terrain"]["frames"]["sandstoneBoundaryBlob47"]
SHORELINE = MANIFEST["terrain"]["frames"]["shorelineBlob47"]


def atlas_frame(index: int) -> Image.Image:
    x = (index % COLUMNS) * TILE
    y = (index // COLUMNS) * TILE
    return ATLAS.crop((x, y, x + TILE, y + TILE))


def first_frame(mapping: dict[str, int | list[int]], mask: int) -> Image.Image:
    value = mapping[str(mask)]
    index = value[0] if isinstance(value, list) else value
    return atlas_frame(index)


def alpha(mask: int) -> Image.Image:
    return first_frame(BOUNDARY, mask).getchannel("A")


def regression(points: list[tuple[int, int]]) -> tuple[float, float, float]:
    count = len(points)
    mean_x = sum(x for x, _ in points) / count
    mean_y = sum(y for _, y in points) / count
    variance_x = sum((x - mean_x) ** 2 for x, _ in points)
    covariance = sum((x - mean_x) * (y - mean_y) for x, y in points)
    slope = covariance / max(variance_x, 1e-9)
    intercept = mean_y - slope * mean_x
    total = sum((y - mean_y) ** 2 for _, y in points)
    residual = sum((y - (slope * x + intercept)) ** 2 for x, y in points)
    r_squared = 1.0 - residual / max(total, 1e-9)
    return slope, intercept, r_squared


def transition_points(image: Image.Image) -> list[tuple[int, int]]:
    return [
        (x, y)
        for y in range(TILE)
        for x in range(TILE)
        if 5 < image.getpixel((x, y)) < 250
    ]


def map_bounds() -> tuple[list[int], list[int], dict[int, int]]:
    surface = next(layer for layer in MAP["layers"] if layer["id"] == "sandstone_surface")
    occupied = {(cell["x"], cell["row"]) for cell in surface["cells"]}
    early_masks: dict[int, int] = {}
    for cell in surface["cells"]:
        if cell["row"] <= 140 and cell.get("variant") != 255:
            mask = int(cell["variant"])
            early_masks[mask] = early_masks.get(mask, 0) + 1
    left: list[int] = []
    right: list[int] = []
    for row in range(MAP["rows"]):
        water = [x for x in range(17) if (x, row) not in occupied]
        left.append(min(water))
        right.append(max(water))
    return left, right, early_masks


def diagonal_runs(values: list[int], limit: int = 140) -> list[tuple[int, int, int]]:
    result: list[tuple[int, int, int]] = []
    start = 0
    direction = 0
    for index in range(1, limit):
        delta = values[index] - values[index - 1]
        sign = 1 if delta == 1 else -1 if delta == -1 else 0
        if sign and sign == direction:
            continue
        if direction:
            result.append((start, index - 1, direction))
        if sign:
            start = index - 1
            direction = sign
        else:
            direction = 0
    if direction:
        result.append((start, limit - 1, direction))
    return result


def render_evidence() -> Path:
    """Render the exact masks and map sections used by the release gate."""
    from importlib.util import module_from_spec, spec_from_file_location

    render_path = ROOT / "scripts/render-canyon-preview.py"
    spec = spec_from_file_location("canyon_preview", render_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load preview renderer")
    module = module_from_spec(spec)
    spec.loader.exec_module(module)

    snapshots = [module.render_snapshot(row) for row in (10, 72, 286)]
    width = snapshots[0].width
    evidence = Image.new("RGBA", (width * 3, snapshots[0].height + 190), (18, 26, 36, 255))
    for index, snapshot in enumerate(snapshots):
        evidence.alpha_composite(snapshot, (index * width, 190))

    draw = ImageDraw.Draw(evidence)
    draw.text((12, 10), "Blob-47 release geometry gate: true diagonals and readable inner curves", fill=(245, 245, 245, 255))
    masks = [19, 38, 76, 137, 127, 191, 223, 239]
    labels = ["NE diagonal", "SE diagonal", "SW diagonal", "NW diagonal", "NW inner", "SW inner", "SE inner", "NE inner"]
    for index, (mask, label) in enumerate(zip(masks, labels)):
        x = 12 + index * 96
        tile = Image.new("RGBA", (TILE, TILE), (28, 86, 132, 255))
        tile.alpha_composite(first_frame(BOUNDARY, mask))
        tile.alpha_composite(first_frame(SHORELINE, mask))
        evidence.alpha_composite(tile.resize((64, 64), Image.Resampling.NEAREST), (x, 42))
        draw.text((x, 112), f"{mask:03}\n{label}", fill=(230, 230, 230, 255))

    output = ROOT / "docs/EPOCH_18_2_BLOB47_GEOMETRY_EVIDENCE.png"
    evidence.save(output, optimize=True)
    return output


def main() -> None:
    assert len(BOUNDARY) == 47 and len(SHORELINE) == 47

    # Every supported diagonal bit must materially change the rendered alpha.
    pair_differences: list[dict[str, float | int]] = []
    for mask_text in BOUNDARY:
        base = int(mask_text)
        for bit, supports in ((16, 3), (32, 6), (64, 12), (128, 9)):
            changed = base | bit
            if (base & supports) != supports or base & bit or str(changed) not in BOUNDARY:
                continue
            difference = ImageChops.difference(alpha(base), alpha(changed))
            changed_pixels = sum(value > 32 for value in difference.tobytes())
            mean_difference = ImageStat.Stat(difference).mean[0]
            assert changed_pixels >= 60, f"masks {base}/{changed} differ by only {changed_pixels} pixels"
            assert mean_difference >= 13.0, f"masks {base}/{changed} mean alpha difference is only {mean_difference:.2f}"
            pair_differences.append({"base": base, "changed": changed, "pixels": changed_pixels, "mean": round(mean_difference, 3)})

    # The four diagonal corner states must span the full tile at a true 45-degree slope.
    diagonal_metrics: dict[str, dict[str, float | int]] = {}
    for mask in (19, 38, 76, 137):
        candidate = alpha(mask)
        points = transition_points(candidate)
        slope, _, r_squared = regression(points)
        xs = [x for x, _ in points]
        ys = [y for _, y in points]
        opaque = sum(value > 128 for value in candidate.tobytes())
        assert max(xs) - min(xs) >= 31 and max(ys) - min(ys) >= 31
        assert 0.95 <= abs(slope) <= 1.05, f"diagonal mask {mask} slope {slope:.3f} is not 45 degrees"
        assert r_squared >= 0.99, f"diagonal mask {mask} is not a continuous line ({r_squared:.3f})"
        assert 480 <= opaque <= 570, f"diagonal mask {mask} area {opaque} is not a half-tile bank"
        diagonal_metrics[str(mask)] = {"slope": round(slope, 3), "rSquared": round(r_squared, 4), "opaquePixels": opaque}

    # Fully surrounded land with one missing diagonal must show a broad curved bite.
    inner_metrics: dict[str, dict[str, float | int]] = {}
    full = alpha(255)
    for mask in (127, 191, 223, 239):
        difference = ImageChops.difference(full, alpha(mask))
        points = transition_points(alpha(mask))
        xs = [x for x, _ in points]
        ys = [y for _, y in points]
        changed_pixels = sum(value > 32 for value in difference.tobytes())
        _, _, r_squared = regression(points)
        assert changed_pixels >= 60, f"inner curve {mask} removes only {changed_pixels} pixels"
        assert max(xs) - min(xs) >= 8 and max(ys) - min(ys) >= 8, f"inner curve {mask} radius is below 8 pixels"
        assert r_squared <= 0.9, f"inner corner {mask} is too straight ({r_squared:.3f})"
        inner_metrics[str(mask)] = {"changedPixels": changed_pixels, "radiusX": max(xs) - min(xs), "radiusY": max(ys) - min(ys), "lineRSquared": round(r_squared, 4)}

    # The playable opening must contain sustained diagonals in both directions on both banks.
    left, right, early_masks = map_bounds()
    left_runs = [run for run in diagonal_runs(left) if run[1] - run[0] + 1 >= 4]
    right_runs = [run for run in diagonal_runs(right) if run[1] - run[0] + 1 >= 4]
    assert len(left_runs) >= 4, f"only {len(left_runs)} sustained left-bank diagonals"
    assert len(right_runs) >= 4, f"only {len(right_runs)} sustained right-bank diagonals"
    assert {direction for _, _, direction in left_runs} == {-1, 1}
    assert {direction for _, _, direction in right_runs} == {-1, 1}
    for mask in (19, 38, 76, 137, 127, 191, 223, 239):
        assert early_masks.get(mask, 0) >= 4, f"opening contains only {early_masks.get(mask, 0)} instances of visible geometry mask {mask}"

    evidence = render_evidence()
    result = {
        "release": "SkyForge Epoch 18.2",
        "passed": True,
        "diagonalBitPairsTested": len(pair_differences),
        "minimumPairChangedPixels": min(int(item["pixels"]) for item in pair_differences),
        "minimumPairMeanDifference": min(float(item["mean"]) for item in pair_differences),
        "diagonals": diagonal_metrics,
        "innerCurves": inner_metrics,
        "map": {
            "leftDiagonalRuns": left_runs,
            "rightDiagonalRuns": right_runs,
            "earlyMaskCounts": {str(mask): early_masks.get(mask, 0) for mask in (19, 38, 76, 137, 127, 191, 223, 239)},
        },
        "evidenceImage": str(evidence.relative_to(ROOT)),
    }
    output = ROOT / "docs/EPOCH_18_2_BLOB47_GEOMETRY_TEST.json"
    output.write_text(json.dumps(result, indent=2) + "\n")
    print(f"Blob-47 geometry gate passed; wrote {output.relative_to(ROOT)} and {evidence.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
