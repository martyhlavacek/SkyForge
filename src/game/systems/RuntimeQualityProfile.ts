export interface RuntimeQualityProfile {
  maxEnemyBullets: number;
  particleScale: number;
}

/** Select once per run; pools are intentionally not resized mid-mission. */
export function runtimeQualityProfile(
  touchPrimary: boolean,
  reducedParticles: boolean,
): RuntimeQualityProfile {
  return {
    maxEnemyBullets: touchPrimary ? 300 : 500,
    particleScale: reducedParticles || touchPrimary ? 0.5 : 1,
  };
}
