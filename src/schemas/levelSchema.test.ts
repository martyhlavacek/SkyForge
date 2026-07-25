import { describe, expect, it } from 'vitest';
import { LevelSchema } from './levelSchema';

const valid = {
  formatVersion: '1.0',
  id: 'test',
  displayName: 'Test',
  music: 'none',
  durationTarget: 30,
  baseScrollSpeed: 100,
  scrollProfile: [
    { startTime: 0, endTime: 10, speed: 80 },
    { startTime: 10, endTime: 30, speed: 100 },
  ],
  events: [
    { at: 1, encounter: 'opening' },
    { at: 20, type: 'checkpoint', name: 'cp' },
  ],
  groundObjects: [{ type: 'turret', id: 't1', worldY: 100, x: 200 }],
} as const;

describe('LevelSchema semantics', () => {
  it('accepts an ordered level', () => {
    expect(LevelSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects out-of-order events', () => {
    const bad = {
      ...valid,
      events: [
        { at: 20, encounter: 'a' },
        { at: 5, encounter: 'b' },
      ],
    };
    expect(LevelSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects overlapping scroll segments', () => {
    const bad = {
      ...valid,
      scrollProfile: [
        { startTime: 0, endTime: 15, speed: 80 },
        { startTime: 10, endTime: 20, speed: 100 },
      ],
    };
    expect(LevelSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects duplicate checkpoint names', () => {
    const bad = {
      ...valid,
      events: [
        { at: 5, type: 'checkpoint', name: 'same' },
        { at: 10, type: 'checkpoint', name: 'same' },
      ],
    };
    expect(LevelSchema.safeParse(bad).success).toBe(false);
  });
});
