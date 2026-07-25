import { beforeEach, describe, expect, it } from 'vitest';
import { telemetry } from './Telemetry';

beforeEach(() => telemetry.reset());

describe('Telemetry (Sprint 9.5)', () => {
  it('records deaths with position and time', () => {
    telemetry.recordDeath(42, 100, 200);
    expect(telemetry.snapshot().deaths).toEqual([{ levelTime: 42, x: 100, y: 200 }]);
  });

  it('accumulates weapon time', () => {
    telemetry.addWeaponTime('pulse_cannon', 1.5);
    telemetry.addWeaponTime('pulse_cannon', 0.5);
    expect(telemetry.snapshot().weaponSeconds.pulse_cannon).toBeCloseTo(2);
  });

  it('tracks the time-weighted average multiplier', () => {
    telemetry.sampleMultiplier(1, 3);
    telemetry.sampleMultiplier(3, 1);
    expect(telemetry.snapshot().avgMultiplier).toBeCloseTo(1.5);
  });

  it('records damage separately from deaths', () => {
    telemetry.recordDamage(12, 4, 5);
    expect(telemetry.snapshot().damage).toEqual([{ levelTime: 12, x: 4, y: 5 }]);
  });

  it('calculates frame-time percentiles', () => {
    [10, 12, 14, 16, 30].forEach((ms) => telemetry.sampleFrame(ms));
    const frame = telemetry.snapshot().frameTimeMs;
    expect(frame.p50).toBe(14);
    expect(frame.p95).toBe(30);
    expect(frame.samples).toBe(5);
  });

  it('captures the projectile peak', () => {
    telemetry.sampleProjectiles(120);
    telemetry.sampleProjectiles(80);
    telemetry.sampleProjectiles(200);
    expect(telemetry.snapshot().projectilePeak).toBe(200);
  });

  it('counts one fps drop per sustained low-fps second', () => {
    for (let i = 0; i < 20; i++) telemetry.sampleFps(40, 0.1); // 2s low → 2 drops
    expect(telemetry.snapshot().fpsDrops).toBe(2);
  });

  it('does not count brief dips', () => {
    telemetry.sampleFps(40, 0.5); // <1s
    telemetry.sampleFps(60, 0.5); // recovers
    expect(telemetry.snapshot().fpsDrops).toBe(0);
  });
});
