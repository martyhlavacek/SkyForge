import type {
  RuntimeTelemetrySeriesPoint,
  SimulationArenaConfig,
  StudioRuntimeSnapshot,
  StudioRuntimeSnapshotIndex,
} from '../../schemas/studioSimulationSchema';
import { SnapshotTransport } from '../../studio/simulation/SnapshotTransport';

const MAX_TELEMETRY_POINTS = 1200;

/** Runtime-only recorder for Studio transport, snapshots, and heatmap data. */
export class StudioSimulationRuntime {
  private transport: SnapshotTransport<StudioRuntimeSnapshot>;
  private snapshotIntervalSeconds: number;
  private telemetry: RuntimeTelemetrySeriesPoint[] = [];
  private telemetryClock = 0;
  private snapshotSequence = 0;
  arena: SimulationArenaConfig = {
    type: 'level',
    levelId: 'level_01',
    autoFire: false,
    repeat: true,
    resetDelaySeconds: 1.5,
  };

  constructor(snapshotIntervalSeconds = 5) {
    this.snapshotIntervalSeconds = snapshotIntervalSeconds;
    this.transport = new SnapshotTransport(snapshotIntervalSeconds, 180);
  }

  reset(levelId: string, arena?: SimulationArenaConfig): void {
    this.transport.reset(0);
    this.telemetry = [];
    this.telemetryClock = 0;
    this.snapshotSequence = 0;
    this.arena = arena ?? {
      type: 'level',
      levelId,
      autoFire: false,
      repeat: true,
      resetDelaySeconds: 1.5,
    };
  }

  setArena(arena: SimulationArenaConfig): void {
    this.arena = structuredClone(arena);
    this.transport.reset(0);
    this.telemetry = [];
    this.telemetryClock = 0;
    this.snapshotSequence = 0;
  }

  setSnapshotInterval(seconds: number, startAt = 0): number {
    if (!Number.isFinite(seconds) || seconds < 1 || seconds > 30)
      throw new Error('snapshot interval must be between 1 and 30 seconds');
    this.snapshotIntervalSeconds = seconds;
    this.transport = new SnapshotTransport(seconds, 180);
    this.transport.reset(Math.max(0, startAt));
    this.snapshotSequence = 0;
    return this.snapshotIntervalSeconds;
  }

  get snapshotInterval(): number {
    return this.snapshotIntervalSeconds;
  }

  shouldCapture(time: number): boolean {
    return this.transport.shouldCapture(time);
  }

  capture(
    levelId: string,
    levelTime: number,
    data: Omit<StudioRuntimeSnapshot, 'id' | 'levelId' | 'levelTime' | 'capturedAt'>,
  ): StudioRuntimeSnapshot {
    const snapshot: StudioRuntimeSnapshot = {
      ...data,
      id: `snapshot-${this.snapshotSequence++}-${levelTime.toFixed(3)}`,
      levelId,
      levelTime,
      capturedAt: Date.now(),
    };
    this.transport.capture(levelTime, snapshot);
    return structuredClone(snapshot);
  }

  nearestSnapshot(time: number): StudioRuntimeSnapshot | null {
    return this.transport.nearestAtOrBefore(time)?.state ?? null;
  }

  snapshots(): StudioRuntimeSnapshot[] {
    return this.transport.list().map((item) => item.state);
  }

  snapshotIndex(): StudioRuntimeSnapshotIndex[] {
    return this.transport.list().map(({ state }) => ({
      id: state.id,
      levelTime: state.levelTime,
      capturedAt: state.capturedAt,
      activeEnemies: state.activeEnemies,
      activeProjectiles: state.activeProjectiles,
    }));
  }

  sample(point: RuntimeTelemetrySeriesPoint, dt: number): void {
    this.telemetryClock += Math.max(0, dt);
    if (this.telemetryClock < 0.2) return;
    this.telemetryClock %= 0.2;
    this.telemetry.push(structuredClone(point));
    while (this.telemetry.length > MAX_TELEMETRY_POINTS) this.telemetry.shift();
  }

  telemetrySeries(): RuntimeTelemetrySeriesPoint[] {
    return structuredClone(this.telemetry);
  }
}
