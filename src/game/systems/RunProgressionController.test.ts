import { describe, expect, it } from 'vitest';
import { createStarterProfile } from '../profile/StarterProfile';
import { RunProgressionController } from './RunProgressionController';

describe('RunProgressionController', () => {
  it('restores a fresh mission attempt from the active campaign loadout', () => {
    const controller = RunProgressionController.restore(
      createStarterProfile(),
      'level_01',
    );
    expect(controller.runId).toBeTruthy();
    expect(controller.primaryWeapon).toBe('pulse_cannon');
    expect(controller.score).toBe(0);
    expect(controller.totalEscrow).toBe(0);
  });

  it('produces unique deterministic reward identifiers and persists the sequence', () => {
    const controller = RunProgressionController.restore(
      createStarterProfile(),
      'level_01',
    );
    const first = controller.nextRewardId('enemy_alpha');
    const second = controller.nextRewardId('enemy_alpha');
    expect(first).not.toBe(second);
    expect(first).toContain(controller.runId);
    controller.syncRuntime({ score: 0, weaponLevel: 1 });
    expect(controller.snapshot().rewardSequence).toBe(2);
  });

  it('captures only forward checkpoints with the current runtime state', () => {
    const controller = RunProgressionController.restore(
      createStarterProfile(),
      'level_01',
    );
    expect(
      controller.captureCheckpoint(30, 'Gate', {
        score: 1200,
        weaponLevel: 2,
      }),
    ).toBe(true);
    expect(
      controller.captureCheckpoint(20, 'Earlier', {
        score: 50,
        weaponLevel: 1,
      }),
    ).toBe(false);
    expect(controller.checkpoint?.at).toBe(30);
    expect(controller.snapshot().score).toBe(1200);
    expect(controller.snapshot().weaponLevel).toBe(2);
  });

  it('tracks the highest multiplier without regressing it', () => {
    const controller = RunProgressionController.restore(
      createStarterProfile(),
      'level_01',
    );
    expect(controller.trackMultiplier(4)).toBe(true);
    expect(controller.trackMultiplier(2)).toBe(false);
    expect(controller.highestMultiplier).toBe(4);
  });
});
