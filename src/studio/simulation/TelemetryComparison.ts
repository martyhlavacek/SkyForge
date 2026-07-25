import type { RuntimeTelemetrySeriesPoint } from './SimulationTypes';

export interface TelemetrySummary {
  duration: number;
  meanEnemies: number;
  peakEnemies: number;
  meanEnemyProjectiles: number;
  peakEnemyProjectiles: number;
  meanSurvivability: number;
  minimumSurvivability: number;
  meanIntensity: number;
  peakIntensity: number;
  p95FrameMs: number;
}

function mean(values: number[]): number {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function percentile(values: number[], q: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * q) - 1)];
}

export function summarizeTelemetry(
  points: RuntimeTelemetrySeriesPoint[],
): TelemetrySummary {
  if (!points.length) {
    return {
      duration: 0,
      meanEnemies: 0,
      peakEnemies: 0,
      meanEnemyProjectiles: 0,
      peakEnemyProjectiles: 0,
      meanSurvivability: 1,
      minimumSurvivability: 1,
      meanIntensity: 0,
      peakIntensity: 0,
      p95FrameMs: 0,
    };
  }
  return {
    duration: Math.max(0, points.at(-1)!.time - points[0].time),
    meanEnemies: mean(points.map((point) => point.activeEnemies)),
    peakEnemies: Math.max(...points.map((point) => point.activeEnemies)),
    meanEnemyProjectiles: mean(points.map((point) => point.enemyProjectiles)),
    peakEnemyProjectiles: Math.max(...points.map((point) => point.enemyProjectiles)),
    meanSurvivability: mean(points.map((point) => point.survivability)),
    minimumSurvivability: Math.min(...points.map((point) => point.survivability)),
    meanIntensity: mean(points.map((point) => point.intensity)),
    peakIntensity: Math.max(...points.map((point) => point.intensity)),
    p95FrameMs: percentile(
      points.map((point) => point.frameMs),
      0.95,
    ),
  };
}

export function compareTelemetry(
  a: TelemetrySummary,
  b: TelemetrySummary,
): Record<keyof TelemetrySummary, number> {
  return {
    duration: b.duration - a.duration,
    meanEnemies: b.meanEnemies - a.meanEnemies,
    peakEnemies: b.peakEnemies - a.peakEnemies,
    meanEnemyProjectiles: b.meanEnemyProjectiles - a.meanEnemyProjectiles,
    peakEnemyProjectiles: b.peakEnemyProjectiles - a.peakEnemyProjectiles,
    meanSurvivability: b.meanSurvivability - a.meanSurvivability,
    minimumSurvivability: b.minimumSurvivability - a.minimumSurvivability,
    meanIntensity: b.meanIntensity - a.meanIntensity,
    peakIntensity: b.peakIntensity - a.peakIntensity,
    p95FrameMs: b.p95FrameMs - a.p95FrameMs,
  };
}
