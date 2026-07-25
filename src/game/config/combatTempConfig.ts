/**
 * TEMPORARY spawner cadence (Sprint 2.1). Deleted in S4.4 when the level
 * timeline owns all spawning. Combat stats now live in src/content/ JSON
 * (Epoch 3) — nothing else may hardcode them.
 */
export const TEMP_SPAWNER = {
  interval: 1.2, // s
  minX: 60,
  maxX: 480,
  spawnY: -40,
} as const;
