import { describe, expect, it } from 'vitest';
import { minimapRowFromPointer } from './LevelMinimap';

describe('minimapRowFromPointer', () => {
  const rect = { top: 100, height: 500 };

  it('maps the top of the minimap to the end of the level', () => {
    expect(minimapRowFromPointer(100, rect, 400)).toBe(370);
  });

  it('maps the bottom of the minimap to the start of the level', () => {
    expect(minimapRowFromPointer(600, rect, 400)).toBe(0);
  });

  it('clamps pointer positions outside the minimap', () => {
    expect(minimapRowFromPointer(-1000, rect, 60)).toBe(30);
    expect(minimapRowFromPointer(5000, rect, 60)).toBe(0);
  });
});
