#!/usr/bin/env python3
"""Pixel-level and structural verification for the benchmark-audited canyon art."""
from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / 'public/assets/terrain'
MANIFEST = json.loads((ASSET_DIR / 'skyforge_canyon_tileset.json').read_text())
TILE = MANIFEST['terrain']['tileSize']
COLUMNS = MANIFEST['terrain']['columns']


def max_edge_difference(image: Image.Image) -> tuple[int, int]:
    rgba = image.convert('RGBA')
    width, height = rgba.size
    horizontal = max(
        abs(rgba.getpixel((0, y))[channel] - rgba.getpixel((width - 1, y))[channel])
        for y in range(height)
        for channel in range(4)
    )
    vertical = max(
        abs(rgba.getpixel((x, 0))[channel] - rgba.getpixel((x, height - 1))[channel])
        for x in range(width)
        for channel in range(4)
    )
    return horizontal, vertical


def atlas_frame(atlas: Image.Image, index: int) -> Image.Image:
    x = (index % COLUMNS) * TILE
    y = (index // COLUMNS) * TILE
    return atlas.crop((x, y, x + TILE, y + TILE))


def gradient_energy(image: Image.Image) -> tuple[float, float]:
    gray = image.convert('L')
    px = gray.load()
    horizontal = vertical = 0.0
    count = 0
    for y in range(gray.height - 1):
        for x in range(gray.width - 1):
            horizontal += abs(px[x + 1, y] - px[x, y])
            vertical += abs(px[x, y + 1] - px[x, y])
            count += 1
    return horizontal / count, vertical / count


def mean_shift_difference(image: Image.Image, x_offset: int = 0, y_offset: int = 0) -> float:
    shifted = ImageChops.offset(image, x_offset, y_offset)
    return ImageStat.Stat(ImageChops.difference(image, shifted).convert('L')).mean[0]


def all_frames(mapping: dict[str, int | list[int]]) -> list[int]:
    return [frame for value in mapping.values() for frame in (value if isinstance(value, list) else [value])]


def main() -> None:
    planes = {plane['materialId']: plane for plane in MANIFEST['runtimePlanes']}
    water_plane = planes['river']
    water_sheet = Image.open(ASSET_DIR / 'skyforge_canyon_water.png').convert('RGBA')
    frame_width = water_plane['frameWidth']
    frame_height = water_plane['frameHeight']
    assert water_sheet.size == (frame_width * water_plane['columns'], frame_height * water_plane['rows'])
    for index in water_plane['animationFrames']:
        candidate = water_sheet.crop(
            (
                (index % water_plane['columns']) * frame_width,
                (index // water_plane['columns']) * frame_height,
                (index % water_plane['columns'] + 1) * frame_width,
                (index // water_plane['columns'] + 1) * frame_height,
            )
        )
        assert max_edge_difference(candidate) == (0, 0), f'water frame {index} is not wrapped'
        horizontal, vertical = gradient_energy(candidate)
        ratio = max(horizontal, vertical) / max(min(horizontal, vertical), 1e-6)
        contrast = ImageStat.Stat(candidate.convert('L')).stddev[0]
        assert ratio <= 1.12, f'water frame {index} has directional gradient ratio {ratio:.2f}'
        assert 2.8 <= contrast <= 5.5, f'water frame {index} contrast {contrast:.2f} is outside the quiet field target'
        assert mean_shift_difference(candidate, 32, 0) >= 2.0, 'water repeats too closely at one tile horizontally'
        assert mean_shift_difference(candidate, 0, 32) >= 1.9, 'water repeats too closely at one tile vertically'

    sandstone_plane = planes['sandstone']
    sandstone = Image.open(ASSET_DIR / 'skyforge_canyon_sandstone.png').convert('RGBA')
    assert sandstone.size == (sandstone_plane['frameWidth'], sandstone_plane['frameHeight'])
    assert sandstone.size == (512, 512)
    assert max_edge_difference(sandstone) == (0, 0), 'sandstone plane is not wrapped'
    assert mean_shift_difference(sandstone, 32, 0) > 4.0, 'sandstone repeats too closely at one tile'
    assert mean_shift_difference(sandstone, 128, 0) > 6.8, 'sandstone lacks large-scale horizontal variation'
    assert mean_shift_difference(sandstone, 0, 128) > 6.0, 'sandstone lacks large-scale vertical variation'

    atlas = Image.open(ASSET_DIR / 'skyforge_canyon_terrain.png').convert('RGBA')
    expected_size = (COLUMNS * TILE, MANIFEST['terrain']['rows'] * TILE)
    assert atlas.size == expected_size

    boundary_frames = MANIFEST['terrain']['frames']['sandstoneBoundaryBlob47']
    shoreline_frames = MANIFEST['terrain']['frames']['shorelineBlob47']
    assert len(boundary_frames) == 47 and len(shoreline_frames) == 47
    assert all(len(value) == 4 for value in boundary_frames.values())
    assert all(len(value) == 4 for value in shoreline_frames.values())

    for mapping_name, mapping in [('boundary', boundary_frames), ('shoreline', shoreline_frames)]:
        for mask_text, values in mapping.items():
            frames = values if isinstance(values, list) else [values]
            alpha_counts = []
            for frame_index in frames:
                alpha = atlas_frame(atlas, frame_index).getchannel('A')
                alpha_counts.append(sum(1 for value in alpha.tobytes() if value > 0))
            if mapping_name == 'shoreline':
                assert max(alpha_counts) < TILE * TILE * 0.72, f'shoreline mask {mask_text} fills too much of its tile'
                if mask_text == '255':
                    assert max(alpha_counts) == 0, 'fully surrounded shoreline frames must be transparent'

    expected_groups = {
        'rockClusters': 8,
        'cracks': 12,
        'scrub': 10,
        'sediment': 10,
        'ruins': 20,
        'metalPlatform': 29,
    }
    for group, expected in expected_groups.items():
        frames = MANIFEST['terrain']['frames'][group]
        assert len(frames) == expected, f'{group} expected {expected} frames, found {len(frames)}'
        if group in {'rockClusters', 'cracks', 'scrub'}:
            assert all(
                sum(1 for value in atlas_frame(atlas, index).getchannel('A').tobytes() if value > 0)
                < TILE * TILE * 0.5
                for index in frames
            )
        if group == 'sediment':
            assert all(
                sum(1 for value in atlas_frame(atlas, index).getchannel('A').tobytes() if value > 0)
                < TILE * TILE * 0.65
                for index in frames
            )

    print(
        'Canyon texture verification passed: 512px seamless planes, balanced water, '
        'four-variant Blob-47 masks, thin shoreline, and complete decoration groups.'
    )


if __name__ == '__main__':
    main()
