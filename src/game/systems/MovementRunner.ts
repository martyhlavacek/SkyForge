import { clamp, cubicBezier, deg2rad } from '../../shared/mathUtils';
import { GAME_WIDTH } from '../config/constants';
import type { MovementDef } from '../../schemas/movementSchema';

/**
 * Per-entity movement state. Positions are computed, not integrated from
 * velocity, so replays are deterministic (Sprints 3.4–3.5).
 * `phase`/`phaseT`/`aux` are per-type scratch. `fireRateMultiplier` lets
 * patterns like stop_and_fire speed up the enemy's weapon while parked.
 */
export interface MovementState {
  t: number;
  ox: number; // origin (spawn) position
  oy: number;
  x: number;
  y: number;
  phase: number;
  phaseT: number;
  aux: number;
  fireRateMultiplier: number;
}

export interface MovementContext {
  /** Player X at evaluation time — captured on first use by dive_retreat. */
  targetX: number;
}

export interface StepResult {
  x: number;
  y: number;
  done: boolean;
}

export function createMovementState(ox: number, oy: number): MovementState {
  return { t: 0, ox, oy, x: ox, y: oy, phase: 0, phaseT: 0, aux: NaN, fireRateMultiplier: 1 };
}

/**
 * Advance a movement state by dt seconds. Pure w.r.t. Phaser — fully
 * unit-testable. Mutates `state` (deterministic given identical inputs).
 */
export function step(
  state: MovementState,
  def: MovementDef,
  dt: number,
  ctx: MovementContext,
): StepResult {
  state.t += dt;
  state.phaseT += dt;
  state.fireRateMultiplier = 1;

  switch (def.type) {
    case 'straight': {
      const a = deg2rad(def.angleDeg);
      state.x = state.ox + Math.cos(a) * def.speed * state.t;
      state.y = state.oy + Math.sin(a) * def.speed * state.t;
      return { x: state.x, y: state.y, done: false };
    }

    case 'sine': {
      state.y = state.oy + def.verticalSpeed * state.t;
      state.x =
        state.ox +
        def.horizontalAmplitude * Math.sin(2 * Math.PI * def.frequency * state.t);
      const done = def.duration !== undefined && state.t >= def.duration;
      return { x: state.x, y: state.y, done };
    }

    case 'sweep': {
      const a = deg2rad(def.angleDeg);
      state.x = state.ox + Math.cos(a) * def.speed * state.t;
      state.y = state.oy + Math.sin(a) * def.speed * state.t;
      return { x: state.x, y: state.y, done: false };
    }

    case 'patrol': {
      if (state.phase === 0) {
        // Entry: descend to patrol altitude.
        state.y = state.oy + def.entrySpeed * state.t;
        state.x = state.ox;
        if (state.y >= def.y) {
          state.y = def.y;
          state.phase = 1;
          state.aux = state.ox <= (def.leftX + def.rightX) / 2 ? 1 : -1; // initial direction
        }
      } else {
        state.x += state.aux * def.horizontalSpeed * dt;
        if (state.x >= def.rightX) {
          state.x = def.rightX;
          state.aux = -1;
        } else if (state.x <= def.leftX) {
          state.x = def.leftX;
          state.aux = 1;
        }
        state.y = def.y;
      }
      return { x: state.x, y: state.y, done: false };
    }

    case 'bezier': {
      const t = clamp(state.t / def.duration, 0, 1);
      const [bx, by] = cubicBezier(t, def.points[0], def.points[1], def.points[2], def.points[3]);
      state.x = state.ox + bx;
      state.y = state.oy + by;
      return { x: state.x, y: state.y, done: t >= 1 };
    }

    case 'dive_retreat': {
      if (state.phase === 0) {
        // Capture the player's X once, at trigger time (PDR: dive toward
        // player's position when the dive starts, not homing).
        if (Number.isNaN(state.aux)) state.aux = ctx.targetX;
        const targetY = state.oy + def.diveTargetYOffset;
        const dx = state.aux - state.ox;
        const dy = targetY - state.oy;
        const len = Math.hypot(dx, dy) || 1;
        const dist = def.diveSpeed * state.phaseT;
        if (dist >= len) {
          state.x = state.aux;
          state.y = targetY;
          state.phase = 1;
          state.phaseT = 0;
        } else {
          state.x = state.ox + (dx / len) * dist;
          state.y = state.oy + (dy / len) * dist;
        }
      } else if (state.phase === 1) {
        if (state.phaseT >= def.pauseDuration) {
          state.phase = 2;
          state.phaseT = 0;
        }
      } else {
        state.y -= def.retreatSpeed * dt;
      }
      return { x: state.x, y: state.y, done: false };
    }

    case 'stop_and_fire': {
      if (state.phase === 0) {
        state.x = state.ox;
        state.y = state.oy + def.entrySpeed * state.t;
        if (state.y >= def.stopY) {
          state.y = def.stopY;
          state.phase = 1;
          state.phaseT = 0;
        }
      } else if (state.phase === 1) {
        state.fireRateMultiplier = def.holdFireRateMultiplier;
        if (state.phaseT >= def.holdDuration) {
          state.phase = 2;
          state.phaseT = 0;
        }
      } else {
        const a = deg2rad(def.exitAngleDeg);
        state.x += Math.cos(a) * def.exitSpeed * dt;
        state.y += Math.sin(a) * def.exitSpeed * dt;
      }
      return { x: state.x, y: state.y, done: false };
    }

    case 'enter_attack_exit': {
      if (state.phase === 0) {
        const dx = def.enter.targetX - state.ox;
        const dy = def.enter.targetY - state.oy;
        const len = Math.hypot(dx, dy) || 1;
        const dist = def.enter.speed * state.phaseT;
        if (dist >= len) {
          state.x = def.enter.targetX;
          state.y = def.enter.targetY;
          state.phase = 1;
          state.phaseT = 0;
        } else {
          state.x = state.ox + (dx / len) * dist;
          state.y = state.oy + (dy / len) * dist;
        }
      } else if (state.phase === 1) {
        if (state.phaseT >= def.holdDuration) {
          state.phase = 2;
          state.phaseT = 0;
        }
      } else {
        const a = deg2rad(def.exit.angleDeg);
        state.x += Math.cos(a) * def.exit.speed * dt;
        state.y += Math.sin(a) * def.exit.speed * dt;
      }
      return { x: state.x, y: state.y, done: false };
    }
  }
}

/** Spawn-side helper: sweep patterns start just off their entry side. */
export function sweepSpawnX(fromSide: 'left' | 'right'): number {
  return fromSide === 'left' ? -40 : GAME_WIDTH + 40;
}
