#!/usr/bin/env python3
"""Render Epoch 18.2 gameplay snapshots and the full Blob-47 reference sheet."""
from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / 'public/assets/terrain'
MAP = json.loads((ROOT / 'src/content/maps/canyon_passage.json').read_text())
MANIFEST = json.loads((ASSET_DIR / 'skyforge_canyon_tileset.json').read_text())
ATLAS = Image.open(ASSET_DIR / 'skyforge_canyon_terrain.png').convert('RGBA')
WATER_SHEET = Image.open(ASSET_DIR / 'skyforge_canyon_water.png').convert('RGBA')
WATER = WATER_SHEET.crop((0, 0, MANIFEST['planes']['river']['frameWidth'], MANIFEST['planes']['river']['frameHeight']))
SANDSTONE = Image.open(ASSET_DIR / 'skyforge_canyon_sandstone.png').convert('RGBA')
TILE = 32
WIDTH = 544
HEIGHT = 960



def stable_index(x: int, row: int, salt: int, length: int) -> int:
    if length <= 1:
        return 0
    value = ((x + 1) * 0x45D9F3B) ^ ((row + 1) * 0x119DE1F3) ^ salt
    value = ((value ^ (value >> 16)) * 0x45D9F3B) & 0xFFFFFFFF
    return value % length


def choose_frame(mapping: dict[str, int | list[int]], mask: int, x: int, row: int, salt: int) -> int:
    choice = mapping[str(mask)]
    if isinstance(choice, list):
        return choice[stable_index(x, row, salt, len(choice))]
    return choice

def atlas_frame(index: int) -> Image.Image:
    x = (index % 16) * TILE
    y = (index // 16) * TILE
    return ATLAS.crop((x, y, x + TILE, y + TILE))


def tile_background(target: Image.Image, texture: Image.Image, offset_x: int, offset_y: int) -> None:
    tw, th = texture.size
    for y in range(-th + offset_y % th, target.height, th):
        for x in range(-tw + offset_x % tw, target.width, tw):
            target.alpha_composite(texture, (x, y))


def render_snapshot(start_row: int) -> Image.Image:
    image = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 255))
    tile_background(image, WATER, 0, -(start_row * TILE))
    layers = {layer['id']: layer for layer in MAP['layers']}
    lookups = {layer_id: {(cell['x'], cell['row']): cell for cell in layer['cells']} for layer_id, layer in layers.items() if layer['renderMode'] != 'tileSprite'}
    frames = MANIFEST['terrain']['frames']

    land = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
    tile_background(land, SANDSTONE, 0, -(start_row * TILE))
    mask = Image.new('L', (WIDTH, HEIGHT), 0)
    for screen_row in range(30):
        world_row = start_row + (29 - screen_row)
        if not 0 <= world_row < MAP['rows']:
            continue
        for x in range(17):
            cell = lookups['sandstone_surface'].get((x, world_row))
            if not cell:
                continue
            alpha = atlas_frame(choose_frame(frames['sandstoneBoundaryBlob47'], cell['variant'], x, world_row, 0xB047)).getchannel('A')
            mask.paste(alpha, (x * TILE, screen_row * TILE))
    land.putalpha(mask)
    image.alpha_composite(land)

    material_groups = {
        'rock_clusters': frames['rockClusters'], 'cracks': frames['cracks'],
        'scrub': frames['scrub'], 'sediment': frames['sediment'],
    }
    for screen_row in range(30):
        world_row = start_row + (29 - screen_row)
        if not 0 <= world_row < MAP['rows']:
            continue
        for x in range(17):
            px, py = x * TILE, screen_row * TILE
            for layer_id in ('sediment', 'shoreline', 'rock_clusters', 'cracks', 'scrub', 'landmarks'):
                cell = lookups[layer_id].get((x, world_row))
                if not cell:
                    continue
                if cell.get('frame') is not None:
                    frame_index = cell['frame']
                elif layer_id == 'shoreline':
                    frame_index = choose_frame(frames['shorelineBlob47'], cell['variant'], x, world_row, 0x5A0E)
                elif layer_id == 'landmarks':
                    group = frames['metalPlatform'] if cell['tile'] == 6 else frames['ruins']
                    frame_index = group[(x * 17 + world_row * 7) % len(group)]
                else:
                    group = material_groups[layer_id]
                    frame_index = group[(x * 17 + world_row * 7) % len(group)]
                image.alpha_composite(atlas_frame(frame_index), (px, py))
    draw = ImageDraw.Draw(image, 'RGBA')
    cx, cy = WIDTH // 2, 700
    draw.polygon([(cx + 10, cy + 1), (cx - 7, cy + 21), (cx + 27, cy + 21)], fill=(0, 0, 0, 28))
    draw.polygon([(cx + 10, cy + 4), (cx - 3, cy + 19), (cx + 23, cy + 19)], fill=(0, 0, 0, 75))
    draw.polygon([(cx, cy - 18), (cx - 14, cy + 12), (cx + 14, cy + 12)], fill=(255, 255, 255, 255))
    draw.rectangle((4, 4, 190, 28), fill=(0, 0, 0, 160))
    draw.text((10, 9), f'Epoch 18.2 world rows {start_row}-{start_row + 29}', fill=(255, 255, 255, 255))
    return image


def render_blob47_sheet() -> Image.Image:
    mappings = MANIFEST['terrain']['frames']['shorelineBlob47']
    boundary = MANIFEST['terrain']['frames']['sandstoneBoundaryBlob47']
    masks = sorted((int(mask), frame) for mask, frame in mappings.items())
    cell, columns = 72, 8
    rows = (len(masks) + columns - 1) // columns
    sheet = Image.new('RGBA', (columns * cell, rows * cell), (21, 31, 42, 255))
    draw = ImageDraw.Draw(sheet)
    stone_tile = SANDSTONE.crop((96, 96, 128, 128))
    for index, (mask_value, shore_frame) in enumerate(masks):
        x, y = (index % columns) * cell, (index // columns) * cell
        tile = Image.new('RGBA', (TILE, TILE), (27, 78, 123, 255))
        boundary_choice = boundary[str(mask_value)]
        boundary_frame = boundary_choice[0] if isinstance(boundary_choice, list) else boundary_choice
        shape = atlas_frame(boundary_frame).getchannel('A')
        fill = stone_tile.copy(); fill.putalpha(shape)
        shore_choice = shore_frame[0] if isinstance(shore_frame, list) else shore_frame
        tile.alpha_composite(fill); tile.alpha_composite(atlas_frame(shore_choice))
        sheet.alpha_composite(tile.resize((48, 48), Image.Resampling.NEAREST), (x + 12, y + 4))
        draw.text((x + 5, y + 55), f'{mask_value:03}', fill=(235, 235, 235, 255))
    return sheet


def main() -> None:
    starts = [10, 72, 125, 286]
    montage = Image.new('RGBA', (WIDTH * len(starts), HEIGHT), (0, 0, 0, 255))
    for index, start in enumerate(starts): montage.alpha_composite(render_snapshot(start), (index * WIDTH, 0))
    preview = ROOT / 'docs/EPOCH_18_2_CANYON_PREVIEW.png'; montage.save(preview, optimize=True)
    sheet = ROOT / 'docs/EPOCH_18_2_BLOB47_REFERENCE.png'; render_blob47_sheet().save(sheet, optimize=True)
    print(f'Wrote {preview.relative_to(ROOT)}'); print(f'Wrote {sheet.relative_to(ROOT)}')


if __name__ == '__main__': main()
