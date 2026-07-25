import { describe, expect, it } from 'vitest';
import biomeJson from '../../content/biomes/canyon.json';
import collisionJson from '../../content/collision/canyon_passage_collision.json';
import levelJson from '../../content/levels/level_01.json';
import mapJson from '../../content/maps/canyon_passage.json';
import objectsJson from '../../content/terrainObjects/canyon_passage_objects.json';
import { BiomeSchema, TerrainCollisionSchema, TerrainMapSchema, TerrainObjectSetSchema } from '../../schemas/terrainSchema';
import { LevelSchema } from '../../schemas/levelSchema';
import { blob47Mask } from './Autotile';

const map = TerrainMapSchema.parse(mapJson);
const biome = BiomeSchema.parse(biomeJson);
const collision = TerrainCollisionSchema.parse(collisionJson);
const objects = TerrainObjectSetSchema.parse(objectsJson);
const level = LevelSchema.parse(levelJson);

function components(cells: { x: number; row: number }[]): { x: number; row: number }[][] {
  const remaining = new Map(cells.map((cell) => [`${cell.x}:${cell.row}`, cell]));
  const result: { x: number; row: number }[][] = [];
  while (remaining.size > 0) {
    const first = remaining.values().next().value as { x: number; row: number };
    remaining.delete(`${first.x}:${first.row}`);
    const queue = [first];
    const component = [first];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const [x, row] of [[current.x, current.row - 1], [current.x + 1, current.row], [current.x, current.row + 1], [current.x - 1, current.row]]) {
        const key = `${x}:${row}`;
        const found = remaining.get(key);
        if (found) { remaining.delete(key); queue.push(found); component.push(found); }
      }
    }
    result.push(component);
  }
  return result;
}

describe('Epoch 18 authored canyon environment', () => {
  it('uses one continuous water plane and stores no explicit water cells', () => {
    const river = map.layers.find((layer) => layer.id === 'river_plane');
    expect(river).toMatchObject({ renderMode: 'tileSprite', materialTile: 1, scrollRatio: 1, cells: [] });
    expect(map.layers.every((layer) => layer.scrollRatio === 1)).toBe(true);
  });

  it('covers the complete mission distance', () => {
    const profile = level.scrollProfile;
    if (!profile) throw new Error('scroll profile missing');
    const missionDistance = profile.reduce((total, segment) => total + (segment.endTime - segment.startTime) * segment.speed, 0);
    expect(map.originWorldY + (map.rows - 1) * map.tileSize).toBeGreaterThanOrEqual(missionDistance);
  });

  it('stores exact Blob-47 masks while separating fill and shoreline', () => {
    const surface = map.layers.find((layer) => layer.id === 'sandstone_surface');
    const shoreline = map.layers.find((layer) => layer.id === 'shoreline');
    if (!surface || !shoreline) throw new Error('terrain layers missing');
    expect(surface).toMatchObject({ renderMode: 'compositedCells', materialTile: 3 });
    const occupied = surface.cells;
    const lookup = new Map(occupied.map((cell) => [`${cell.x}:${cell.row}`, 1]));
    const grid = { get: (x: number, row: number) => lookup.get(`${x}:${row}`) ?? 0 };
    const bounds = { maxX: 16, maxY: map.rows - 1, connectExterior: true };
    for (const cell of surface.cells) {
      expect(cell.variant).toBe(blob47Mask(grid, cell.x, cell.row, 1, bounds));
    }
    expect(shoreline.cells).toHaveLength(surface.cells.filter((cell) => cell.variant !== 255).length);
  });

  it('removes undersized islands and fragile single-cell components', () => {
    const surface = map.layers.find((layer) => layer.id === 'sandstone_surface');
    if (!surface) throw new Error('sandstone missing');
    const occupied = surface.cells;
    const islands = components(occupied).filter((component) => !component.some((cell) => cell.x === 0 || cell.x === 16));
    expect(islands).toHaveLength(4);
    expect(islands.every((component) => component.length >= 18)).toBe(true);
    for (const component of islands) {
      const rows = new Map<number, number[]>();
      for (const cell of component) rows.set(cell.row, [...(rows.get(cell.row) ?? []), cell.x]);
      expect([...rows.values()].filter((xs) => xs.length === 1)).toHaveLength(0);
    }
  });

  it('contains recognisable opening beats without stress-test density', () => {
    const surface = map.layers.find((layer) => layer.id === 'sandstone_surface');
    if (!surface) throw new Error('surface missing');
    const early = surface.cells.filter((cell) => cell.row <= 190 && cell.variant !== 255);
    const variants = new Set(early.map((cell) => cell.variant));
    expect(variants.size).toBeGreaterThanOrEqual(12);
    expect(variants.size).toBeLessThan(36);
    expect([...variants].some((mask) => mask !== undefined && (mask & 0xf0) !== 0)).toBe(true);
  });


  it('front-loads sustained 45-degree banks and all four readable inner curves', () => {
    const surface = map.layers.find((layer) => layer.id === 'sandstone_surface');
    if (!surface) throw new Error('surface missing');
    const occupied = new Set(surface.cells.map((cell) => `${cell.x}:${cell.row}`));
    const left: number[] = [];
    const right: number[] = [];
    for (let row = 0; row < 140; row += 1) {
      const water = Array.from({ length: 17 }, (_, x) => x).filter((x) => !occupied.has(`${x}:${row}`));
      left.push(Math.min(...water));
      right.push(Math.max(...water));
    }
    const runs = (values: number[]) => {
      const result: { start: number; end: number; direction: number }[] = [];
      let start = 0;
      let direction = 0;
      for (let index = 1; index < values.length; index += 1) {
        const delta = values[index] - values[index - 1];
        const next = delta === 1 ? 1 : delta === -1 ? -1 : 0;
        if (next !== 0 && next === direction) continue;
        if (direction !== 0) result.push({ start, end: index - 1, direction });
        if (next !== 0) { start = index - 1; direction = next; }
        else direction = 0;
      }
      if (direction !== 0) result.push({ start, end: values.length - 1, direction });
      return result.filter((run) => run.end - run.start + 1 >= 4);
    };
    const leftRuns = runs(left);
    const rightRuns = runs(right);
    expect(leftRuns.length).toBeGreaterThanOrEqual(4);
    expect(rightRuns.length).toBeGreaterThanOrEqual(4);
    expect(new Set(leftRuns.map((run) => run.direction))).toEqual(new Set([-1, 1]));
    expect(new Set(rightRuns.map((run) => run.direction))).toEqual(new Set([-1, 1]));

    const earlyCounts = new Map<number, number>();
    for (const cell of surface.cells.filter((cell) => cell.row <= 140 && cell.variant !== undefined)) {
      earlyCounts.set(cell.variant!, (earlyCounts.get(cell.variant!) ?? 0) + 1);
    }
    for (const mask of [19, 38, 76, 137, 127, 191, 223, 239]) {
      expect(earlyCounts.get(mask) ?? 0).toBeGreaterThanOrEqual(4);
    }
  });

  it('adds sparse independent environmental dressing and landmarks', () => {
    const counts = Object.fromEntries(map.layers.map((layer) => [layer.id, layer.cells.length]));
    expect(counts.rock_clusters).toBeGreaterThan(25);
    expect(counts.cracks).toBeGreaterThan(20);
    expect(counts.scrub).toBeGreaterThan(8);
    expect(counts.sediment).toBeGreaterThan(20);
    expect(counts.landmarks).toBeGreaterThanOrEqual(30);
    const totalDecor = counts.rock_clusters + counts.cracks + counts.scrub + counts.sediment + counts.landmarks;
    expect(totalDecor).toBeLessThan(900);
    expect(totalDecor / (map.rows * 17)).toBeLessThan(0.07);
  });

  it('keeps terrain presentation-only', () => {
    expect(biome.materials.every((material) => material.collisionRole === 'none')).toBe(true);
    expect(collision.contactDamage).toBe(0);
    expect(collision.corridor.blocksPlayerProjectiles).toBe(false);
    expect(collision.corridor.blocksEnemyProjectiles).toBe(false);
    expect(objects.objects).toEqual([]);
  });

  it('ships a 512px three-frame river and a separate 512px sandstone source plane', () => {
    const river = biome.tileset?.planes.find((candidate) => candidate.materialId === 'river');
    const sandstone = biome.tileset?.planes.find((candidate) => candidate.materialId === 'sandstone');
    expect(river).toMatchObject({ frameWidth: 512, frameHeight: 512, animationFrames: [0, 1, 2], animationFps: 0.65 });
    expect(sandstone).toMatchObject({ frameWidth: 512, frameHeight: 512, animationFrames: [0] });
  });
});
