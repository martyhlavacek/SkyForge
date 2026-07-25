export const CARDINAL = { NORTH: 1, EAST: 2, SOUTH: 4, WEST: 8 } as const;
export const BLOB47 = {
  NORTH: 1,
  EAST: 2,
  SOUTH: 4,
  WEST: 8,
  NORTHEAST: 16,
  SOUTHEAST: 32,
  SOUTHWEST: 64,
  NORTHWEST: 128,
} as const;

export interface GridReader {
  get(x: number, y: number): number;
}

export interface CardinalBounds {
  minX?: number;
  maxX: number;
  minY?: number;
  maxY: number;
  /** Treat cells beyond the authored map as continuation of the current material. */
  connectExterior?: boolean;
}

function matchesMaterial(
  grid: GridReader,
  x: number,
  y: number,
  material: number,
  bounds?: CardinalBounds,
): boolean {
  if (bounds) {
    const minX = bounds.minX ?? 0;
    const minY = bounds.minY ?? 0;
    if (x < minX || x > bounds.maxX || y < minY || y > bounds.maxY) {
      return bounds.connectExterior === true;
    }
  }
  return grid.get(x, y) === material;
}

/** Four-neighbour mask used by the deterministic connected-terrain renderer. */
export function cardinalMask(
  grid: GridReader,
  x: number,
  y: number,
  material: number,
  bounds?: CardinalBounds,
): number {
  let mask = 0;
  if (matchesMaterial(grid, x, y - 1, material, bounds)) mask |= CARDINAL.NORTH;
  if (matchesMaterial(grid, x + 1, y, material, bounds)) mask |= CARDINAL.EAST;
  if (matchesMaterial(grid, x, y + 1, material, bounds)) mask |= CARDINAL.SOUTH;
  if (matchesMaterial(grid, x - 1, y, material, bounds)) mask |= CARDINAL.WEST;
  return mask;
}

/** Canonical Blob-47 mask: diagonals only exist when both supporting cardinals exist. */
export function normalizeBlob47Mask(mask: number): number {
  let normalized = mask & (BLOB47.NORTH | BLOB47.EAST | BLOB47.SOUTH | BLOB47.WEST);
  if (
    (mask & BLOB47.NORTHEAST) !== 0 &&
    (normalized & BLOB47.NORTH) !== 0 &&
    (normalized & BLOB47.EAST) !== 0
  ) {
    normalized |= BLOB47.NORTHEAST;
  }
  if (
    (mask & BLOB47.SOUTHEAST) !== 0 &&
    (normalized & BLOB47.SOUTH) !== 0 &&
    (normalized & BLOB47.EAST) !== 0
  ) {
    normalized |= BLOB47.SOUTHEAST;
  }
  if (
    (mask & BLOB47.SOUTHWEST) !== 0 &&
    (normalized & BLOB47.SOUTH) !== 0 &&
    (normalized & BLOB47.WEST) !== 0
  ) {
    normalized |= BLOB47.SOUTHWEST;
  }
  if (
    (mask & BLOB47.NORTHWEST) !== 0 &&
    (normalized & BLOB47.NORTH) !== 0 &&
    (normalized & BLOB47.WEST) !== 0
  ) {
    normalized |= BLOB47.NORTHWEST;
  }
  return normalized;
}

export function blob47Mask(
  grid: GridReader,
  x: number,
  y: number,
  material: number,
  bounds?: CardinalBounds,
): number {
  let mask = cardinalMask(grid, x, y, material, bounds);
  const north = (mask & BLOB47.NORTH) !== 0;
  const east = (mask & BLOB47.EAST) !== 0;
  const south = (mask & BLOB47.SOUTH) !== 0;
  const west = (mask & BLOB47.WEST) !== 0;
  if (north && east && matchesMaterial(grid, x + 1, y - 1, material, bounds)) {
    mask |= BLOB47.NORTHEAST;
  }
  if (south && east && matchesMaterial(grid, x + 1, y + 1, material, bounds)) {
    mask |= BLOB47.SOUTHEAST;
  }
  if (south && west && matchesMaterial(grid, x - 1, y + 1, material, bounds)) {
    mask |= BLOB47.SOUTHWEST;
  }
  if (north && west && matchesMaterial(grid, x - 1, y - 1, material, bounds)) {
    mask |= BLOB47.NORTHWEST;
  }
  return normalizeBlob47Mask(mask);
}

export const VALID_BLOB47_MASKS: number[] = Array.from({ length: 256 }, (_, value) =>
  normalizeBlob47Mask(value),
).filter((value, index, values) => values.indexOf(value) === index);

export interface OverlayEdge {
  edge: 'north' | 'east' | 'south' | 'west';
  rotation: 0 | 90 | 180 | 270;
}

/** Minimal dual-grid overlay descriptor for natural material boundaries. */
export function overlayEdges(mask: number): OverlayEdge[] {
  const result: OverlayEdge[] = [];
  if ((mask & CARDINAL.NORTH) === 0) result.push({ edge: 'north', rotation: 0 });
  if ((mask & CARDINAL.EAST) === 0) result.push({ edge: 'east', rotation: 90 });
  if ((mask & CARDINAL.SOUTH) === 0) result.push({ edge: 'south', rotation: 180 });
  if ((mask & CARDINAL.WEST) === 0) result.push({ edge: 'west', rotation: 270 });
  return result;
}

export interface AutotileCell {
  x: number;
  row: number;
  tile: number;
  variant?: number;
}

/** Assigns a deterministic N/E/S/W variant to every occupied cell. */
export function withCardinalVariants(
  cells: AutotileCell[],
  bounds?: CardinalBounds,
): AutotileCell[] {
  const lookup = new Map(cells.map((cell) => [`${cell.x}:${cell.row}`, cell.tile]));
  const grid: GridReader = {
    get(x, y) {
      return lookup.get(`${x}:${y}`) ?? 0;
    },
  };
  return cells.map((cell) => ({
    ...cell,
    variant: cardinalMask(grid, cell.x, cell.row, cell.tile, bounds),
  }));
}

/** Assigns a Blob-47 variant to every occupied cell. */
export function withBlob47Variants(
  cells: AutotileCell[],
  bounds?: CardinalBounds,
): AutotileCell[] {
  const lookup = new Map(cells.map((cell) => [`${cell.x}:${cell.row}`, cell.tile]));
  const grid: GridReader = {
    get(x, y) {
      return lookup.get(`${x}:${y}`) ?? 0;
    },
  };
  return cells.map((cell) => ({
    ...cell,
    variant: blob47Mask(grid, cell.x, cell.row, cell.tile, bounds),
  }));
}

/**
 * Generates the reproducible edge-overlay layer for natural terrain. Interior
 * cells are omitted; boundary cells reuse the exact adjacency mask of the base
 * material so the atlas can select a matching shoreline/rim frame.
 */
export function boundaryOverlayCells(
  baseCells: AutotileCell[],
  overlayTile: number,
  bounds?: CardinalBounds,
): AutotileCell[] {
  return withCardinalVariants(baseCells, bounds)
    .filter((cell) => cell.variant !== 15)
    .map((cell) => ({
      x: cell.x,
      row: cell.row,
      tile: overlayTile,
      variant: cell.variant,
    }));
}

export function boundaryOverlayCellsBlob47(
  baseCells: AutotileCell[],
  overlayTile: number,
  bounds?: CardinalBounds,
): AutotileCell[] {
  return withBlob47Variants(baseCells, bounds)
    .filter((cell) => cell.variant !== 255)
    .map((cell) => ({
      x: cell.x,
      row: cell.row,
      tile: overlayTile,
      variant: cell.variant,
    }));
}
