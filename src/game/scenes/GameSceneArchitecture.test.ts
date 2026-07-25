import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./GameScene.ts', import.meta.url), 'utf8');
const lineCount = source.split(/\r?\n/).length;

describe('GameScene architecture budget', () => {
  it('keeps the scene as a bounded composition root', () => {
    expect(lineCount).toBeLessThanOrEqual(675);
    for (const forbidden of [
      'StudioSimulationRuntime',
      'MissionEconomy',
      'PoolManager',
      'WeaponSystem',
      'new Boss(',
    ])
      expect(source).not.toContain(forbidden);
  });

  it('delegates the major runtime responsibilities to focused controllers', () => {
    for (const boundary of [
      'CombatDirector',
      'BossController',
      'GamePresentation',
      'MissionFlowController',
      'RunProgressionController',
      'StudioRuntimeController',
    ])
      expect(source).toContain(boundary);
  });
});
