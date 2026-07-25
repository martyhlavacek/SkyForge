import { describe, expect, it } from 'vitest';
import { normalizeMusicOffset } from './MusicDirector';

describe('normalizeMusicOffset', () => {
  it('preserves a non-looping introduction', () => {
    expect(normalizeMusicOffset(2, 8, 24)).toBe(2);
    expect(normalizeMusicOffset(7.99, 8, 24)).toBeCloseTo(7.99);
  });

  it('preserves positions inside the first loop pass', () => {
    expect(normalizeMusicOffset(8, 8, 24)).toBe(8);
    expect(normalizeMusicOffset(23, 8, 24)).toBe(23);
  });

  it('wraps elapsed positions into the loop region', () => {
    expect(normalizeMusicOffset(24, 8, 24)).toBe(8);
    expect(normalizeMusicOffset(29, 8, 24)).toBe(13);
    expect(normalizeMusicOffset(41, 8, 24)).toBe(9);
  });

  it('handles zero-length cues and negative offsets safely', () => {
    expect(normalizeMusicOffset(-5, 0, 0)).toBe(0);
    expect(normalizeMusicOffset(10, 0, 0)).toBe(10);
  });
});
