import { describe, expect, it } from 'vitest';
import {
  BLOB47,
  VALID_BLOB47_MASKS,
  blob47Mask,
  boundaryOverlayCells,
  boundaryOverlayCellsBlob47,
  CARDINAL,
  cardinalMask,
  normalizeBlob47Mask,
  overlayEdges,
  withBlob47Variants,
  withCardinalVariants,
} from './Autotile';

const values = new Map<string, number>([
  ['1:1', 3], ['1:0', 3], ['2:1', 3], ['0:1', 3], ['0:0', 3],
]);
const grid = { get: (x: number, y: number) => values.get(`${x}:${y}`) ?? 0 };

describe('Autotile', () => {
  it('builds a cardinal mask', () => {
    expect(cardinalMask(grid, 1, 1, 3)).toBe(CARDINAL.NORTH | CARDINAL.EAST | CARDINAL.WEST);
  });

  it('normalizes blob masks to the canonical 47-tile set', () => {
    expect(VALID_BLOB47_MASKS).toHaveLength(47);
    expect(normalizeBlob47Mask(BLOB47.NORTHEAST)).toBe(0);
    expect(normalizeBlob47Mask(BLOB47.NORTH | BLOB47.EAST | BLOB47.NORTHEAST)).toBe(19);
  });

  it('builds a blob47 mask with valid diagonals only', () => {
    expect(blob47Mask(grid, 1, 1, 3)).toBe(BLOB47.NORTH | BLOB47.EAST | BLOB47.WEST | BLOB47.NORTHWEST);
  });

  it('describes missing boundary overlays', () => {
    expect(overlayEdges(CARDINAL.NORTH | CARDINAL.WEST).map((e) => e.edge)).toEqual(['east', 'south']);
  });

  it('assigns cardinal variants from neighbouring cells', () => {
    const result = withCardinalVariants([
      { x: 0, row: 0, tile: 3 },
      { x: 1, row: 0, tile: 3 },
      { x: 0, row: 1, tile: 3 },
    ]);
    expect(result.find((cell) => cell.x === 0 && cell.row === 0)?.variant).toBe(6);
    expect(result.find((cell) => cell.x === 1 && cell.row === 0)?.variant).toBe(8);
  });

  it('assigns blob47 variants from neighbouring cells', () => {
    const result = withBlob47Variants([
      { x: 0, row: 0, tile: 3 },
      { x: 1, row: 0, tile: 3 },
      { x: 0, row: 1, tile: 3 },
      { x: 1, row: 1, tile: 3 },
    ]);
    expect(result.find((cell) => cell.x === 0 && cell.row === 0)?.variant).toBe(38);
    expect(result.find((cell) => cell.x === 1 && cell.row === 1)?.variant).toBe(137);
  });

  it('connects terrain to the authored map exterior when requested', () => {
    const result = withCardinalVariants(
      [{ x: 0, row: 0, tile: 3 }],
      { maxX: 0, maxY: 0, connectExterior: true },
    );
    expect(result[0]?.variant).toBe(15);
  });

  it('generates only exposed natural-boundary overlay cells', () => {
    const base = [] as { x: number; row: number; tile: number }[];
    for (let row = 0; row < 3; row++)
      for (let x = 0; x < 3; x++) base.push({ x, row, tile: 3 });
    const overlay = boundaryOverlayCells(base, 4);
    expect(overlay).toHaveLength(8);
    expect(overlay.some((cell) => cell.x === 1 && cell.row === 1)).toBe(false);
    expect(new Set(overlay.map((cell) => cell.tile))).toEqual(new Set([4]));
  });

  it('omits fully surrounded blob47 cells from shoreline overlays', () => {
    const base = [] as { x: number; row: number; tile: number }[];
    for (let row = 0; row < 3; row++)
      for (let x = 0; x < 3; x++) base.push({ x, row, tile: 3 });
    const overlay = boundaryOverlayCellsBlob47(base, 4);
    expect(overlay).toHaveLength(8);
    expect(overlay.some((cell) => cell.x === 1 && cell.row === 1)).toBe(false);
  });
});
