import { describe, expect, it } from 'vitest';
import { angleTo, clamp, cubicBezier, deg2rad, steerAngle } from './mathUtils';

describe('clamp', () => {
  it('returns the value when inside the range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps below the minimum', () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });

  it('clamps above the maximum', () => {
    expect(clamp(42, 0, 10)).toBe(10);
  });

  it('handles min === max', () => {
    expect(clamp(7, 3, 3)).toBe(3);
  });
});

describe('angleTo', () => {
  it('points right at 0 radians', () => {
    expect(angleTo(0, 0, 10, 0)).toBeCloseTo(0);
  });

  it('points down (screen +Y) at PI/2', () => {
    expect(angleTo(0, 0, 0, 10)).toBeCloseTo(Math.PI / 2);
  });

  it('points left at PI', () => {
    expect(Math.abs(angleTo(0, 0, -10, 0))).toBeCloseTo(Math.PI);
  });

  it('points up (screen -Y) at -PI/2', () => {
    expect(angleTo(0, 0, 0, -10)).toBeCloseTo(-Math.PI / 2);
  });

  it('handles diagonals', () => {
    expect(angleTo(0, 0, 10, 10)).toBeCloseTo(Math.PI / 4);
  });
});

describe('cubicBezier', () => {
  const p0: [number, number] = [0, 0];
  const p1: [number, number] = [-220, 320];
  const p2: [number, number] = [220, 640];
  const p3: [number, number] = [0, 1100];

  it('returns p0 at t=0', () => {
    expect(cubicBezier(0, p0, p1, p2, p3)).toEqual([0, 0]);
  });

  it('returns p3 at t=1', () => {
    expect(cubicBezier(1, p0, p1, p2, p3)).toEqual([0, 1100]);
  });

  it('evaluates the midpoint correctly', () => {
    // At t=0.5: (p0 + 3*p1 + 3*p2 + p3) / 8
    const [x, y] = cubicBezier(0.5, p0, p1, p2, p3);
    expect(x).toBeCloseTo((0 + 3 * -220 + 3 * 220 + 0) / 8);
    expect(y).toBeCloseTo((0 + 3 * 320 + 3 * 640 + 1100) / 8);
  });
});

describe('deg2rad', () => {
  it('converts 90 degrees to PI/2', () => {
    expect(deg2rad(90)).toBeCloseTo(Math.PI / 2);
  });
});

describe('steerAngle', () => {
  it('reaches the target when within maxDelta', () => {
    expect(steerAngle(0, 0.1, 0.5)).toBeCloseTo(0.1);
  });

  it('clamps to maxDelta when target is far', () => {
    expect(steerAngle(0, Math.PI / 2, 0.1)).toBeCloseTo(0.1);
  });

  it('takes the shortest direction across the wrap boundary', () => {
    // From 170° toward -170°: shortest step is +20° (crossing +180°),
    // within the 30° cap, so it reaches the target at -170°.
    const from = (170 * Math.PI) / 180;
    const to = (-170 * Math.PI) / 180;
    const next = steerAngle(from, to, (30 * Math.PI) / 180);
    expect(next).toBeCloseTo((-170 * Math.PI) / 180, 4);

    // And when the cap is smaller than the needed step, it stops short.
    const capped = steerAngle(from, to, (10 * Math.PI) / 180);
    expect(capped).toBeCloseTo((180 * Math.PI) / 180, 4);
  });

  it('steers negatively when target is clockwise', () => {
    expect(steerAngle(1.0, 0.0, 0.3)).toBeCloseTo(0.7);
  });
});
