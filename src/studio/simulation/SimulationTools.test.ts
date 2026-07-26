import { describe, expect, it } from 'vitest';
import { createBuiltInLevelPack, createBuiltInTuningPack } from '../BuiltInPackages';
import { SnapshotTransport } from './SnapshotTransport';
import {
  StudioSimulationRuntime,
  studioSnapshotId,
} from '../../game/systems/StudioSimulationRuntime';
import { analyzeAttention } from './AttentionAnalyzer';
import { buildTunableParameterCatalog, setTunableValue } from './TunableParameters';
import { diffTuningPackages, tuningReviewMarkdown } from './TuningDiff';
import { compareTelemetry, summarizeTelemetry } from './TelemetryComparison';
import {
  SimulationArenaConfigSchema,
  StudioRuntimeSnapshotSchema,
  StudioRuntimeStateSchema,
} from '../../schemas/studioSimulationSchema';

describe('Epoch 13 simulation tools', () => {
  it('captures snapshots on the configured interval', () => {
    const transport = new SnapshotTransport<{ value: number }>(5, 3);
    expect(transport.shouldCapture(0)).toBe(true);
    transport.capture(0, { value: 1 });
    expect(transport.shouldCapture(4.99)).toBe(false);
    expect(transport.shouldCapture(5)).toBe(true);
  });

  it('returns the nearest snapshot at or before a target', () => {
    const transport = new SnapshotTransport<{ value: number }>(5, 5);
    transport.capture(0, { value: 0 });
    transport.capture(5, { value: 5 });
    transport.capture(10, { value: 10 });
    expect(transport.nearestAtOrBefore(8)?.state.value).toBe(5);
    expect(transport.nearestAtOrBefore(-1)).toBeNull();
  });

  it('bounds the snapshot ring', () => {
    const transport = new SnapshotTransport<{ value: number }>(1, 2);
    transport.capture(0, { value: 0 });
    transport.capture(1, { value: 1 });
    transport.capture(2, { value: 2 });
    expect(transport.list().map((item) => item.state.value)).toEqual([1, 2]);
  });

  it('builds controls across all principal tuning categories', () => {
    const catalog = buildTunableParameterCatalog(createBuiltInTuningPack());
    const categories = new Set(catalog.map((item) => item.category));
    expect(categories).toEqual(
      new Set([
        'enemy',
        'difficulty',
        'projectile',
        'movement',
        'weapon',
        'boss',
        'encounter',
      ]),
    );
    expect(catalog.every((item) => item.maximum > item.minimum)).toBe(true);
  });

  it('sets one tuning value immutably by JSON path', () => {
    const source = createBuiltInTuningPack();
    const parameter = buildTunableParameterCatalog(source).find(
      (item) => item.category === 'enemy' && item.label === 'Health',
    );
    expect(parameter).toBeDefined();
    const next = setTunableValue(source, parameter!.path, parameter!.value + 10);
    expect(next).not.toBe(source);
    expect(
      buildTunableParameterCatalog(next).find((item) => item.id === parameter!.id)?.value,
    ).toBe(parameter!.value + 10);
    expect(
      buildTunableParameterCatalog(source).find((item) => item.id === parameter!.id)
        ?.value,
    ).toBe(parameter!.value);
  });

  it('produces scalar tuning diffs and a Markdown review', () => {
    const baseline = createBuiltInTuningPack();
    const parameter = buildTunableParameterCatalog(baseline)[0];
    const candidate = setTunableValue(baseline, parameter.path, parameter.value + 5);
    const diffs = diffTuningPackages(baseline, candidate);
    expect(diffs.some((item) => item.path === parameter.path)).toBe(true);
    expect(tuningReviewMarkdown(baseline, candidate, diffs)).toContain(parameter.path);
  });

  it('creates authored attention markers and intensity bins', () => {
    const analysis = analyzeAttention(
      createBuiltInLevelPack(),
      createBuiltInTuningPack(),
      'level_01',
    );
    expect(analysis.bins.length).toBeGreaterThan(100);
    expect(analysis.markers.some((marker) => marker.kind === 'encounter')).toBe(true);
    expect(analysis.markers.some((marker) => marker.kind === 'checkpoint')).toBe(true);
    expect(analysis.peakValue).toBeGreaterThan(0);
  });

  it('keeps attention intensity normalized', () => {
    const analysis = analyzeAttention(
      createBuiltInLevelPack(),
      createBuiltInTuningPack(),
      'level_01',
    );
    expect(analysis.bins.every((bin) => bin.value >= 0 && bin.value <= 1)).toBe(true);
    expect(
      analysis.markers.every((marker) => marker.intensity >= 0 && marker.intensity <= 1),
    ).toBe(true);
  });

  it('summarizes telemetry and calculates A/B deltas', () => {
    const a = summarizeTelemetry([
      {
        time: 0,
        activeEnemies: 1,
        enemyProjectiles: 2,
        playerProjectiles: 1,
        survivability: 1,
        multiplier: 1,
        frameMs: 15,
        intensity: 0.2,
      },
      {
        time: 1,
        activeEnemies: 3,
        enemyProjectiles: 6,
        playerProjectiles: 2,
        survivability: 0.8,
        multiplier: 2,
        frameMs: 20,
        intensity: 0.8,
      },
    ]);
    const b = summarizeTelemetry([
      {
        time: 0,
        activeEnemies: 2,
        enemyProjectiles: 4,
        playerProjectiles: 1,
        survivability: 1,
        multiplier: 1,
        frameMs: 16,
        intensity: 0.4,
      },
      {
        time: 1,
        activeEnemies: 4,
        enemyProjectiles: 8,
        playerProjectiles: 2,
        survivability: 0.7,
        multiplier: 2,
        frameMs: 24,
        intensity: 0.9,
      },
    ]);
    expect(a.meanEnemies).toBe(2);
    expect(compareTelemetry(a, b).meanEnemies).toBe(1);
    expect(compareTelemetry(a, b).minimumSurvivability).toBeCloseTo(-0.1);
  });

  it('returns safe empty telemetry statistics', () => {
    const summary = summarizeTelemetry([]);
    expect(summary.duration).toBe(0);
    expect(summary.meanSurvivability).toBe(1);
    expect(summary.minimumSurvivability).toBe(1);
  });

  it('validates each supported arena type', () => {
    for (const type of [
      'level',
      'enemy',
      'weapon',
      'formation',
      'encounter',
      'boss',
      'route',
      'loadout',
    ]) {
      expect(SimulationArenaConfigSchema.parse({ type }).type).toBe(type);
    }
  });

  it('rejects unsafe arena timing', () => {
    expect(() =>
      SimulationArenaConfigSchema.parse({ type: 'enemy', resetDelaySeconds: -1 }),
    ).toThrow();
  });

  it('rebuilds snapshot transport when the author changes the interval', () => {
    const runtime = new StudioSimulationRuntime(5);
    expect(runtime.snapshotInterval).toBe(5);
    expect(runtime.setSnapshotInterval(2, 12)).toBe(2);
    expect(runtime.snapshotInterval).toBe(2);
    expect(runtime.shouldCapture(11.9)).toBe(false);
    expect(runtime.shouldCapture(12)).toBe(true);
    expect(() => runtime.setSnapshotInterval(0)).toThrow();
  });

  it('creates schema-safe snapshot identifiers at fractional times', () => {
    const id = studioSnapshotId(3, 12.3456);
    expect(id).toBe('snapshot-3-12346');
    expect(() =>
      StudioRuntimeSnapshotSchema.shape.id.parse(id),
    ).not.toThrow();
  });

  it('supplies empty entity collections for legacy Studio snapshots', () => {
    const snapshot = StudioRuntimeSnapshotSchema.parse({
      id: 'snapshot-1',
      levelId: 'level_01',
      levelTime: 5,
      capturedAt: 1,
      player: { x: 270, y: 760, armor: 10, shield: 5, energy: 20 },
    });
    expect(snapshot.enemyStates).toEqual([]);
    expect(snapshot.projectileStates).toEqual([]);
    expect(snapshot.pickupStates).toEqual([]);
    expect(snapshot.groundTargetStates).toEqual([]);
  });

  it('validates Studio runtime state with snapshots and telemetry', () => {
    const state = StudioRuntimeStateSchema.parse({
      levelId: 'level_01',
      levelTime: 10,
      snapshots: [],
      telemetry: [],
      metrics: {
        activeEnemies: 2,
        enemyProjectiles: 4,
        playerProjectiles: 3,
        survivability: 0.75,
        multiplier: 2,
        intensity: 0.6,
      },
    });
    expect(state.metrics?.activeEnemies).toBe(2);
  });
});
