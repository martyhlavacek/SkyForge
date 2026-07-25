import { describe, expect, it } from 'vitest';
import { WorldScroll } from './WorldScroll';

const scrollStub = { scrollSpeedMultiplier: 1 } as never;

describe('WorldScroll', () => {
  it('uses baseScrollSpeed with no profile', () => {
    const w = new WorldScroll({ baseScrollSpeed: 100, scrollProfile: undefined }, scrollStub);
    w.recompute(12);
    expect(w.distance).toBe(1200);
  });

  it('integrates a segmented profile analytically', () => {
    const w = new WorldScroll(
      {
        baseScrollSpeed: 100,
        scrollProfile: [
          { startTime: 0, endTime: 20, speed: 70 },
          { startTime: 20, endTime: 170, speed: 100 },
          { startTime: 170, endTime: 200, speed: 40 },
        ],
      },
      scrollStub,
    );
    w.recompute(20);
    expect(w.distance).toBe(1400); // addendum §4 example, first segment
    w.recompute(200);
    expect(w.distance).toBe(1400 + 15000 + 1200);
  });

  it('extends past the profile at the last segment speed', () => {
    const w = new WorldScroll(
      { baseScrollSpeed: 100, scrollProfile: [{ startTime: 0, endTime: 10, speed: 50 }] },
      scrollStub,
    );
    w.recompute(14);
    expect(w.distance).toBe(500 + 4 * 50);
  });

  it('incremental update matches analytic recompute for constant speed', () => {
    const w = new WorldScroll({ baseScrollSpeed: 100, scrollProfile: undefined }, scrollStub);
    for (let i = 0; i < 600; i++) w.update(1 / 60, i / 60);
    expect(w.distance).toBeCloseTo(1000, 6);
  });
});
