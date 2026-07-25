import type {
  LevelStudioPackage,
  TuningStudioPackage,
} from '../../schemas/studioPackageSchema';
import type { AttentionMarker } from './SimulationTypes';

export interface IntensityBin {
  time: number;
  value: number;
  reasons: string[];
}

export interface AttentionAnalysis {
  markers: AttentionMarker[];
  bins: IntensityBin[];
  peakValue: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Static authored-content estimate. Runtime telemetry remains the source of
 * truth after play, but this gives designers immediate attention markers
 * before launching the simulation.
 */
export function analyzeAttention(
  levelPack: LevelStudioPackage,
  tuningPack: TuningStudioPackage,
  levelId: string,
  binSeconds = 1,
): AttentionAnalysis {
  const level =
    levelPack.payload.levels.find((item) => item.id === levelId) ??
    levelPack.payload.levels[0];
  if (!level) return { markers: [], bins: [], peakValue: 0 };
  const duration = Math.max(1, Math.ceil(level.durationTarget));
  const bins: IntensityBin[] = Array.from(
    { length: Math.ceil(duration / binSeconds) + 1 },
    (_, index) => ({ time: index * binSeconds, value: 0, reasons: [] }),
  );
  const markers: AttentionMarker[] = [];
  const encounters = new Map(
    tuningPack.payload.encounters.map((item) => [item.id, item]),
  );
  const formations = new Map(
    tuningPack.payload.formations.map((item) => [item.id, item]),
  );
  const bosses = new Map(tuningPack.payload.bosses.map((item) => [item.id, item]));

  const addWindow = (start: number, end: number, value: number, reason: string) => {
    bins.forEach((bin) => {
      if (bin.time + 1e-9 < start || bin.time >= end) return;
      bin.value += value;
      if (!bin.reasons.includes(reason)) bin.reasons.push(reason);
    });
  };

  level.events.forEach((event, index) => {
    if ('encounter' in event) {
      const encounter = encounters.get(event.encounter);
      const durationValue = encounter?.estimatedDuration ?? 8;
      let density = encounter ? encounter.difficulty / 5 : 0.3;
      if (encounter) {
        let actorCount = 0;
        encounter.events.forEach((item) => {
          if (item.type === 'spawnEnemy') actorCount += 1;
          if (item.type === 'spawnFormation')
            actorCount += formations.get(item.formation)?.members.length ?? 1;
          if (item.type === 'spawnHazard') actorCount += item.count;
          if (item.type === 'startBoss' || item.type === 'startMiniboss') density += 0.35;
        });
        density += Math.min(0.3, actorCount * 0.025);
      }
      addWindow(event.at, event.at + durationValue, density, event.encounter);
      markers.push({
        id: `encounter-${index}-${event.encounter}`,
        at: event.at,
        duration: durationValue,
        kind: 'encounter',
        label: event.encounter,
        intensity: clamp01(density),
        sourceId: event.encounter,
        automatic: true,
      });
      return;
    }
    switch (event.type) {
      case 'recovery':
        markers.push({
          id: `recovery-${index}`,
          at: event.at,
          duration: event.duration,
          kind: 'recovery',
          label: 'Recovery window',
          intensity: 0.08,
          automatic: true,
        });
        addWindow(event.at, event.at + event.duration, -0.4, 'recovery');
        break;
      case 'checkpoint':
        markers.push({
          id: `checkpoint-${index}`,
          at: event.at,
          duration: 0,
          kind: 'checkpoint',
          label: event.name,
          intensity: 0,
          automatic: true,
        });
        break;
      case 'terrainState':
        markers.push({
          id: `terrain-${index}`,
          at: event.at,
          duration: 0,
          kind: 'terrain',
          label: `${event.target}: ${event.state}`,
          intensity: event.state === 'closed' ? 0.45 : 0.15,
          sourceId: event.target,
          automatic: true,
        });
        addWindow(
          event.at,
          Math.min(duration, event.at + 4),
          event.state === 'closed' ? 0.3 : 0.08,
          event.target,
        );
        break;
    }
  });

  tuningPack.payload.encounters.forEach((encounter) => {
    encounter.events.forEach((event) => {
      if (event.type !== 'startBoss' && event.type !== 'startMiniboss') return;
      const levelEvent = level.events.find(
        (candidate) => 'encounter' in candidate && candidate.encounter === encounter.id,
      );
      if (!levelEvent || !('encounter' in levelEvent)) return;
      const boss = bosses.get(event.boss);
      const at = levelEvent.at + event.at;
      markers.push({
        id: `boss-${encounter.id}-${event.boss}`,
        at,
        duration: boss?.enrage?.afterSeconds ?? 25,
        kind: 'boss',
        label: boss?.displayName ?? event.boss,
        intensity: 1,
        sourceId: event.boss,
        automatic: true,
      });
      addWindow(
        at,
        Math.min(duration, at + (boss?.enrage?.afterSeconds ?? 25)),
        0.7,
        event.boss,
      );
    });
  });

  bins.forEach((bin) => {
    bin.value = clamp01(bin.value);
  });

  for (let index = 1; index < bins.length - 1; index++) {
    const current = bins[index];
    if (
      current.value >= 0.72 &&
      current.value >= bins[index - 1].value &&
      current.value >= bins[index + 1].value
    ) {
      const nearExisting = markers.some(
        (marker) => marker.kind === 'peak' && Math.abs(marker.at - current.time) < 6,
      );
      if (!nearExisting) {
        markers.push({
          id: `peak-${current.time}`,
          at: current.time,
          duration: 0,
          kind: 'peak',
          label: `Attention peak ${Math.round(current.value * 100)}%`,
          intensity: current.value,
          automatic: true,
        });
      }
    }
  }

  markers.sort((a, b) => a.at - b.at || a.kind.localeCompare(b.kind));
  return {
    markers,
    bins,
    peakValue: bins.reduce((peak, bin) => Math.max(peak, bin.value), 0),
  };
}
