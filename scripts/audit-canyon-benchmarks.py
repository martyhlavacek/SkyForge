#!/usr/bin/env python3
"""Objective release gate supporting the Epoch 18.2 visual benchmark audit.

The final 1-10 scores remain an art-direction judgment documented in the audit
report. This script verifies the measurable conditions that judgment depends on
and fails the release if the locked rubric average is below 8.5.
"""
from __future__ import annotations

import json
import math
import re
from collections import deque
from pathlib import Path

from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / 'public/assets/terrain'
MANIFEST = json.loads((ASSET_DIR / 'skyforge_canyon_tileset.json').read_text())
MAP = json.loads((ROOT / 'src/content/maps/canyon_passage.json').read_text())
GEOMETRY = json.loads((ROOT / 'docs/EPOCH_18_2_BLOB47_GEOMETRY_TEST.json').read_text())
RUBRIC = json.loads((ROOT / 'docs/EPOCH_18_2_MANUAL_RUBRIC.json').read_text())


def edge_difference(image: Image.Image) -> tuple[int, int]:
    image = image.convert('RGBA')
    width, height = image.size
    horizontal = max(
        abs(image.getpixel((0, y))[channel] - image.getpixel((width - 1, y))[channel])
        for y in range(height)
        for channel in range(4)
    )
    vertical = max(
        abs(image.getpixel((x, 0))[channel] - image.getpixel((x, height - 1))[channel])
        for x in range(width)
        for channel in range(4)
    )
    return horizontal, vertical


def gradient_ratio(image: Image.Image) -> float:
    gray = image.convert('L')
    px = gray.load()
    horizontal = vertical = 0.0
    count = 0
    for y in range(gray.height - 1):
        for x in range(gray.width - 1):
            horizontal += abs(px[x + 1, y] - px[x, y])
            vertical += abs(px[x, y + 1] - px[x, y])
            count += 1
    horizontal /= count
    vertical /= count
    return max(horizontal, vertical) / max(min(horizontal, vertical), 1e-6)


def mean_shift_difference(image: Image.Image, dx: int, dy: int) -> float:
    return ImageStat.Stat(
        ImageChops.difference(image, ImageChops.offset(image, dx, dy)).convert('L')
    ).mean[0]


def connected_components(cells: set[tuple[int, int]]) -> list[set[tuple[int, int]]]:
    remaining = set(cells)
    components: list[set[tuple[int, int]]] = []
    while remaining:
        start = remaining.pop()
        component = {start}
        queue = deque([start])
        while queue:
            x, row = queue.popleft()
            for candidate in ((x, row - 1), (x + 1, row), (x, row + 1), (x - 1, row)):
                if candidate in remaining:
                    remaining.remove(candidate)
                    component.add(candidate)
                    queue.append(candidate)
        components.append(component)
    return components


def max_row_gap(cells: list[dict[str, int]], final_row: int) -> int:
    rows = sorted(set(cell['row'] for cell in cells))
    if not rows:
        return final_row + 1
    gaps = [rows[0], final_row - rows[-1]]
    gaps.extend(b - a for a, b in zip(rows, rows[1:]))
    return max(gaps)


def main() -> None:
    planes = {plane['materialId']: plane for plane in MANIFEST['runtimePlanes']}
    water_plane = planes['river']
    water_sheet = Image.open(ASSET_DIR / 'skyforge_canyon_water.png').convert('RGBA')
    water_frames = []
    for index in water_plane['animationFrames']:
        x = (index % water_plane['columns']) * water_plane['frameWidth']
        y = (index // water_plane['columns']) * water_plane['frameHeight']
        water_frames.append(
            water_sheet.crop(
                (x, y, x + water_plane['frameWidth'], y + water_plane['frameHeight'])
            )
        )
    sandstone = Image.open(ASSET_DIR / 'skyforge_canyon_sandstone.png').convert('RGBA')

    layers = {layer['id']: layer for layer in MAP['layers']}
    surface_cells = layers['sandstone_surface']['cells']
    occupied = {(cell['x'], cell['row']) for cell in surface_cells}
    island_sizes = sorted(
        len(component)
        for component in connected_components(occupied)
        if not any(x in (0, 16) for x, _ in component)
    )

    centers: list[float] = []
    widths: list[int] = []
    for row in range(MAP['rows']):
        water_xs = [x for x in range(17) if (x, row) not in occupied]
        if water_xs:
            centers.append((min(water_xs) + max(water_xs)) / 2)
            widths.append(max(water_xs) - min(water_xs) + 1)

    boundary = MANIFEST['terrain']['frames']['sandstoneBoundaryBlob47']
    shoreline = MANIFEST['terrain']['frames']['shorelineBlob47']
    water_stats = [
        {
            'edgeDifference': edge_difference(frame),
            'gradientRatio': round(gradient_ratio(frame), 4),
            'contrast': round(ImageStat.Stat(frame.convert('L')).stddev[0], 4),
            'shift32X': round(mean_shift_difference(frame, 32, 0), 4),
            'shift32Y': round(mean_shift_difference(frame, 0, 32), 4),
        }
        for frame in water_frames
    ]

    player_config = (ROOT / 'src/game/config/playerConfig.ts').read_text()
    shadow_values = {
        key: float(re.search(rf'{key}:\s*([0-9.]+)', player_config).group(1))
        for key in ('shadowOffsetX', 'shadowOffsetY', 'shadowScaleX', 'shadowScaleY', 'shadowOpacity')
    }
    preload = (ROOT / 'src/game/scenes/PreloadScene.ts').read_text()

    metrics = {
        'blob47': {
            'canonicalMasks': len(boundary),
            'boundaryVariantsPerMask': min(len(value) if isinstance(value, list) else 1 for value in boundary.values()),
            'shorelineVariantsPerMask': min(len(value) if isinstance(value, list) else 1 for value in shoreline.values()),
        },
        'water': {
            'explicitCells': len(layers['river_plane']['cells']),
            'frameSize': [water_plane['frameWidth'], water_plane['frameHeight']],
            'frameCount': len(water_frames),
            'animationFps': water_plane['animationFps'],
            'frames': water_stats,
        },
        'sandstone': {
            'size': list(sandstone.size),
            'edgeDifference': edge_difference(sandstone),
            'contrast': round(ImageStat.Stat(sandstone.convert('L')).stddev[0], 4),
            'shift32X': round(mean_shift_difference(sandstone, 32, 0), 4),
            'shift128X': round(mean_shift_difference(sandstone, 128, 0), 4),
            'shift128Y': round(mean_shift_difference(sandstone, 0, 128), 4),
        },
        'composition': {
            'islandCount': len(island_sizes),
            'islandSizes': island_sizes,
            'centerRange': round(max(centers) - min(centers), 2),
            'waterWidthRange': [min(widths), max(widths)],
            'landmarkCells': len(layers['landmarks']['cells']),
            'landmarkMaxRowGap': max_row_gap(layers['landmarks']['cells'], MAP['rows'] - 1),
            'decorationCells': {
                name: len(layers[name]['cells'])
                for name in ('sediment', 'rock_clusters', 'cracks', 'scrub', 'landmarks')
            },
        },
        'readability': {
            'waterLuminance': round(ImageStat.Stat(water_frames[0].convert('L')).mean[0], 2),
            'sandstoneLuminance': round(ImageStat.Stat(sandstone.convert('L')).mean[0], 2),
        },
        'blob47Geometry': GEOMETRY,
        'playerShadow': {
            **shadow_values,
            'dedicatedTexture': 'TEX.PLAYER_SHADOW' in preload,
            'layeredSilhouette': preload.count('fillTriangle') >= 4,
        },
    }

    assertions = [
        metrics['blob47']['canonicalMasks'] == 47,
        metrics['blob47']['boundaryVariantsPerMask'] >= 4,
        metrics['blob47']['shorelineVariantsPerMask'] >= 4,
        metrics['water']['explicitCells'] == 0,
        metrics['water']['frameSize'] == [512, 512],
        metrics['water']['frameCount'] >= 3,
        all(frame['edgeDifference'] == (0, 0) for frame in water_stats),
        all(frame['gradientRatio'] <= 1.12 for frame in water_stats),
        metrics['sandstone']['size'] == [512, 512],
        metrics['sandstone']['edgeDifference'] == (0, 0),
        metrics['sandstone']['shift32X'] > 4.0,
        metrics['sandstone']['shift128X'] > 6.8,
        metrics['composition']['islandCount'] >= 4,
        min(metrics['composition']['islandSizes']) >= 80,
        metrics['composition']['centerRange'] >= 3.5,
        metrics['composition']['waterWidthRange'][1] - metrics['composition']['waterWidthRange'][0] >= 6,
        metrics['composition']['landmarkCells'] >= 175,
        metrics['composition']['landmarkMaxRowGap'] <= 80,
        metrics['readability']['sandstoneLuminance'] - metrics['readability']['waterLuminance'] >= 38,
        metrics['playerShadow']['dedicatedTexture'],
        metrics['playerShadow']['layeredSilhouette'],
        GEOMETRY['passed'] is True,
        GEOMETRY['minimumPairChangedPixels'] >= 60,
        GEOMETRY['minimumPairMeanDifference'] >= 13.0,
        all(value['rSquared'] >= 0.99 for value in GEOMETRY['diagonals'].values()),
        all(value['radiusX'] >= 8 and value['radiusY'] >= 8 for value in GEOMETRY['innerCurves'].values()),
        len(GEOMETRY['map']['leftDiagonalRuns']) >= 4,
        len(GEOMETRY['map']['rightDiagonalRuns']) >= 4,
    ]
    if not all(assertions):
        failed = [index + 1 for index, passed in enumerate(assertions) if not passed]
        raise SystemExit(f'Benchmark audit objective gate failed checks: {failed}')

    scores = RUBRIC['scores']
    average = round(sum(scores.values()) / len(scores), 2)
    if abs(average - float(RUBRIC['average'])) > 0.001:
        raise SystemExit('Manual rubric average does not match its category scores')
    if average < float(RUBRIC['requiredAverage']):
        raise SystemExit(f'Benchmark score {average:.2f} is below the required {RUBRIC["requiredAverage"]:.2f}')

    result = {
        'release': 'SkyForge Epoch 18.2',
        'rubricVersion': RUBRIC['rubricVersion'],
        'scoreType': RUBRIC['method'],
        'scores': scores,
        'average': average,
        'requiredAverage': RUBRIC['requiredAverage'],
        'passed': True,
        'metrics': metrics,
    }
    output = ROOT / 'docs/EPOCH_18_2_BENCHMARK_AUDIT.json'
    output.write_text(json.dumps(result, indent=2) + '\n')
    print(f'Benchmark audit passed at {average:.2f}/10; wrote {output.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
