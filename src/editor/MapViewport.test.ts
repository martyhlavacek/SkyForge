import { describe, expect, it } from 'vitest';
import { hitTestTerrainObject, mapPointerToCell, VIEW_ROWS } from './MapViewport';
import type { TerrainObjectDef } from '../schemas/terrainSchema';

describe('mapPointerToCell', () => {
  const rect = { left: 100, top: 50, width: 272, height: 480 };
  const map = { tileSize: 32, worldWidth: 544 } as const;

  it('maps scaled canvas coordinates to the correct tile and row', () => {
    const result = mapPointerToCell(
      100 + 272 / 2,
      50 + 480 / 2,
      rect,
      544,
      960,
      map,
      0,
    );
    expect(result.cellX).toBe(8);
    expect(result.row).toBe(14);
    expect(result.worldX).toBe(272);
  });

  it('honors the visible row offset and clamps at map edges', () => {
    const topRight = mapPointerToCell(9999, -9999, rect, 544, 960, map, 120);
    expect(topRight.cellX).toBe(16);
    expect(topRight.row).toBe(120 + VIEW_ROWS - 1);
    expect(topRight.worldX).toBe(544);

    const bottomLeft = mapPointerToCell(-9999, 9999, rect, 544, 960, map, 120);
    expect(bottomLeft.cellX).toBe(0);
    expect(bottomLeft.row).toBe(120);
    expect(bottomLeft.worldX).toBe(0);
  });
});

describe('hitTestTerrainObject', () => {
  const objects: TerrainObjectDef[] = [
    {
      type: 'gate',
      id: 'gate_a',
      x: 200,
      worldY: 1000,
      width: 120,
      height: 30,
      openingWidth: 60,
      initialState: 'closed',
      damage: 20,
    },
    {
      type: 'barrier',
      id: 'barrier_b',
      x: 360,
      worldY: 1300,
      width: 48,
      height: 80,
      hitPoints: 100,
      creditValue: 25,
      damage: 20,
    },
  ];

  it('selects only an object whose rectangle contains the pointer', () => {
    expect(hitTestTerrainObject(objects, 200, 1000)?.id).toBe('gate_a');
    expect(hitTestTerrainObject(objects, 360, 1325)?.id).toBe('barrier_b');
    expect(hitTestTerrainObject(objects, 200, 1100)).toBeNull();
  });

  it('prefers the visually topmost object when rectangles overlap', () => {
    const overlapping: TerrainObjectDef[] = [objects[0], { ...objects[0], id: 'gate_top' }];
    expect(hitTestTerrainObject(overlapping, 200, 1000)?.id).toBe('gate_top');
  });
});
