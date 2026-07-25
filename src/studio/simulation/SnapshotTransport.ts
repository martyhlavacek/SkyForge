export interface TimedSnapshot<T> {
  time: number;
  state: T;
}

/**
 * Small deterministic snapshot ring used by the Studio runtime bridge.
 * It owns interval selection and nearest-anchor lookup; capture/restore of
 * game-specific state remains outside the generic class.
 */
export class SnapshotTransport<T> {
  private snapshots: TimedSnapshot<T>[] = [];
  private nextCaptureAt = 0;

  constructor(
    readonly intervalSeconds = 5,
    readonly maxSnapshots = 180,
  ) {
    if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0)
      throw new Error('snapshot interval must be positive');
    if (!Number.isInteger(maxSnapshots) || maxSnapshots < 1)
      throw new Error('maxSnapshots must be a positive integer');
  }

  reset(startAt = 0): void {
    this.snapshots = [];
    this.nextCaptureAt = Math.max(0, startAt);
  }

  shouldCapture(time: number): boolean {
    return Number.isFinite(time) && time + 1e-9 >= this.nextCaptureAt;
  }

  capture(time: number, state: T): TimedSnapshot<T> {
    const safeTime = Math.max(0, time);
    const snapshot = { time: safeTime, state: structuredClone(state) };
    const existing = this.snapshots.findIndex(
      (item) => Math.abs(item.time - safeTime) < 1e-6,
    );
    if (existing >= 0) this.snapshots[existing] = snapshot;
    else this.snapshots.push(snapshot);
    this.snapshots.sort((a, b) => a.time - b.time);
    while (this.snapshots.length > this.maxSnapshots) this.snapshots.shift();
    this.nextCaptureAt = safeTime + this.intervalSeconds;
    return structuredClone(snapshot);
  }

  nearestAtOrBefore(time: number): TimedSnapshot<T> | null {
    let best: TimedSnapshot<T> | null = null;
    for (const snapshot of this.snapshots) {
      if (snapshot.time <= time + 1e-9) best = snapshot;
      else break;
    }
    return best ? structuredClone(best) : null;
  }

  list(): TimedSnapshot<T>[] {
    return structuredClone(this.snapshots);
  }
}
