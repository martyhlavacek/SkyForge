import type { LevelDef } from '../../schemas/levelSchema';
import type { ScrollController } from './ScrollController';

/**
 * WorldScroll (Sprint 4.5): converts levelTime into scrolled world distance
 * (px), honoring the level's segmented scrollProfile (roadmap Revision 1.1
 * / addendum §4) or flat baseScrollSpeed, times the live encounter
 * multiplier. Ground objects at `worldY` render at
 * `screenY = distance - worldY`: an object with worldY 1500 crosses the
 * screen top after 1500px of scroll and then travels downward with the
 * world.
 */
export class WorldScroll {
  distance = 0;

  constructor(
    private readonly level: Pick<LevelDef, 'baseScrollSpeed' | 'scrollProfile'>,
    private readonly scroll: ScrollController,
  ) {}

  /** Profile speed at a level time (multiplier NOT applied). */
  speedAt(levelTime: number): number {
    const profile = this.level.scrollProfile;
    if (!profile) return this.level.baseScrollSpeed;
    for (const seg of profile) {
      if (levelTime >= seg.startTime && levelTime < seg.endTime) return seg.speed;
    }
    return profile[profile.length - 1]?.speed ?? this.level.baseScrollSpeed;
  }

  update(dt: number, levelTime: number): void {
    this.distance += this.speedAt(levelTime) * this.scroll.scrollSpeedMultiplier * dt;
  }

  /**
   * Recompute distance analytically for a seek (Sprint 4.4/4.5).
   * Encounter multipliers are intentionally ignored (multiplier = 1): seek
   * is a dev/authoring tool and needs determinism, not simulation replay.
   */
  recompute(levelTime: number): void {
    const profile = this.level.scrollProfile;
    if (!profile) {
      this.distance = this.level.baseScrollSpeed * levelTime;
      return;
    }
    let d = 0;
    let covered = 0;
    for (const seg of profile) {
      const span = Math.min(levelTime, seg.endTime) - seg.startTime;
      if (span > 0) {
        d += span * seg.speed;
        covered = Math.max(covered, Math.min(levelTime, seg.endTime));
      }
    }
    if (levelTime > covered && profile.length > 0) {
      d += (levelTime - covered) * profile[profile.length - 1].speed;
    }
    this.distance = d;
  }

  reset(): void {
    this.distance = 0;
  }
}
