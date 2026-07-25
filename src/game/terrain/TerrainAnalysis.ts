import type { RouteSetDef, TerrainCollisionDef } from '../../schemas/terrainSchema';
import { corridorBoundsAt } from './TerrainCollisionModel';

export interface RouteIssue {
  routeId: string;
  worldY: number;
  severity: 'error' | 'warning';
  message: string;
}

export interface RouteAnalysis {
  minimumWidth: number;
  minimumClearance: number;
  minimumReactionTime: number;
  issues: RouteIssue[];
}

export interface RouteKinematics {
  scrollSpeed?: number;
  maxLateralSpeed?: number;
  minimumReactionSeconds?: number;
}

/** Pure authoring analysis shared by the runtime tests and Level Composer. */
export function analyzeRoutes(
  collision: TerrainCollisionDef,
  routes: RouteSetDef,
  shipRadius: number,
  reactionMargin = 18,
  kinematics: RouteKinematics = {},
): RouteAnalysis {
  let minimumWidth = Number.POSITIVE_INFINITY;
  let minimumClearance = Number.POSITIVE_INFINITY;
  let minimumReactionTime = Number.POSITIVE_INFINITY;
  const issues: RouteIssue[] = [];

  for (const route of routes.routes) {
    for (const sample of route.samples) {
      const bounds = corridorBoundsAt(collision.corridor.samples, sample.worldY);
      const width = bounds.right - bounds.left;
      const leftClearance = sample.centerX - bounds.left;
      const rightClearance = bounds.right - sample.centerX;
      const actualClearance = Math.min(leftClearance, rightClearance, sample.clearance);
      minimumWidth = Math.min(minimumWidth, width);
      minimumClearance = Math.min(minimumClearance, actualClearance);
      const required = Math.max(route.minimumRadius, shipRadius);
      if (actualClearance < required) {
        issues.push({
          routeId: route.id,
          worldY: sample.worldY,
          severity: 'error',
          message: `route clearance ${actualClearance.toFixed(1)}px is below required ${required.toFixed(1)}px`,
        });
      } else if (actualClearance < required + reactionMargin) {
        issues.push({
          routeId: route.id,
          worldY: sample.worldY,
          severity: 'warning',
          message: `route has only ${(actualClearance - required).toFixed(1)}px reaction margin`,
        });
      }
    }

    const scrollSpeed = Math.max(1, kinematics.scrollSpeed ?? 120);
    const lateralSpeed = Math.max(1, kinematics.maxLateralSpeed ?? 320);
    const minimumReaction = Math.max(0, kinematics.minimumReactionSeconds ?? 0.55);
    for (let index = 1; index < route.samples.length; index++) {
      const previous = route.samples[index - 1];
      const current = route.samples[index];
      const available = Math.abs(current.worldY - previous.worldY) / scrollSpeed;
      const travel = Math.abs(current.centerX - previous.centerX) / lateralSpeed;
      const reaction = available - travel;
      minimumReactionTime = Math.min(minimumReactionTime, reaction);
      if (reaction < 0) {
        issues.push({
          routeId: route.id,
          worldY: current.worldY,
          severity: 'error',
          message: `route shift requires ${travel.toFixed(2)}s but only ${available.toFixed(2)}s is available`,
        });
      } else if (reaction < minimumReaction) {
        issues.push({
          routeId: route.id,
          worldY: current.worldY,
          severity: 'warning',
          message: `route provides only ${reaction.toFixed(2)}s reaction time`,
        });
      }
    }
  }

  return {
    minimumWidth: Number.isFinite(minimumWidth) ? minimumWidth : 0,
    minimumClearance: Number.isFinite(minimumClearance) ? minimumClearance : 0,
    minimumReactionTime: Number.isFinite(minimumReactionTime)
      ? minimumReactionTime
      : 0,
    issues,
  };
}

export interface TerrainCombatIssue {
  at: number;
  encounterId: string;
  difficulty: number;
  corridorWidth: number;
  severity: 'error' | 'warning';
  message: string;
}

export function distanceAtTime(
  level: {
    baseScrollSpeed: number;
    scrollProfile?: { startTime: number; endTime: number; speed: number }[];
  },
  time: number,
): number {
  if (!level.scrollProfile?.length) return Math.max(0, time) * level.baseScrollSpeed;
  let distance = 0;
  let covered = 0;
  for (const segment of level.scrollProfile) {
    const span = Math.max(0, Math.min(time, segment.endTime) - segment.startTime);
    distance += span * segment.speed;
    covered = Math.max(covered, Math.min(time, segment.endTime));
    if (time <= segment.endTime) break;
  }
  if (time > covered) {
    distance +=
      (time - covered) * level.scrollProfile[level.scrollProfile.length - 1].speed;
  }
  return distance;
}

export function analyzeTerrainCombatPressure(
  level: {
    baseScrollSpeed: number;
    scrollProfile?: { startTime: number; endTime: number; speed: number }[];
    events: { at: number; encounter?: string }[];
  },
  collision: TerrainCollisionDef,
  encounterDifficulty: (id: string) => number | undefined,
  playerScreenY = 840,
): TerrainCombatIssue[] {
  const issues: TerrainCombatIssue[] = [];
  for (const event of level.events) {
    if (!event.encounter) continue;
    const difficulty = encounterDifficulty(event.encounter) ?? 1;
    if (difficulty < 4) continue;
    const worldY = distanceAtTime(level, event.at) - playerScreenY;
    const bounds = corridorBoundsAt(collision.corridor.samples, worldY);
    const width = bounds.right - bounds.left;
    if (difficulty >= 5 && width <= 280) {
      issues.push({
        at: event.at,
        encounterId: event.encounter,
        difficulty,
        corridorWidth: width,
        severity: 'error',
        message: `difficulty ${difficulty} encounter overlaps a ${width.toFixed(0)}px corridor`,
      });
    } else if (width < 320) {
      issues.push({
        at: event.at,
        encounterId: event.encounter,
        difficulty,
        corridorWidth: width,
        severity: 'warning',
        message: `high-pressure encounter overlaps a ${width.toFixed(0)}px corridor`,
      });
    }
  }
  return issues;
}
