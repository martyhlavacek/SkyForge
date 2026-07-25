#!/usr/bin/env python3
"""Regenerate Level 01 as the Epoch 18 authored canyon environment.

The Blob-47 renderer remains deterministic, but the map is now composed as
recognisable spaces rather than a mask stress test. Geological cleanup removes
small components, fragile necks, one-row spikes, and tiny holes. Independent
set-dressing layers add rocks, cracks, scrub, sediment, ruins, and industrial
platforms without changing gameplay collision.
"""
from __future__ import annotations

import json
import math
from collections import deque
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAP_PATH = ROOT / "src/content/maps/canyon_passage.json"
COLLISION_PATH = ROOT / "src/content/collision/canyon_passage_collision.json"
ROUTES_PATH = ROOT / "src/content/routes/canyon_passage_routes.json"
OBJECTS_PATH = ROOT / "src/content/terrainObjects/canyon_passage_objects.json"
TILESET_MANIFEST_PATH = ROOT / "public/assets/terrain/skyforge_canyon_tileset.json"

ROWS = 800
COLUMNS = 17
TILE = 32
ORIGIN_Y = -960

# Broad authored beats: entrance, S-bend, island split, industrial channel,
# combat basin, ruins, and escalating late-mission passages.
CONTROL_POINTS = [
    (0, 8.5, 11.2),
    (45, 6.8, 9.2),
    (90, 10.0, 8.4),
    (135, 8.2, 11.5),
    (185, 7.0, 8.4),
    (235, 9.8, 7.2),
    (280, 8.6, 7.6),
    (330, 8.5, 12.0),
    (390, 6.7, 8.6),
    (445, 10.1, 8.5),
    (500, 8.5, 11.0),
    (555, 7.0, 8.3),
    (615, 9.8, 9.0),
    (680, 8.0, 7.4),
    (735, 6.9, 9.5),
    (799, 8.8, 11.2),
]

# center-row, center-x, x-radius, y-radius, horizontal drift.
ISLANDS = [
    (142, 8.4, 2.65, 13.0, 0.22),
    (334, 7.2, 2.15, 9.5, -0.15),
    (522, 9.4, 2.55, 11.5, 0.18),
    (718, 8.1, 2.25, 9.0, -0.13),
]

# side, center-row, y-radius, maximum intrusion in columns.
PENINSULAS = [
    ("left", 70, 15.0, 1.8),
    ("right", 104, 14.0, 1.9),
    ("left", 210, 13.0, 1.4),
    ("right", 258, 12.0, 1.5),
    ("left", 405, 17.0, 1.7),
    ("right", 470, 15.0, 1.6),
    ("left", 650, 15.0, 1.5),
]


def smoothstep(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def sample_controls(row: int) -> tuple[float, float]:
    for index in range(len(CONTROL_POINTS) - 1):
        a = CONTROL_POINTS[index]
        b = CONTROL_POINTS[index + 1]
        if row <= b[0]:
            span = max(1, b[0] - a[0])
            t = smoothstep((row - a[0]) / span)
            return a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t
    return CONTROL_POINTS[-1][1], CONTROL_POINTS[-1][2]


def peninsula_extension(side: str, row: int) -> float:
    extension = 0.0
    for candidate_side, center, radius, amount in PENINSULAS:
        if candidate_side != side:
            continue
        distance = abs(row - center)
        if distance <= radius:
            extension += amount * (0.5 + 0.5 * math.cos(math.pi * distance / radius))
    return extension


def median(values: list[int]) -> int:
    ordered = sorted(values)
    return ordered[len(ordered) // 2]


def smooth_integer_series(values: list[int]) -> list[int]:
    result = values[:]
    for _ in range(3):
        result = [
            median(result[max(0, index - 2) : min(len(result), index + 3)])
            for index in range(len(result))
        ]
    # Suppress isolated one-row steps.
    for _ in range(2):
        for index in range(1, len(result) - 1):
            if result[index - 1] == result[index + 1] != result[index]:
                result[index] = result[index - 1]
    # Never move more than one cell from one row to the next.
    for index in range(1, len(result)):
        result[index] = max(result[index - 1] - 1, min(result[index - 1] + 1, result[index]))
    for index in range(len(result) - 2, -1, -1):
        result[index] = max(result[index + 1] - 1, min(result[index + 1] + 1, result[index]))
    return result


def authored_bounds() -> list[tuple[int, int]]:
    desired_left: list[int] = []
    desired_right: list[int] = []
    for row in range(ROWS):
        centre, width = sample_controls(row)
        centre += 0.26 * math.sin(row / 43.0) + 0.11 * math.sin(row / 97.0 + 0.7)
        width += 0.30 * math.sin(row / 61.0 + 0.3)
        left = round(centre - width / 2 + peninsula_extension("left", row))
        right = round(centre + width / 2 - peninsula_extension("right", row))
        desired_left.append(max(1, min(9, left)))
        desired_right.append(min(15, max(7, right)))
    lefts = smooth_integer_series(desired_left)
    rights = smooth_integer_series(desired_right)
    bounds: list[tuple[int, int]] = []
    for left, right in zip(lefts, rights):
        if right - left + 1 < 6:
            midpoint = (left + right) // 2
            left = max(1, midpoint - 3)
            right = min(15, left + 5)
        bounds.append((left, right))
    return apply_diagonal_demonstration(bounds)




def apply_diagonal_demonstration(bounds: list[tuple[int, int]]) -> list[tuple[int, int]]:
    """Front-load true 45-degree banks and broad inner curves for visual QA.

    A Blob-47 diagonal is clearest when the bank advances exactly one cell per
    row. Longer shallow ramps alternate vertical and corner cells and read as a
    sawtooth, so the authored level uses compact 45-degree transitions separated
    by stable banks and broad bays.
    """
    result = bounds[:]

    def set_row(row: int, left: int | None = None, right: int | None = None) -> None:
        current_left, current_right = result[row]
        next_left = current_left if left is None else left
        next_right = current_right if right is None else right
        if next_right - next_left + 1 < 6:
            next_right = min(15, next_left + 5)
        result[row] = (max(1, min(9, next_left)), min(15, max(7, next_right)))

    def hold(start: int, end: int, left: int, right: int) -> None:
        for row in range(start, end + 1):
            set_row(row, left, right)

    def diagonal_left(start: int, values: list[int], right: int) -> None:
        for offset, value in enumerate(values):
            set_row(start + offset, value, right)

    def diagonal_right(start: int, values: list[int], left: int) -> None:
        for offset, value in enumerate(values):
            set_row(start + offset, left, value)

    # Opening S-curve with uninterrupted 45-degree transitions.
    diagonal_left(12, [3, 4, 5, 6, 7], 15)
    hold(17, 24, 7, 15)
    diagonal_left(25, [7, 6, 5, 4, 3], 14)
    hold(30, 38, 3, 14)
    diagonal_right(39, [14, 13, 12, 11, 10], 3)
    hold(44, 51, 3, 10)
    diagonal_right(52, [10, 11, 12, 13, 14], 3)
    hold(57, 66, 3, 14)

    # Broad inner bays framed by diagonal entries and exits.
    diagonal_left(72, [3, 4, 5, 6], 15)
    hold(76, 84, 6, 15)
    diagonal_left(85, [6, 5, 4, 3], 15)
    hold(89, 96, 3, 15)
    diagonal_right(97, [15, 14, 13, 12, 11], 3)
    hold(102, 110, 3, 11)
    diagonal_right(111, [11, 12, 13, 14, 15], 3)

    # Mid-level opposite-direction verification in a different visual context.
    diagonal_left(286, [4, 5, 6, 7], 15)
    hold(290, 298, 7, 15)
    diagonal_left(299, [7, 6, 5, 4, 3], 14)
    hold(304, 312, 3, 14)
    diagonal_right(313, [14, 13, 12, 11], 3)
    hold(317, 324, 3, 11)
    diagonal_right(325, [11, 12, 13, 14, 15], 3)
    return result


def island_cells(bounds: list[tuple[int, int]]) -> set[tuple[int, int]]:
    cells: set[tuple[int, int]] = set()
    for center_row, center_x, radius_x, radius_y, drift in ISLANDS:
        for row in range(max(0, math.floor(center_row - radius_y)), min(ROWS, math.ceil(center_row + radius_y + 1))):
            dy = (row - center_row) / radius_y
            if abs(dy) >= 0.96:
                continue
            local_center = center_x + drift * math.sin((row - center_row) / 3.4)
            half_width = radius_x * math.sqrt(max(0.0, 1.0 - dy * dy))
            # Never author a one-cell cap: island rows are at least two cells wide.
            if half_width < 0.72:
                continue
            x0 = math.floor(local_center - half_width)
            x1 = math.ceil(local_center + half_width)
            if x1 - x0 + 1 < 2:
                x1 = x0 + 1
            left, right = bounds[row]
            x0 = max(left + 1, x0)
            x1 = min(right - 1, x1)
            if x1 - x0 + 1 >= 2:
                for x in range(x0, x1 + 1):
                    cells.add((x, row))
    return cells


def neighbours4(x: int, row: int) -> list[tuple[int, int]]:
    return [(x, row - 1), (x + 1, row), (x, row + 1), (x - 1, row)]


def neighbours8(x: int, row: int) -> list[tuple[int, int]]:
    return [
        (x + dx, row + dy)
        for dy in (-1, 0, 1)
        for dx in (-1, 0, 1)
        if dx or dy
    ]


def connected_components(cells: set[tuple[int, int]]) -> list[set[tuple[int, int]]]:
    remaining = set(cells)
    components: list[set[tuple[int, int]]] = []
    while remaining:
        start = remaining.pop()
        component = {start}
        queue = deque([start])
        while queue:
            x, row = queue.popleft()
            for candidate in neighbours4(x, row):
                if candidate in remaining:
                    remaining.remove(candidate)
                    component.add(candidate)
                    queue.append(candidate)
        components.append(component)
    return components


def geological_cleanup(occupied: set[tuple[int, int]]) -> set[tuple[int, int]]:
    result = set(occupied)
    # Fill tiny water pinholes nearly surrounded by land.
    for _ in range(2):
        additions = set()
        for row in range(1, ROWS - 1):
            for x in range(1, COLUMNS - 1):
                if (x, row) in result:
                    continue
                if sum(candidate in result for candidate in neighbours8(x, row)) >= 7:
                    additions.add((x, row))
        result |= additions

    # Remove non-bank spurs until each interior component has stable connectivity.
    for _ in range(3):
        removals = set()
        for x, row in result:
            if x in (0, COLUMNS - 1):
                continue
            degree = sum(candidate in result for candidate in neighbours4(x, row))
            if degree <= 1:
                removals.add((x, row))
        result -= removals

    # Remove undersized freestanding components; the two edge-touching banks remain.
    for component in connected_components(result):
        touches_edge = any(x in (0, COLUMNS - 1) for x, _ in component)
        if not touches_edge and len(component) < 18:
            result -= component
    return result


def build_occupancy() -> tuple[set[tuple[int, int]], list[tuple[int, int]]]:
    bounds = authored_bounds()
    occupied: set[tuple[int, int]] = set()
    for row, (left, right) in enumerate(bounds):
        for x in range(COLUMNS):
            if x < left or x > right:
                occupied.add((x, row))
    occupied |= island_cells(bounds)
    return geological_cleanup(occupied), bounds


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


def blob47_variant(occupied: set[tuple[int, int]], x: int, row: int) -> int:
    def has(nx: int, ny: int) -> bool:
        if nx < 0 or nx >= COLUMNS or ny < 0 or ny >= ROWS:
            return True
        return (nx, ny) in occupied

    mask = 0
    north, east, south, west = has(x, row - 1), has(x + 1, row), has(x, row + 1), has(x - 1, row)
    if north:
        mask |= 1
    if east:
        mask |= 2
    if south:
        mask |= 4
    if west:
        mask |= 8
    if north and east and has(x + 1, row - 1):
        mask |= 16
    if south and east and has(x + 1, row + 1):
        mask |= 32
    if south and west and has(x - 1, row + 1):
        mask |= 64
    if north and west and has(x - 1, row - 1):
        mask |= 128
    return normalize_blob47(mask)


def stable_unit(x: int, row: int, salt: int) -> float:
    value = (x + 1) * 0x45D9F3B ^ (row + 1) * 0x119DE1F3 ^ salt
    value = (value ^ (value >> 16)) * 0x45D9F3B
    value = (value ^ (value >> 16)) & 0xFFFFFFFF
    return value / 0xFFFFFFFF


def sparse_select(candidates: list[tuple[int, int]], chance: float, spacing: int, salt: int) -> list[tuple[int, int]]:
    selected: list[tuple[int, int]] = []
    for x, row in sorted(candidates, key=lambda item: (item[1], item[0])):
        if stable_unit(x, row, salt) >= chance:
            continue
        if any(abs(x - sx) <= spacing and abs(row - sr) <= spacing for sx, sr in selected):
            continue
        selected.append((x, row))
    return selected


def nearest_land(occupied: set[tuple[int, int]], preferred_x: int, row: int, side: str) -> tuple[int, int] | None:
    xs = [x for x in range(COLUMNS) if (x, row) in occupied]
    if not xs:
        return None
    if side == "left":
        choices = [x for x in xs if x <= preferred_x] or xs
        return max(choices), row
    choices = [x for x in xs if x >= preferred_x] or xs
    return min(choices), row



def build_decorations(
    occupied: set[tuple[int, int]], variants: dict[tuple[int, int], int]
) -> dict[str, list[dict[str, int]]]:
    interior = [position for position, variant in variants.items() if variant == 255]
    boundary = [position for position, variant in variants.items() if variant != 255]

    rock_positions = sparse_select(interior, 0.066, 2, 0xA81)
    crack_positions = sparse_select(interior, 0.052, 2, 0xC42)
    scrub_positions = sparse_select(
        [position for position in interior if not (210 <= position[1] <= 285)],
        0.032,
        3,
        0x5C2,
    )
    sediment_positions = sparse_select(boundary, 0.105, 2, 0x5ED)

    layers: dict[str, list[dict[str, int]]] = {
        "sediment": [{"x": x, "row": row, "tile": 11} for x, row in sediment_positions],
        "rocks": [{"x": x, "row": row, "tile": 8} for x, row in rock_positions],
        "cracks": [{"x": x, "row": row, "tile": 9} for x, row in crack_positions],
        "scrub": [{"x": x, "row": row, "tile": 10} for x, row in scrub_positions],
        "landmarks": [],
    }

    manifest = json.loads(TILESET_MANIFEST_PATH.read_text(encoding="utf-8"))
    frame_groups = manifest["terrain"]["frames"]
    platform_frames: list[int] = frame_groups["metalPlatform"]
    ruin_frames: list[int] = frame_groups["ruins"]
    plain_panels = platform_frames[:6]
    rocky_panels = platform_frames[6:]
    ruin_edges = ruin_frames[:8]
    ruin_details = ruin_frames[8:16] if len(ruin_frames) >= 16 else ruin_frames

    def add_landmark(x: int, row: int, tile: int, frame: int) -> None:
        if 0 <= x < COLUMNS and 0 <= row < ROWS:
            layers["landmarks"].append({"x": x, "row": row, "tile": tile, "frame": frame})

    def place_platform_rect(x0: int, row0: int, width: int, height: int) -> None:
        for dy in range(height):
            for dx in range(width):
                frame = plain_panels[(dx + dy * width) % len(plain_panels)]
                add_landmark(x0 + dx, row0 + dy, 6, frame)

    def place_ruin_compound(x0: int, row0: int, width: int = 3, height: int = 3) -> None:
        place_platform_rect(x0, row0, width, height)
        # Broken rock/metal perimeter and recognisable grates/doors create a Raptor-like landmark.
        perimeter = [
            (0, 0, ruin_edges[0 % len(ruin_edges)]),
            (width - 1, 0, ruin_edges[1 % len(ruin_edges)]),
            (0, height - 1, ruin_edges[4 % len(ruin_edges)]),
            (width - 1, height - 1, ruin_edges[5 % len(ruin_edges)]),
        ]
        for dx, dy, frame in perimeter:
            add_landmark(x0 + dx, row0 + dy, 12, frame)
        if width >= 3 and height >= 2:
            add_landmark(x0 + width // 2, row0 + 1, 12, ruin_details[2 % len(ruin_details)])
        if height >= 3:
            add_landmark(x0 + width // 2, row0 + height - 1, 12, ruin_details[5 % len(ruin_details)])

    def place_dock(row: int, side: str, length: int = 4, thickness: int = 2) -> None:
        xs = sorted(x for x in range(COLUMNS) if (x, row) in occupied)
        if not xs:
            return
        bank_x = max(x for x in xs if x < COLUMNS // 2) if side == "left" else min(x for x in xs if x > COLUMNS // 2)
        direction = 1 if side == "left" else -1
        for dy in range(thickness):
            for offset in range(length):
                x = bank_x + direction * offset
                frame_group = plain_panels if offset < length - 1 else rocky_panels
                frame = frame_group[(offset + dy) % len(frame_group)]
                add_landmark(x, row + dy, 6, frame)

    def place_bridge(row: int) -> None:
        water_xs = [x for x in range(COLUMNS) if (x, row) not in occupied]
        if len(water_xs) < 5:
            return
        x0, x1 = min(water_xs) - 1, max(water_xs) + 1
        for dy in range(2):
            for x in range(max(0, x0), min(COLUMNS, x1 + 1)):
                frame = plain_panels[(x + dy * 3) % len(plain_panels)]
                add_landmark(x, row + dy, 6, frame)
        # A pair of vent/gantry cells makes the bridge read as infrastructure, not a random stripe.
        if ruin_details:
            add_landmark(max(0, x0), row - 1, 12, ruin_details[0])
            add_landmark(min(COLUMNS - 1, x1), row - 1, 12, ruin_details[-1])

    def place_bank_compound(row: int, side: str, width: int = 3, height: int = 3) -> None:
        xs = sorted(x for x in range(COLUMNS) if (x, row) in occupied)
        if not xs:
            return
        if side == "left":
            bank = max((x for x in xs if x < COLUMNS // 2), default=max(xs))
            x0 = max(0, bank - width + 1)
        else:
            bank = min((x for x in xs if x > COLUMNS // 2), default=min(xs))
            x0 = min(COLUMNS - width, bank)
        place_ruin_compound(x0, row, width, height)

    # Authored visual beats begin immediately: a shoreline station, paired docks,
    # a canal bridge, island ruin, industrial channel, basin complex, and late outposts.
    place_bank_compound(24, "right", 3, 3)
    place_dock(52, "left", 4, 2)
    place_dock(74, "right", 3, 2)
    place_bridge(104)
    place_bank_compound(116, "left", 3, 3)
    place_ruin_compound(7, 137, 3, 4)
    place_dock(220, "left", 4, 2)
    place_dock(252, "right", 4, 2)
    place_bridge(276)
    place_ruin_compound(5, 326, 4, 3)
    place_dock(405, "left", 3, 2)
    place_ruin_compound(11, 442, 3, 3)
    place_ruin_compound(8, 516, 3, 4)
    place_bank_compound(566, "right", 3, 3)
    place_bridge(612)
    place_dock(686, "right", 4, 2)
    place_ruin_compound(4, 742, 3, 3)

    # Local prop clusters around major locations, independent from the general density pass.
    for center_x, center_row in ((12, 26), (5, 56), (8, 106), (8, 142), (6, 330), (12, 445), (9, 522), (12, 568), (5, 744)):
        for dx, dy in ((-2, -2), (2, -1), (-2, 2), (2, 2)):
            x, row = center_x + dx, center_row + dy
            if (x, row) in occupied:
                layers["rocks"].append({"x": x, "row": row, "tile": 8})
        for dx, dy in ((-1, -3), (2, 3)):
            x, row = center_x + dx, center_row + dy
            if (x, row) in occupied:
                layers["scrub"].append({"x": x, "row": row, "tile": 10})

    # Deduplicate each layer while preserving the last authored exact-frame cell.
    for key, cells in layers.items():
        unique = {(cell["x"], cell["row"]): cell for cell in cells}
        layers[key] = sorted(unique.values(), key=lambda cell: (cell["row"], cell["x"]))
    return layers


def build_map() -> tuple[dict, list[tuple[int, int]], set[tuple[int, int]]]:
    occupied, bounds = build_occupancy()
    variants = {
        (x, row): blob47_variant(occupied, x, row)
        for row in range(ROWS)
        for x in range(COLUMNS)
        if (x, row) in occupied
    }
    sandstone_surface = [
        {"x": x, "row": row, "tile": 7, "variant": variant}
        for (x, row), variant in variants.items()
    ]
    boundary = [cell for cell in sandstone_surface if cell["variant"] != 255]
    shoreline = [
        {"x": cell["x"], "row": cell["row"], "tile": 4, "variant": cell["variant"]}
        for cell in boundary
    ]
    decorations = build_decorations(occupied, variants)

    result = {
        "formatVersion": "2.0",
        "id": "canyon_passage",
        "displayName": "Canyon Passage — Authored Environment",
        "biomeId": "canyon",
        "tileSize": TILE,
        "worldWidth": COLUMNS * TILE,
        "rows": ROWS,
        "chunkRows": 16,
        "originWorldY": ORIGIN_Y,
        "layers": [
            {
                "id": "river_plane",
                "name": "Quiet Continuous River",
                "kind": "groundBase",
                "scrollRatio": 1,
                "depth": 2,
                "opacity": 1,
                "collisionAligned": False,
                "visible": True,
                "renderMode": "tileSprite",
                "materialTile": 1,
                "cells": [],
            },
            {
                "id": "sandstone_surface",
                "name": "Continuous Sandstone Composited Through Blob 47",
                "kind": "terrainSurface",
                "scrollRatio": 1,
                "depth": 4,
                "opacity": 1,
                "collisionAligned": False,
                "visible": True,
                "renderMode": "compositedCells",
                "materialTile": 3,
                "cells": sorted(sandstone_surface, key=lambda cell: (cell["row"], cell["x"])),
            },
            {
                "id": "sediment",
                "name": "Inside-Bend Sediment",
                "kind": "terrainDetail",
                "scrollRatio": 1,
                "depth": 5,
                "opacity": 0.72,
                "collisionAligned": False,
                "visible": True,
                "renderMode": "cells",
                "cells": decorations["sediment"],
            },
            {
                "id": "shoreline",
                "name": "Thin Shoreline Lip and Undercut",
                "kind": "terrainDetail",
                "scrollRatio": 1,
                "depth": 6,
                "opacity": 1,
                "collisionAligned": False,
                "visible": True,
                "renderMode": "cells",
                "cells": sorted(shoreline, key=lambda cell: (cell["row"], cell["x"])),
            },
            {
                "id": "rock_clusters",
                "name": "Rock Clusters",
                "kind": "terrainDetail",
                "scrollRatio": 1,
                "depth": 7,
                "opacity": 1,
                "collisionAligned": False,
                "visible": True,
                "renderMode": "cells",
                "cells": decorations["rocks"],
            },
            {
                "id": "cracks",
                "name": "Erosion Cracks",
                "kind": "terrainDetail",
                "scrollRatio": 1,
                "depth": 7,
                "opacity": 0.9,
                "collisionAligned": False,
                "visible": True,
                "renderMode": "cells",
                "cells": decorations["cracks"],
            },
            {
                "id": "scrub",
                "name": "Dry Scrub",
                "kind": "terrainDetail",
                "scrollRatio": 1,
                "depth": 8,
                "opacity": 1,
                "collisionAligned": False,
                "visible": True,
                "renderMode": "cells",
                "cells": decorations["scrub"],
            },
            {
                "id": "landmarks",
                "name": "Ruins and Industrial Landmarks",
                "kind": "terrainDetail",
                "scrollRatio": 1,
                "depth": 9,
                "opacity": 1,
                "collisionAligned": False,
                "visible": True,
                "renderMode": "cells",
                "cells": decorations["landmarks"],
            },
        ],
    }
    return result, bounds, occupied


def build_dormant_collision(bounds: list[tuple[int, int]]) -> dict:
    samples = []
    for row in range(0, ROWS, 4):
        left, right = bounds[row]
        samples.append({"worldY": ORIGIN_Y + row * TILE, "left": left * TILE, "right": (right + 1) * TILE})
    if samples[-1]["worldY"] != ORIGIN_Y + (ROWS - 1) * TILE:
        left, right = bounds[-1]
        samples.append({"worldY": ORIGIN_Y + (ROWS - 1) * TILE, "left": left * TILE, "right": (right + 1) * TILE})
    return {
        "formatVersion": "2.0",
        "id": "canyon_passage_collision",
        "mapId": "canyon_passage",
        "contactDamage": 0,
        "lethalContact": False,
        "corridor": {
            "id": "visual_canyon_guide",
            "samples": samples,
            "blocksPlayerProjectiles": False,
            "blocksEnemyProjectiles": False,
        },
    }


def build_routes(bounds: list[tuple[int, int]]) -> dict:
    samples = []
    for row in range(0, ROWS, 8):
        left, right = bounds[row]
        left_px, right_px = left * TILE, (right + 1) * TILE
        samples.append(
            {
                "worldY": ORIGIN_Y + row * TILE,
                "centerX": (left_px + right_px) / 2,
                "clearance": max(48, (right_px - left_px) / 2 - 16),
            }
        )
    return {
        "formatVersion": "2.0",
        "id": "canyon_passage_routes",
        "mapId": "canyon_passage",
        "routes": [{"id": "visual_centerline", "name": "Visual Canyon Centerline", "minimumRadius": 18, "samples": samples}],
    }


def main() -> None:
    map_data, bounds, occupied = build_map()
    MAP_PATH.write_text(json.dumps(map_data, indent=2) + "\n", encoding="utf-8")
    COLLISION_PATH.write_text(json.dumps(build_dormant_collision(bounds), indent=2) + "\n", encoding="utf-8")
    ROUTES_PATH.write_text(json.dumps(build_routes(bounds), indent=2) + "\n", encoding="utf-8")
    OBJECTS_PATH.write_text(
        json.dumps({"formatVersion": "2.0", "id": "canyon_passage_objects", "mapId": "canyon_passage", "objects": []}, indent=2) + "\n",
        encoding="utf-8",
    )
    component_sizes = sorted(
        len(component)
        for component in connected_components(occupied)
        if not any(x in (0, COLUMNS - 1) for x, _ in component)
    )
    print(f"Wrote {MAP_PATH.relative_to(ROOT)}")
    print(f"Explicit terrain cells: {sum(len(layer['cells']) for layer in map_data['layers'])}")
    print(f"Interior island component sizes: {component_sizes}")


if __name__ == "__main__":
    main()
