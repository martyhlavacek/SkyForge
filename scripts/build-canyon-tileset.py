#!/usr/bin/env python3
"""Build the Epoch 18 canyon environment textures.

The environment is deliberately layered:
- one quiet 256x256 animated water plane;
- one seamless 256x256 sandstone field split into coordinated 32px frames;
- 47 neutral sandstone boundary masks;
- 47 thin shoreline lip/undercut overlays;
- transparent rock, crack, scrub, sediment, ruin, and platform decorations.

The larger source fields and sparse independent decorations conceal the 32px
rendering grid while retaining deterministic Blob-47 topology.
"""
from __future__ import annotations

import hashlib
import json
import math
import random
from functools import lru_cache
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art-source" / "skyforge_canyon_master.png"
OUT_DIR = ROOT / "public" / "assets" / "terrain"
TERRAIN_OUT = OUT_DIR / "skyforge_canyon_terrain.png"
WATER_OUT = OUT_DIR / "skyforge_canyon_water.png"
SANDSTONE_OUT = OUT_DIR / "skyforge_canyon_sandstone.png"
PROPS_OUT = OUT_DIR / "skyforge_canyon_props.png"
MANIFEST_OUT = OUT_DIR / "skyforge_canyon_tileset.json"

TILE = 32
METATILE = 512
ATLAS_COLUMNS = 16
SOURCE_X = [9, 91, 173, 255, 337, 419, 501, 583, 665, 746, 828, 910, 992, 1074, 1156]
SOURCE_Y = [8, 91, 173, 255, 337, 419, 501, 583, 665, 746, 828]
LOWER_Y = [910, 990, 1099, 1177]
SOURCE_CROP = 74


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def normalize(tile: Image.Image) -> Image.Image:
    return tile.resize((TILE, TILE), resample=Image.Resampling.LANCZOS)


def regular(master: Image.Image, row: int, column: int) -> Image.Image:
    x = SOURCE_X[column] + 1
    y = SOURCE_Y[row] + 1
    return normalize(master.crop((x, y, x + SOURCE_CROP, y + SOURCE_CROP)))


def lower(master: Image.Image, row: int, column: int, transparent_black: bool = False) -> Image.Image:
    x = SOURCE_X[column] + 1
    y = LOWER_Y[row] + 1
    tile = normalize(master.crop((x, y, x + SOURCE_CROP, y + SOURCE_CROP)))
    if transparent_black:
        pixels = tile.load()
        for py in range(tile.height):
            for px in range(tile.width):
                if max(pixels[px, py][:3]) < 10:
                    pixels[px, py] = (0, 0, 0, 0)
    return tile


def blank() -> Image.Image:
    return Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0))


def force_wrap_edges(image: Image.Image) -> Image.Image:
    pixels = image.load()
    width, height = image.size
    for y in range(height):
        pixels[width - 1, y] = pixels[0, y]
    for x in range(width):
        pixels[x, height - 1] = pixels[x, 0]
    return image


def draw_wrapped_ellipse(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    fill: tuple[int, int, int, int],
) -> None:
    x0, y0, x1, y1 = box
    for dx in (-METATILE, 0, METATILE):
        for dy in (-METATILE, 0, METATILE):
            draw.ellipse((x0 + dx, y0 + dy, x1 + dx, y1 + dy), fill=fill)


def draw_wrapped_polygon(
    draw: ImageDraw.ImageDraw,
    points: list[tuple[float, float]],
    fill: tuple[int, int, int, int],
) -> None:
    for dx in (-METATILE, 0, METATILE):
        for dy in (-METATILE, 0, METATILE):
            draw.polygon([(x + dx, y + dy) for x, y in points], fill=fill)


def periodic_field(x: float, y: float, phase: float, components: list[tuple[int, int, float, float]]) -> float:
    value = 0.0
    for kx, ky, amplitude, speed in components:
        value += amplitude * math.sin(math.tau * (kx * x + ky * y + phase * speed))
    return value



def feather_mask(size: int, edge: int = 12, peak: int = 220) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    pixels = mask.load()
    radius = size / 2
    inner = max(1.0, radius - edge)
    for y in range(size):
        for x in range(size):
            dx = (x + 0.5 - radius) / radius
            dy = (y + 0.5 - radius) / radius
            distance = (dx * dx + dy * dy) ** 0.5
            if distance >= 1:
                alpha = 0
            elif distance <= inner / radius:
                alpha = peak
            else:
                t = (1 - distance) / max(0.001, 1 - inner / radius)
                alpha = int(peak * t * t * (3 - 2 * t))
            pixels[x, y] = alpha
    return mask


def wrap_composite(canvas: Image.Image, patch: Image.Image, x: int, y: int, mask: Image.Image | None = None) -> None:
    width, height = canvas.size
    for dx in (-width, 0, width):
        for dy in (-height, 0, height):
            px, py = x + dx, y + dy
            if px >= width or py >= height or px + patch.width <= 0 or py + patch.height <= 0:
                continue
            canvas.alpha_composite(patch if mask is None else Image.composite(patch, Image.new("RGBA", patch.size), mask), (px, py))


def transformed_tile(tile: Image.Image, rng: random.Random, scale: int) -> Image.Image:
    result = tile
    if rng.random() < 0.5:
        result = result.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    if rng.random() < 0.35:
        result = result.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    if rng.random() < 0.22:
        result = result.rotate(rng.choice((90, 180, 270)))
    return result.resize((scale, scale), Image.Resampling.NEAREST)


def patchwork_field(
    tiles: list[Image.Image],
    seed: int,
    background: tuple[int, int, int, int],
    patch_size: int,
    stride: int,
    edge: int,
) -> Image.Image:
    rng = random.Random(seed)
    canvas = Image.new("RGBA", (METATILE, METATILE), background)
    mask = feather_mask(patch_size, edge=edge, peak=205)
    for y in range(-patch_size, METATILE + patch_size, stride):
        for x in range(-patch_size, METATILE + patch_size, stride):
            tile = transformed_tile(rng.choice(tiles), rng, patch_size)
            # Small deterministic offsets defeat a visible patch lattice.
            px = x + rng.randrange(-stride // 3, stride // 3 + 1)
            py = y + rng.randrange(-stride // 3, stride // 3 + 1)
            wrap_composite(canvas, tile, px, py, mask)
    return canvas



def water_base(master: Image.Image) -> Image.Image:
    """Tileable low-frequency water field with sparse source-art ripples."""
    image = Image.new("RGBA", (METATILE, METATILE), (0, 0, 0, 255))
    pixels = image.load()
    components = [
        (1, 0, 0.34, 0.0),
        (0, 1, 0.31, 0.0),
        (1, 2, 0.20, 0.0),
        (2, -1, 0.18, 0.0),
        (3, 1, 0.11, 0.0),
        (-1, 3, 0.10, 0.0),
        (5, -4, 0.055, 0.0),
    ]
    for py in range(METATILE):
        y = py / METATILE
        for px in range(METATILE):
            x = px / METATILE
            broad = periodic_field(x, y, 0.0, components)
            mottling = math.sin(math.tau * (2 * x + 0.17)) * math.sin(math.tau * (2 * y - 0.11))
            hashed = ((px * 73856093) ^ (py * 19349663) ^ ((px + py) * 83492791)) & 255
            grain = hashed / 255.0 - 0.5
            value = 0.82 * broad + 0.18 * mottling
            pixels[px, py] = (
                max(10, min(38, int(18 + value * 6 + grain * 3))),
                max(48, min(96, int(68 + value * 11 + grain * 5))),
                max(83, min(148, int(111 + value * 16 + grain * 7))),
                255,
            )

    rng = random.Random(0x51A7E)
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    # Small broken ripple arcs imitate the restrained stipple/ripple treatment in classic shooters.
    for _ in range(72):
        cx, cy = rng.randrange(METATILE), rng.randrange(METATILE)
        rx, ry = rng.randrange(3, 10), rng.randrange(2, 6)
        alpha = rng.randrange(18, 48)
        for dx in (-METATILE, 0, METATILE):
            for dy in (-METATILE, 0, METATILE):
                draw.arc((cx-rx+dx, cy-ry+dy, cx+rx+dx, cy+ry+dy), rng.randrange(185, 230), rng.randrange(300, 345), fill=(120, 190, 213, alpha), width=1)
    image.alpha_composite(overlay.filter(ImageFilter.GaussianBlur(0.7)))
    return force_wrap_edges(image)


def water_frame(master: Image.Image, phase_index: int) -> Image.Image:
    base = water_base(master)
    offsets = ((0, 0), (5, 2), (10, 5))
    dx, dy = offsets[phase_index % len(offsets)]
    image = ImageChops.offset(base, dx, dy)
    glints = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glints, "RGBA")
    rng = random.Random(0xB100 + phase_index)
    for _ in range(92):
        x = rng.randrange(METATILE)
        y = rng.randrange(METATILE)
        length = rng.randrange(2, 8)
        alpha = rng.randrange(22, 55)
        color = rng.choice(((143, 201, 219, alpha), (91, 169, 199, alpha), (198, 229, 233, alpha)))
        for wx in (-METATILE, 0, METATILE):
            for wy in (-METATILE, 0, METATILE):
                draw.line((x + wx, y + wy, x + length + wx, y + rng.choice((-1, 0, 0, 1)) + wy), fill=color, width=1)
    image.alpha_composite(glints)
    return force_wrap_edges(image)


def sandstone_metatile(master: Image.Image) -> Image.Image:
    """Continuous desert stone: broad colour fields plus sparse source-art detail."""
    image = Image.new("RGBA", (METATILE, METATILE), (0, 0, 0, 255))
    pixels = image.load()
    components = [
        (1, 0, 0.38, 0.0),
        (0, 1, 0.34, 0.0),
        (1, 1, 0.25, 0.0),
        (2, -1, 0.20, 0.0),
        (3, 2, 0.13, 0.0),
        (-2, 4, 0.10, 0.0),
        (6, -3, 0.06, 0.0),
    ]
    for py in range(METATILE):
        y = py / METATILE
        for px in range(METATILE):
            x = px / METATILE
            field = periodic_field(x, y, 0.0, components)
            cellular = math.sin(math.tau * (5 * x + 7 * y)) * math.sin(math.tau * (8 * x - 3 * y))
            broad_patch = math.cos(math.tau * (x - 0.15)) * math.cos(math.tau * (y + 0.08))
            value = 0.64 * field + 0.19 * cellular + 0.17 * broad_patch
            hashed = ((px * 73856093) ^ (py * 19349663) ^ ((px + py) * 83492791)) & 255
            grain = hashed / 255.0 - 0.5
            pixels[px, py] = (
                max(112, min(202, int(157 + value * 27 + grain * 11))),
                max(56, min(119, int(87 + value * 17 + grain * 7))),
                max(28, min(73, int(47 + value * 10 + grain * 5))),
                255,
            )

    rng = random.Random(0xA11C0)
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    for _ in range(38):
        cx, cy = rng.randrange(METATILE), rng.randrange(METATILE)
        rx, ry = rng.randrange(20, 76), rng.randrange(14, 56)
        tone = rng.choice(((76, 38, 24, 18), (229, 143, 75, 17), (112, 57, 31, 15)))
        draw_wrapped_ellipse(draw, (cx - rx, cy - ry, cx + rx, cy + ry), tone)
    image.alpha_composite(overlay.filter(ImageFilter.GaussianBlur(11)))

    details = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(details, "RGBA")
    for _ in range(560):
        x, y = rng.randrange(METATILE), rng.randrange(METATILE)
        draw.point((x, y), fill=rng.choice(((65, 34, 23, 70), (232, 155, 84, 64), (116, 60, 33, 60))))
    for _ in range(42):
        x, y = rng.randrange(12, METATILE - 12), rng.randrange(8, METATILE - 48)
        points = [(x, y)]
        for _ in range(rng.randrange(2, 5)):
            x = max(4, min(METATILE - 5, x + rng.randrange(-7, 8)))
            y = min(METATILE - 5, y + rng.randrange(3, 10))
            points.append((x, y))
        draw.line(points, fill=(60, 32, 24, rng.randrange(52, 92)), width=1)
    image.alpha_composite(details)
    return force_wrap_edges(image)


def boundary_textures(sandstone: Image.Image) -> list[Image.Image]:
    offsets = ((37, 53), (211, 147), (354, 291), (122, 372))
    textures: list[Image.Image] = []
    for x, y in offsets:
        crop = Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0))
        for py in range(TILE):
            for px in range(TILE):
                crop.putpixel((px, py), sandstone.getpixel(((x + px) % METATILE, (y + py) % METATILE)))
        textures.append(crop)
    return textures


def normalize_blob47(mask: int) -> int:
    normalized = mask & 0x0F
    if mask & 16 and normalized & 1 and normalized & 2:
        normalized |= 16
    if mask & 32 and normalized & 2 and normalized & 4:
        normalized |= 32
    if mask & 64 and normalized & 4 and normalized & 8:
        normalized |= 64
    if mask & 128 and normalized & 8 and normalized & 1:
        normalized |= 128
    return normalized


def valid_blob47_masks() -> list[int]:
    values: list[int] = []
    for candidate in range(256):
        normalized = normalize_blob47(candidate)
        if normalized not in values:
            values.append(normalized)
    return values


def _smoothstep(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


@lru_cache(maxsize=47)
def blob_shape(mask: int) -> Image.Image:
    """Build a visibly curved Blob-47 silhouette from a shared scalar field.

    Each tile quadrant interpolates the occupancy of its diagonal, two cardinal
    neighbours, and the occupied centre cell. This is the canonical quarter-tile
    Blob-47 construction: missing diagonals create large concave curves, isolated
    corners create rounded convex curves, and sequences of cardinal changes form
    continuous diagonal banks rather than square teeth. Supersampling keeps the
    32-pixel runtime tile while retaining a readable 8-10 pixel corner radius.
    """
    mask = normalize_blob47(mask)
    occupancy = {
        (0, 0): 1.0,
        (0, -1): 1.0 if mask & 1 else 0.0,
        (1, 0): 1.0 if mask & 2 else 0.0,
        (0, 1): 1.0 if mask & 4 else 0.0,
        (-1, 0): 1.0 if mask & 8 else 0.0,
        (1, -1): 1.0 if mask & 16 else 0.0,
        (1, 1): 1.0 if mask & 32 else 0.0,
        (-1, 1): 1.0 if mask & 64 else 0.0,
        (-1, -1): 1.0 if mask & 128 else 0.0,
    }
    supersample = 4
    size = TILE * supersample
    high = Image.new("L", (size, size), 0)
    pixels = high.load()

    # The four fully supported convex corner states are true 45-degree banks.
    # Rendering them as full-tile diagonals, rather than quarter-circle shelves,
    # lets successive row/column changes form a continuous diagonal coastline.
    if mask in (19, 38, 76, 137):
        for py in range(size):
            for px in range(size):
                if mask == 19:      # north + east + northeast: upper-right land
                    inside = py <= px
                elif mask == 38:    # east + south + southeast: lower-right land
                    inside = px + py >= size - 1
                elif mask == 76:    # south + west + southwest: lower-left land
                    inside = py >= px
                else:               # north + west + northwest: upper-left land
                    inside = px + py <= size - 1
                pixels[px, py] = 255 if inside else 0
        return high.resize((TILE, TILE), Image.Resampling.LANCZOS)

    threshold = 0.55
    for py in range(size):
        gy = (py + 0.5) / size - 0.5
        if gy < 0:
            y0, y1 = -1, 0
            v = _smoothstep((gy + 0.5) / 0.5)
        else:
            y0, y1 = 0, 1
            v = _smoothstep(gy / 0.5)
        for px in range(size):
            gx = (px + 0.5) / size - 0.5
            if gx < 0:
                x0, x1 = -1, 0
                u = _smoothstep((gx + 0.5) / 0.5)
            else:
                x0, x1 = 0, 1
                u = _smoothstep(gx / 0.5)
            field = (
                (1.0 - u) * (1.0 - v) * occupancy.get((x0, y0), 0.0)
                + u * (1.0 - v) * occupancy.get((x1, y0), 0.0)
                + (1.0 - u) * v * occupancy.get((x0, y1), 0.0)
                + u * v * occupancy.get((x1, y1), 0.0)
            )
            pixels[px, py] = 255 if field >= threshold else 0
    return high.resize((TILE, TILE), Image.Resampling.LANCZOS)


def exposed_boundary(shape: Image.Image, cardinal_mask: int) -> Image.Image:
    source = shape.load()
    edge = Image.new("L", (TILE, TILE), 0)
    target = edge.load()
    for y in range(TILE):
        for x in range(TILE):
            if source[x, y] == 0:
                continue
            for dx, dy, bit in ((0, -1, 1), (1, 0, 2), (0, 1, 4), (-1, 0, 8)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < TILE and 0 <= ny < TILE:
                    if source[nx, ny] == 0:
                        target[x, y] = 255
                        break
                elif cardinal_mask & bit == 0:
                    target[x, y] = 255
                    break
    return edge


def boundary_fill(mask: int, texture: Image.Image) -> Image.Image:
    result = texture.copy()
    result.putalpha(blob_shape(mask))
    return result



def shifted_mask(mask: Image.Image, dx: int, dy: int) -> Image.Image:
    shifted = Image.new("L", mask.size, 0)
    shifted.paste(mask, (dx, dy))
    return shifted


def shoreline_overlay(mask: int, variant: int, cliff_texture: Image.Image) -> Image.Image:
    """Directional cliff lip, shallow-water fringe and restrained texture variation."""
    shape = blob_shape(mask)
    exposed = exposed_boundary(shape, mask & 0x0F)
    inverse_shape = ImageChops.invert(shape)

    # Build every shoreline effect from the genuinely exposed contour only.
    # This prevents lips and cliff bands from being drawn on borders where two
    # adjacent Blob tiles connect, which previously turned diagonal runs into
    # a row of separate triangular teeth.
    lip = ImageChops.multiply(exposed.filter(ImageFilter.MaxFilter(3)), shape)
    cliff_band = ImageChops.multiply(exposed.filter(ImageFilter.MaxFilter(7)), shape)
    outer = ImageChops.multiply(exposed.filter(ImageFilter.MaxFilter(5)), inverse_shape)
    drop = ImageChops.multiply(
        shifted_mask(exposed, 3, 4).filter(ImageFilter.MaxFilter(3)),
        inverse_shape,
    )

    overlay = Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0))

    # Shallow water fringe makes the coast feel integrated rather than cut out.
    shallow = Image.new("RGBA", (TILE, TILE), (77, 145, 168, 0))
    shallow.putalpha(outer.point(lambda value: int(value * 0.30)))
    overlay.alpha_composite(shallow)

    # Consistent south-east drop shadow supplies altitude like Raptor's ground art.
    shadow = Image.new("RGBA", (TILE, TILE), (20, 22, 24, 0))
    shadow.putalpha(drop.point(lambda value: int(value * 0.48)))
    overlay.alpha_composite(shadow)

    face = cliff_texture.copy()
    face.putalpha(cliff_band.point(lambda value: int(value * 0.92)))
    overlay.alpha_composite(face)

    dark = Image.new("RGBA", (TILE, TILE), (63, 31, 20, 0))
    dark.putalpha(cliff_band.point(lambda value: int(value * 0.34)))
    overlay.alpha_composite(dark)

    sun = Image.new("RGBA", (TILE, TILE), (238, 166, 91, 0))
    sun.putalpha(lip.point(lambda value: int(value * 0.78)))
    overlay.alpha_composite(sun)

    # Variant-specific micro highlights vary appearance without changing topology.
    rng = random.Random(0x5100 + mask * 17 + variant * 101)
    pixels = list(zip(*lip.nonzero())) if hasattr(lip, 'nonzero') else []
    # Pillow images do not expose nonzero consistently; sample lit edge pixels directly.
    edge_points = [(x, y) for y in range(TILE) for x in range(TILE) if lip.getpixel((x, y)) > 100]
    detail = ImageDraw.Draw(overlay, "RGBA")
    for x, y in rng.sample(edge_points, min(len(edge_points), 2 + variant)):
        detail.point((x, y), fill=(255, 205, 126, rng.randrange(90, 150)))
    return overlay


def split_metatile(image: Image.Image) -> list[Image.Image]:
    columns = image.width // TILE
    rows = image.height // TILE
    return [
        image.crop((column * TILE, row * TILE, (column + 1) * TILE, (row + 1) * TILE))
        for row in range(rows)
        for column in range(columns)
    ]


def rock_frame(seed: int) -> Image.Image:
    rng = random.Random(0xA200 + seed)
    frame = blank()
    draw = ImageDraw.Draw(frame, "RGBA")
    count = 2 + seed % 3
    for _ in range(count):
        cx = rng.randrange(5, 27)
        cy = rng.randrange(8, 27)
        rx = rng.randrange(3, 7)
        ry = rng.randrange(2, 5)
        draw.ellipse((cx - rx + 2, cy - ry + 3, cx + rx + 2, cy + ry + 3), fill=(38, 23, 18, 78))
        draw.polygon(
            [(cx - rx, cy), (cx - rx // 2, cy - ry), (cx + rx // 2, cy - ry + 1), (cx + rx, cy + 1), (cx, cy + ry)],
            fill=(104, 57, 34, 235),
        )
        draw.line((cx - rx // 2, cy - ry + 1, cx + rx // 3, cy - ry + 2), fill=(205, 126, 67, 160), width=1)
    return frame


def crack_frame(seed: int) -> Image.Image:
    rng = random.Random(0xC400 + seed)
    frame = blank()
    draw = ImageDraw.Draw(frame, "RGBA")
    x, y = rng.randrange(6, 26), rng.randrange(4, 12)
    points = [(x, y)]
    for _ in range(4 + seed % 3):
        x = max(2, min(29, x + rng.randrange(-5, 6)))
        y = min(30, y + rng.randrange(3, 7))
        points.append((x, y))
    draw.line(points, fill=(68, 37, 27, 160), width=1)
    if len(points) > 3:
        bx, by = points[2]
        draw.line((bx, by, bx + rng.choice([-5, 5]), by + 5), fill=(77, 41, 29, 110), width=1)
    return frame


def scrub_frame(seed: int) -> Image.Image:
    rng = random.Random(0x5C20 + seed)
    frame = blank()
    draw = ImageDraw.Draw(frame, "RGBA")
    base_x = 16 + rng.randrange(-4, 5)
    base_y = 27
    color = rng.choice([(72, 65, 35, 200), (88, 72, 37, 190), (62, 56, 31, 210)])
    draw.line((base_x, base_y, base_x, 14), fill=(74, 43, 27, 210), width=2)
    for _ in range(4 + seed % 3):
        ex = base_x + rng.randrange(-10, 11)
        ey = rng.randrange(10, 23)
        draw.line((base_x, 20, ex, ey), fill=(74, 43, 27, 180), width=1)
        draw.ellipse((ex - 2, ey - 1, ex + 2, ey + 1), fill=color)
    return frame


def sediment_frame(seed: int) -> Image.Image:
    rng = random.Random(0x5ED0 + seed)
    frame = blank()
    mask = Image.new("L", (TILE, TILE), 0)
    draw = ImageDraw.Draw(mask)
    points = []
    for index in range(10):
        angle = math.tau * index / 10
        radius = rng.randrange(8, 14)
        points.append((16 + math.cos(angle) * radius, 17 + math.sin(angle) * radius * 0.55))
    draw.polygon(points, fill=110)
    mask = mask.filter(ImageFilter.GaussianBlur(2.2))
    color = Image.new("RGBA", (TILE, TILE), (207, 132, 70, 0))
    color.putalpha(mask)
    frame.alpha_composite(color)
    return frame


def ruin_frame(seed: int) -> Image.Image:
    rng = random.Random(0x8A10 + seed)
    frame = blank()
    draw = ImageDraw.Draw(frame, "RGBA")
    draw.rectangle((4, 13, 28, 25), fill=(48, 53, 55, 210))
    draw.rectangle((6, 11, 25, 14), fill=(104, 82, 58, 230))
    for x in range(7, 27, 6):
        if rng.random() > 0.25:
            draw.rectangle((x, 15, x + 2, 24), fill=(93, 101, 100, 210))
    draw.line((5, 26, 28, 26), fill=(35, 26, 22, 120), width=2)
    draw.rectangle((rng.randrange(8, 20), 8, rng.randrange(21, 27), 12), fill=(121, 58, 34, 210))
    return frame


def build_atlas(frames: Iterable[Image.Image], rows: int) -> Image.Image:
    atlas = Image.new("RGBA", (ATLAS_COLUMNS * TILE, rows * TILE), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        x = (index % ATLAS_COLUMNS) * TILE
        y = (index // ATLAS_COLUMNS) * TILE
        atlas.alpha_composite(frame, (x, y))
    return atlas


def build_props(master: Image.Image) -> None:
    props: list[Image.Image] = [blank()]
    props.extend(lower(master, 0, column, transparent_black=True) for column in range(6, 15))
    props.extend(lower(master, 1, column) for column in range(6))
    props.extend(lower(master, 1, column) for column in range(6, 15))
    props.extend(lower(master, 2, column) for column in range(7))
    props.extend(lower(master, 2, column) for column in range(7, 15))
    props.extend(lower(master, 3, column) for column in range(8))
    props.extend(lower(master, 3, column) for column in range(8, 15))
    props.extend(lower(master, 1, column) for column in range(12, 15))
    props.extend(lower(master, 2, column) for column in range(12, 15))
    props.extend(lower(master, 3, column) for column in range(12, 15))
    props = props[:64]
    while len(props) < 64:
        props.append(blank())
    build_atlas(props, rows=4).save(PROPS_OUT, optimize=True)


def add_group(terrain: list[Image.Image], frames: list[Image.Image]) -> list[int]:
    start = len(terrain)
    terrain.extend(frames)
    return list(range(start, start + len(frames)))



def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    master = Image.open(SOURCE).convert("RGBA")
    masks = valid_blob47_masks()
    if len(masks) != 47:
        raise RuntimeError(f"Blob-47 expected 47 masks, got {len(masks)}")

    sandstone = sandstone_metatile(master)
    boundaries = boundary_textures(sandstone)
    cliff_textures = [regular(master, row, column) for row, column in ((1, 2), (1, 4), (2, 1), (2, 6))]

    water_sheet = Image.new("RGBA", (METATILE * 3, METATILE), (0, 0, 0, 255))
    for index in range(3):
        water_sheet.alpha_composite(water_frame(master, index), (index * METATILE, 0))
    water_sheet.save(WATER_OUT, optimize=True)
    sandstone.save(SANDSTONE_OUT, optimize=True)

    terrain: list[Image.Image] = [blank()]

    boundary_frames: dict[str, list[int]] = {}
    for mask in masks:
        frames: list[int] = []
        for variant, texture in enumerate(boundaries):
            frames.extend(add_group(terrain, [boundary_fill(mask, texture)]))
        boundary_frames[str(mask)] = frames

    shoreline_frames: dict[str, list[int]] = {}
    for mask in masks:
        frames: list[int] = []
        for variant, texture in enumerate(cliff_textures):
            frames.extend(add_group(terrain, [shoreline_overlay(mask, variant, texture)]))
        shoreline_frames[str(mask)] = frames

    # Use the generated master directly for the highest-value set dressing.
    source_rocks = [lower(master, 0, column, transparent_black=True) for column in range(6, 9)]
    source_scrub = [lower(master, 0, column, transparent_black=True) for column in range(9, 15)]
    rock_frames = add_group(terrain, source_rocks + [rock_frame(index) for index in range(5)])
    crack_frames = add_group(terrain, [crack_frame(index) for index in range(12)])
    scrub_frames = add_group(terrain, source_scrub + [scrub_frame(index) for index in range(4)])
    sediment_frames = add_group(terrain, [sediment_frame(index) for index in range(10)])
    ruin_frames = add_group(
        terrain,
        [regular(master, 7, column) for column in range(7, 15)]
        + [regular(master, 8, column) for column in range(7, 15)]
        + [ruin_frame(index) for index in range(4)],
    )
    platform_frames = add_group(
        terrain,
        [regular(master, 6, column) for column in range(15)]
        + [regular(master, 7, column) for column in range(7)]
        + [regular(master, 8, column) for column in range(7)],
    )

    rows = math.ceil(len(terrain) / ATLAS_COLUMNS)
    while len(terrain) < rows * ATLAS_COLUMNS:
        terrain.append(blank())
    build_atlas(terrain, rows=rows).save(TERRAIN_OUT, optimize=True)
    build_props(master)

    manifest = {
        "formatVersion": "1.4",
        "id": "skyforge_canyon_default",
        "displayName": "Skyforge Canyon Default — Benchmark Pass",
        "sourceMaster": "art-source/skyforge_canyon_master.png",
        "terrain": {
            "uri": "assets/terrain/skyforge_canyon_terrain.png",
            "tileSize": TILE,
            "columns": ATLAS_COLUMNS,
            "rows": rows,
            "sha256": sha256(TERRAIN_OUT),
            "frames": {
                "empty": [0],
                "sandstoneBoundaryBlob47": boundary_frames,
                "shorelineBlob47": shoreline_frames,
                "rockClusters": rock_frames,
                "cracks": crack_frames,
                "scrub": scrub_frames,
                "sediment": sediment_frames,
                "ruins": ruin_frames,
                "metalPlatform": platform_frames,
            },
        },
        "planes": {
            "river": {
                "uri": "assets/terrain/skyforge_canyon_water.png",
                "frameWidth": METATILE,
                "frameHeight": METATILE,
                "columns": 3,
                "rows": 1,
                "sha256": sha256(WATER_OUT),
            },
            "sandstone": {
                "uri": "assets/terrain/skyforge_canyon_sandstone.png",
                "frameWidth": METATILE,
                "frameHeight": METATILE,
                "columns": 1,
                "rows": 1,
                "sha256": sha256(SANDSTONE_OUT),
            },
        },
        "props": {
            "uri": "assets/terrain/skyforge_canyon_props.png",
            "tileSize": TILE,
            "columns": 16,
            "rows": 4,
            "sha256": sha256(PROPS_OUT),
        },
        "materials": {
            "empty": {"baseFrames": [0]},
            "river": {"baseFrames": [0]},
            "sandstone": {"baseFrames": [0]},
            "sandstone_boundary": {
                "baseFrames": boundary_frames[str(masks[0])],
                "blob47Frames": boundary_frames,
            },
            "shoreline": {
                "baseFrames": shoreline_frames[str(masks[0])],
                "blob47Frames": shoreline_frames,
            },
            "rock_cluster": {"baseFrames": rock_frames},
            "crack": {"baseFrames": crack_frames},
            "scrub": {"baseFrames": scrub_frames},
            "sediment": {"baseFrames": sediment_frames},
            "ruin": {"baseFrames": ruin_frames},
            "metal_platform": {"baseFrames": platform_frames},
        },
        "runtimePlanes": [
            {
                "materialId": "river",
                "uri": "assets/terrain/skyforge_canyon_water.png",
                "frameWidth": METATILE,
                "frameHeight": METATILE,
                "columns": 3,
                "rows": 1,
                "animationFrames": [0, 1, 2],
                "animationFps": 0.65,
                "driftX": 0.12,
                "driftY": 1.25,
            },
            {
                "materialId": "sandstone",
                "uri": "assets/terrain/skyforge_canyon_sandstone.png",
                "frameWidth": METATILE,
                "frameHeight": METATILE,
                "columns": 1,
                "rows": 1,
                "animationFrames": [0],
                "animationFps": 1.0,
                "driftX": 0.0,
                "driftY": 0.0,
            },
        ],
        "notes": [
            "Water and sandstone use 512px source-art fields to suppress short-period repetition.",
            "Each canonical Blob-47 mask has four texture-safe visual variants selected deterministically per cell.",
            "Shoreline overlays combine shallow water, a directional drop shadow, cliff-face texture and a lit lip.",
            "Source-master rocks, vegetation and industrial tiles are mixed with procedural micro-detail.",
            "Terrain remains presentation-only; runtime collision is disabled pending redesign.",
        ],
    }
    MANIFEST_OUT.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {TERRAIN_OUT.relative_to(ROOT)} ({TERRAIN_OUT.stat().st_size} bytes, {rows} rows)")
    print(f"Wrote {WATER_OUT.relative_to(ROOT)} ({WATER_OUT.stat().st_size} bytes)")
    print(f"Wrote {SANDSTONE_OUT.relative_to(ROOT)} ({SANDSTONE_OUT.stat().st_size} bytes)")
    print(f"Wrote {PROPS_OUT.relative_to(ROOT)} ({PROPS_OUT.stat().st_size} bytes)")
    print(f"Wrote {MANIFEST_OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
