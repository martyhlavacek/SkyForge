import { describe, expect, it } from 'vitest';
import { createMovementState, step } from './MovementRunner';
import type { MovementDef } from '../../schemas/movementSchema';

const CTX = { targetX: 270 };

/** Advance a state in small fixed steps to a target time. */
function advanceTo(state: ReturnType<typeof createMovementState>, def: MovementDef, t: number) {
  const stepSize = 1 / 240;
  let last = { x: state.x, y: state.y, done: false };
  let elapsed = 0;
  while (elapsed + stepSize <= t) {
    last = step(state, def, stepSize, CTX);
    elapsed += stepSize;
  }
  const rem = t - elapsed;
  if (rem > 1e-9) last = step(state, def, rem, CTX);
  return last;
}

describe('MovementRunner: sine', () => {
  const def: MovementDef = {
    id: 'sine_test',
    type: 'sine',
    verticalSpeed: 110,
    horizontalAmplitude: 80,
    frequency: 1.4,
    duration: 8,
  };
  const period = 1 / 1.4;

  it('starts at origin x', () => {
    const s = createMovementState(100, -40);
    const r = step(s, def, 0, CTX);
    expect(r.x).toBeCloseTo(100, 5);
  });

  it('reaches +amplitude at quarter period', () => {
    const s = createMovementState(100, -40);
    const r = advanceTo(s, def, period / 4);
    expect(r.x).toBeCloseTo(100 + 80, 3);
  });

  it('returns to origin x at half period', () => {
    const s = createMovementState(100, -40);
    const r = advanceTo(s, def, period / 2);
    expect(r.x).toBeCloseTo(100, 3);
  });

  it('descends at verticalSpeed', () => {
    const s = createMovementState(100, -40);
    const r = advanceTo(s, def, 2);
    expect(r.y).toBeCloseTo(-40 + 220, 3);
  });

  it('reports done after duration', () => {
    const s = createMovementState(100, -40);
    const r = advanceTo(s, def, 8.01);
    expect(r.done).toBe(true);
  });
});

describe('MovementRunner: patrol', () => {
  const def: MovementDef = {
    id: 'patrol_test',
    type: 'patrol',
    y: 200,
    horizontalSpeed: 100,
    leftX: 80,
    rightX: 460,
    entrySpeed: 200,
  };

  it('descends to patrol altitude then holds y', () => {
    const s = createMovementState(100, 0);
    const r = advanceTo(s, def, 1.5); // entry needs 1.0s (200px @ 200px/s)
    expect(r.y).toBe(200);
  });

  it('reverses at the right boundary', () => {
    const s = createMovementState(100, 0);
    // Entry 1.0s, then 360px to rightX at 100px/s = 3.6s; go past it.
    advanceTo(s, def, 5.0);
    const before = s.x;
    expect(before).toBeLessThanOrEqual(460);
    // After hitting rightX, direction flips to leftward.
    const r = advanceTo(s, def, 1.0);
    expect(r.x).toBeLessThan(460);
  });

  it('never exceeds the patrol bounds', () => {
    const s = createMovementState(100, 0);
    for (let i = 0; i < 20 * 60; i++) {
      const r = step(s, def, 1 / 60, CTX);
      if (s.phase === 1) {
        expect(r.x).toBeGreaterThanOrEqual(80);
        expect(r.x).toBeLessThanOrEqual(460);
      }
    }
  });
});

describe('MovementRunner: bezier', () => {
  const def: MovementDef = {
    id: 'bezier_test',
    type: 'bezier',
    points: [
      [0, 0],
      [-220, 320],
      [220, 640],
      [0, 1100],
    ],
    duration: 7,
  };

  it('starts at spawn and ends at spawn + p3', () => {
    const s = createMovementState(270, -40);
    const start = step(s, def, 1e-9, CTX);
    expect(start.x).toBeCloseTo(270, 2);
    const end = advanceTo(s, def, 7.01);
    expect(end.x).toBeCloseTo(270 + 0, 2);
    expect(end.y).toBeCloseTo(-40 + 1100, 2);
    expect(end.done).toBe(true);
  });
});

describe('MovementRunner: stop_and_fire', () => {
  const def: MovementDef = {
    id: 'saf_test',
    type: 'stop_and_fire',
    entrySpeed: 200,
    stopY: 180,
    holdDuration: 2,
    exitAngleDeg: -90,
    exitSpeed: 100,
    holdFireRateMultiplier: 0.5,
  };

  it('parks at stopY and halves weapon cooldown while holding', () => {
    const s = createMovementState(270, -20);
    advanceTo(s, def, 1.5); // entry needs 1.0s
    expect(s.y).toBe(180);
    expect(s.fireRateMultiplier).toBe(0.5);
  });

  it('exits upward after holdDuration at normal fire rate', () => {
    const s = createMovementState(270, -20);
    advanceTo(s, def, 3.5); // 1.0 entry + 2.0 hold + 0.5 exit
    expect(s.fireRateMultiplier).toBe(1);
    expect(s.y).toBeLessThan(180);
  });
});

describe('MovementRunner: dive_retreat', () => {
  const def: MovementDef = {
    id: 'dr_test',
    type: 'dive_retreat',
    diveTargetYOffset: 400,
    diveSpeed: 400,
    pauseDuration: 0.5,
    retreatSpeed: 200,
  };

  it('dives toward the captured target X, pauses, then retreats upward', () => {
    const s = createMovementState(100, 0);
    advanceTo(s, def, 1.2); // dive length ~sqrt(170^2+400^2)≈434px @400 → ~1.09s
    expect(s.x).toBeCloseTo(CTX.targetX, 1);
    expect(s.y).toBeCloseTo(400, 1);
    const yAtPause = s.y;
    advanceTo(s, def, 0.3); // dive ended at ~1.087s; 1.2+0.3=1.5s is still inside the 0.5s pause
    expect(s.y).toBeCloseTo(yAtPause, 3);
    advanceTo(s, def, 1.0); // retreating
    expect(s.y).toBeLessThan(yAtPause);
  });
});
