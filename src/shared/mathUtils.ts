/**
 * Pure math helpers shared by game runtime, tests, and (later) the editor.
 * Keep this module free of Phaser imports so Vitest runs it in plain node.
 */

/** Clamp v into [min, max]. */
export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/**
 * Angle in radians from point 1 to point 2.
 * 0 = +X (right), PI/2 = +Y (down, screen coordinates).
 */
export function angleTo(x1: number, y1: number, x2: number, y2: number): number {
  return Math.atan2(y2 - y1, x2 - x1);
}

/** Degrees → radians. */
export function deg2rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Cubic Bézier point at t ∈ [0,1] for four control points (Sprint 3.5). */
export function cubicBezier(
  t: number,
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
): [number, number] {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ];
}

/**
 * Steer `current` heading toward `target` heading by at most `maxDelta`
 * radians, taking the shortest angular direction (Sprint 5.4 homing).
 * All angles in radians; result normalized to (-PI, PI].
 */
export function steerAngle(current: number, target: number, maxDelta: number): number {
  let diff = target - current;
  // Wrap into (-PI, PI].
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff <= -Math.PI) diff += 2 * Math.PI;
  const clamped = Math.max(-maxDelta, Math.min(maxDelta, diff));
  let result = current + clamped;
  while (result > Math.PI) result -= 2 * Math.PI;
  while (result <= -Math.PI) result += 2 * Math.PI;
  return result;
}
