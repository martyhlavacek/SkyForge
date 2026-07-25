import { describe, expect, it } from 'vitest';
import { RunSession } from './RunSession';

describe('RunSession', () => {
  it('creates a legal fresh mission state', () => {
    const run = RunSession.create('level_01', {}, 'run-test');
    expect(run.snapshot()).toMatchObject({
      runId: 'run-test',
      levelId: 'level_01',
      score: 0,
      deaths: 0,
      maxMultiplier: 1,
      primaryWeapon: 'pulse_cannon',
      weaponLevel: 1,
    });
  });

  it('captures and rolls runtime rewards back to a checkpoint', () => {
    const run = RunSession.create('level_01', {}, 'run-test');
    run.updateRuntime({
      score: 1000,
      maxMultiplier: 2,
      primaryWeapon: 'spread_cannon',
      weaponLevel: 2,
    });
    run.captureCheckpoint(122, 'before_miniboss');
    run.updateRuntime({
      score: 4500,
      maxMultiplier: 4,
      primaryWeapon: 'pulse_cannon',
      weaponLevel: 3,
    });
    run.recordDeath();

    expect(run.checkpointRetrySnapshot(122)).toMatchObject({
      runId: 'run-test',
      score: 1000,
      deaths: 1,
      maxMultiplier: 4,
      primaryWeapon: 'spread_cannon',
      weaponLevel: 2,
    });
  });

  it('does not replace a checkpoint with the same or an earlier marker', () => {
    const run = RunSession.create('level_01', {}, 'run-test');
    run.captureCheckpoint(100, 'a');
    run.updateRuntime({
      score: 999,
      maxMultiplier: 3,
      primaryWeapon: 'spread_cannon',
      weaponLevel: 2,
    });
    run.captureCheckpoint(100, 'duplicate');
    run.captureCheckpoint(90, 'earlier');
    expect(run.checkpoint).toMatchObject({ at: 100, name: 'a', score: 0 });
  });


  it('rolls deterministic reward and RNG state back with the checkpoint', () => {
    const run = RunSession.create('level_01', { rewardSequence: 2, dropRngState: 100 }, 'run-test');
    run.updateRuntime({
      score: 500,
      maxMultiplier: 2,
      primaryWeapon: 'pulse_cannon',
      weaponLevel: 1,
      rewardSequence: 7,
      dropRngState: 700,
    });
    run.captureCheckpoint(50, 'economy');
    run.updateRuntime({
      score: 900,
      maxMultiplier: 3,
      primaryWeapon: 'spread_cannon',
      weaponLevel: 2,
      rewardSequence: 15,
      dropRngState: 1500,
    });
    expect(run.checkpointRetrySnapshot(50)).toMatchObject({
      rewardSequence: 7,
      dropRngState: 700,
    });
  });

  it('rejects a snapshot from a different level', () => {
    const original = RunSession.create('level_01', {}, 'old').snapshot();
    const restored = RunSession.restore(original, 'level_02', { weaponLevel: 2 });
    expect(restored.snapshot()).toMatchObject({
      levelId: 'level_02',
      score: 0,
      deaths: 0,
      weaponLevel: 2,
    });
    expect(restored.runId).not.toBe('old');
  });

  it('captures and restores dynamic terrain state at checkpoints', () => {
    const run = RunSession.create(
      'level_01',
      { terrainState: { canyon_gate_alpha: 'closed', canyon_barrier_beta: 'active' } },
      'run-terrain',
    );

    run.updateRuntime({
      score: 300,
      maxMultiplier: 2,
      primaryWeapon: 'pulse_cannon',
      weaponLevel: 1,
      terrainState: {
        canyon_gate_alpha: 'open',
        canyon_barrier_beta: 'active',
      },
    });
    run.captureCheckpoint(46, 'gate_open');

    run.updateRuntime({
      score: 900,
      maxMultiplier: 3,
      primaryWeapon: 'spread_cannon',
      weaponLevel: 2,
      terrainState: {
        canyon_gate_alpha: 'closed',
        canyon_barrier_beta: 'destroyed',
      },
    });

    const retry = run.checkpointRetrySnapshot(46);
    expect(retry.terrainState).toEqual({
      canyon_gate_alpha: 'open',
      canyon_barrier_beta: 'active',
    });
    expect(run.terrainState).toEqual({
      canyon_gate_alpha: 'closed',
      canyon_barrier_beta: 'destroyed',
    });
  });

  it('defensively clones terrain state snapshots', () => {
    const run = RunSession.create(
      'level_01',
      { terrainState: { gate: 'closed' } },
      'run-clone',
    );
    const exposed = run.terrainState;
    if (!exposed) throw new Error('expected terrain state');
    exposed.gate = 'open';
    expect(run.terrainState).toEqual({ gate: 'closed' });
  });

});
