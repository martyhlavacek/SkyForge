export interface PositionRecord {
  levelTime: number;
  x: number;
  y: number;
}

export interface TelemetryMetadata {
  runId: string;
  levelId: string;
  difficulty: string;
  deviceProfile: string;
  build: string;
}

export interface Telemetry {
  metadata: TelemetryMetadata | null;
  deaths: PositionRecord[];
  damage: PositionRecord[];
  encounterTimes: Record<string, number>;
  weaponSeconds: Record<string, number>;
  fpsDrops: number;
  projectilePeak: number;
  avgMultiplier: number;
  frameTimeMs: { p50: number; p95: number; p99: number; samples: number };
}

const MAX_FRAME_SAMPLES = 3600;

class TelemetryRecorder {
  private data: Telemetry = this.blank();
  private multiplierWeightedSum = 0;
  private multiplierSeconds = 0;
  private lowFpsFor = 0;
  private frameTimes: number[] = [];

  private blank(): Telemetry {
    return {
      metadata: null,
      deaths: [],
      damage: [],
      encounterTimes: {},
      weaponSeconds: {},
      fpsDrops: 0,
      projectilePeak: 0,
      avgMultiplier: 1,
      frameTimeMs: { p50: 0, p95: 0, p99: 0, samples: 0 },
    };
  }

  reset(): void {
    this.data = this.blank();
    this.multiplierWeightedSum = 0;
    this.multiplierSeconds = 0;
    this.lowFpsFor = 0;
    this.frameTimes = [];
  }

  beginRun(metadata: Omit<TelemetryMetadata, 'build'> & { build?: string }): void {
    this.data.metadata = {
      ...metadata,
      build: metadata.build ?? import.meta.env.VITE_BUILD_ID ?? 'development',
    };
  }

  recordDeath(levelTime: number, x: number, y: number): void {
    this.data.deaths.push({ levelTime, x, y });
  }

  recordDamage(levelTime: number, x: number, y: number): void {
    this.data.damage.push({ levelTime, x, y });
  }

  recordEncounterComplete(id: string, levelTime: number): void {
    this.data.encounterTimes[id] = levelTime;
  }

  addWeaponTime(weaponId: string, dt: number): void {
    this.data.weaponSeconds[weaponId] =
      (this.data.weaponSeconds[weaponId] ?? 0) + Math.max(0, dt);
  }

  sampleMultiplier(tier: number, dt = 1): void {
    const weight = Math.max(0, dt);
    this.multiplierWeightedSum += tier * weight;
    this.multiplierSeconds += weight;
    this.data.avgMultiplier =
      this.multiplierSeconds > 0
        ? this.multiplierWeightedSum / this.multiplierSeconds
        : 1;
  }

  sampleProjectiles(active: number): void {
    if (active > this.data.projectilePeak) this.data.projectilePeak = active;
  }

  sampleFrame(frameMs: number): void {
    if (!Number.isFinite(frameMs) || frameMs <= 0) return;
    this.frameTimes.push(frameMs);
    if (this.frameTimes.length > MAX_FRAME_SAMPLES) this.frameTimes.shift();
  }

  sampleFps(fps: number, dt: number): void {
    if (fps < 50) {
      this.lowFpsFor += dt;
      while (this.lowFpsFor >= 1 - 1e-9) {
        this.data.fpsDrops++;
        this.lowFpsFor -= 1;
      }
    } else {
      this.lowFpsFor = 0;
    }
  }

  snapshot(): Telemetry {
    const result = structuredClone(this.data);
    result.frameTimeMs = {
      p50: this.percentile(0.5),
      p95: this.percentile(0.95),
      p99: this.percentile(0.99),
      samples: this.frameTimes.length,
    };
    return result;
  }

  exportJson(): string {
    return JSON.stringify(this.snapshot(), null, 2);
  }

  private percentile(q: number): number {
    if (this.frameTimes.length === 0) return 0;
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const index = Math.min(
      sorted.length - 1,
      Math.max(0, Math.ceil(q * sorted.length) - 1),
    );
    return sorted[index];
  }
}

export const telemetry = new TelemetryRecorder();
