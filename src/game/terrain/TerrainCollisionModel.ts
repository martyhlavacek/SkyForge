import type { CorridorSample, TerrainCollisionDef } from '../../schemas/terrainSchema';

export interface CorridorBounds {
  left: number;
  right: number;
}

export interface CircleResolution extends CorridorBounds {
  hit: 'left' | 'right' | null;
  correctedX: number;
  penetration: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function corridorBoundsAt(samples: CorridorSample[], worldY: number): CorridorBounds {
  if (samples.length === 0) return { left: 0, right: 544 };
  if (worldY <= samples[0].worldY) return { left: samples[0].left, right: samples[0].right };
  const last = samples[samples.length - 1];
  if (worldY >= last.worldY) return { left: last.left, right: last.right };

  let lo = 0;
  let hi = samples.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].worldY <= worldY) lo = mid;
    else hi = mid;
  }
  const a = samples[lo];
  const b = samples[hi];
  const span = b.worldY - a.worldY;
  const t = span > 0 ? (worldY - a.worldY) / span : 0;
  return { left: lerp(a.left, b.left, t), right: lerp(a.right, b.right, t) };
}

export function resolveCircleInCorridor(
  collision: Pick<TerrainCollisionDef, 'corridor'>,
  worldY: number,
  x: number,
  radius: number,
): CircleResolution {
  const bounds = corridorBoundsAt(collision.corridor.samples, worldY);
  const minimumX = bounds.left + radius;
  const maximumX = bounds.right - radius;
  if (x < minimumX) {
    return {
      ...bounds,
      hit: 'left',
      correctedX: minimumX,
      penetration: minimumX - x,
    };
  }
  if (x > maximumX) {
    return {
      ...bounds,
      hit: 'right',
      correctedX: maximumX,
      penetration: x - maximumX,
    };
  }
  return { ...bounds, hit: null, correctedX: x, penetration: 0 };
}

export function pointInsideCorridor(
  collision: Pick<TerrainCollisionDef, 'corridor'>,
  worldY: number,
  x: number,
  margin = 0,
): boolean {
  const bounds = corridorBoundsAt(collision.corridor.samples, worldY);
  return x >= bounds.left + margin && x <= bounds.right - margin;
}

export interface SweepPoint {
  x: number;
  worldY: number;
}

export interface CorridorSweepHit extends CircleResolution {
  t: number;
  worldY: number;
}

/**
 * Samples a moving navigation circle along its complete frame trajectory.
 * This is deterministic and prevents a high-speed craft from tunnelling
 * through a rapidly narrowing corridor between rendered frames.
 */
export function sweepCircleInCorridor(
  collision: Pick<TerrainCollisionDef, 'corridor'>,
  from: SweepPoint,
  to: SweepPoint,
  radius: number,
  maxStep = Math.max(4, radius * 0.5),
): CorridorSweepHit | null {
  const distance = Math.hypot(to.x - from.x, to.worldY - from.worldY);
  const steps = Math.max(1, Math.ceil(distance / Math.max(1, maxStep)));
  for (let index = 0; index <= steps; index++) {
    const t = index / steps;
    const x = lerp(from.x, to.x, t);
    const worldY = lerp(from.worldY, to.worldY, t);
    const resolution = resolveCircleInCorridor(collision, worldY, x, radius);
    if (resolution.hit) return { ...resolution, t, worldY };
  }
  return null;
}

export interface AxisAlignedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Returns the first normalized trajectory time at which a circle moving
 * from `from` to `to` touches an axis-aligned rectangle. The rectangle is
 * expanded by the circle radius and tested with a standard slab segment
 * intersection, making the result suitable for gates and barriers.
 */
export function sweepCircleAgainstRect(
  from: { x: number; y: number },
  to: { x: number; y: number },
  radius: number,
  rect: AxisAlignedRect,
): number | null {
  const minX = rect.x - radius;
  const maxX = rect.x + rect.width + radius;
  const minY = rect.y - radius;
  const maxY = rect.y + rect.height + radius;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let enter = 0;
  let exit = 1;

  const clip = (origin: number, delta: number, minimum: number, maximum: number) => {
    if (Math.abs(delta) < 1e-9) return origin >= minimum && origin <= maximum;
    let near = (minimum - origin) / delta;
    let far = (maximum - origin) / delta;
    if (near > far) [near, far] = [far, near];
    enter = Math.max(enter, near);
    exit = Math.min(exit, far);
    return enter <= exit;
  };

  if (!clip(from.x, dx, minX, maxX) || !clip(from.y, dy, minY, maxY)) return null;
  return enter >= 0 && enter <= 1 ? enter : null;
}
