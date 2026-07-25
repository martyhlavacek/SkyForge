/**
 * Seeded Mulberry32 RNG. The stateful form supports checkpoint snapshots so
 * drops and procedural rewards replay deterministically after a retry.
 */
export interface StatefulRng {
  next(): number;
  snapshot(): number;
}

export function createMulberry32(seed: number, restoredState?: number): StatefulRng {
  let state = (restoredState ?? seed) >>> 0;
  return {
    next(): number {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), 1 | t);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    snapshot(): number {
      return state >>> 0;
    },
  };
}

/** Backward-compatible functional form used by existing call sites. */
export function mulberry32(seed: number): () => number {
  const rng = createMulberry32(seed);
  return () => rng.next();
}
