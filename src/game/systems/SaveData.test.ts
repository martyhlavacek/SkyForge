import { beforeEach, describe, expect, it, vi } from 'vitest';

// jsdom-free localStorage stub.
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
  clear: () => store.clear(),
});

import { saveData } from './SaveData';

beforeEach(() => store.clear());

describe('SaveData (Sprint 9.3)', () => {
  it('returns defaults with no stored blob', () => {
    const blob = saveData.load();
    expect(blob.version).toBe(2);
    expect(blob.settings.masterVolume).toBeCloseTo(0.8);
    expect(blob.highScore).toBe(0);
    expect(blob.profile.loadouts).toHaveLength(1);
    expect(blob.profile.activeLoadoutId).toBe('loadout_starter');
  });

  it('persists settings across load', () => {
    saveData.load();
    saveData.updateSettings({ musicVolume: 0.2, reducedParticles: true });
    const reloaded = saveData.load();
    expect(reloaded.settings.musicVolume).toBeCloseTo(0.2);
    expect(reloaded.settings.reducedParticles).toBe(true);
  });

  it('records only improved run stats', () => {
    saveData.load();
    saveData.recordRun(5000, 200, 3);
    saveData.recordRun(3000, 240, 2); // worse score/time/mult
    const blob = saveData.get();
    expect(blob.highScore).toBe(5000);
    expect(blob.bestTimeSeconds).toBe(200);
    expect(blob.highestMultiplier).toBe(3);
  });

  it('resets cleanly on corrupt JSON', () => {
    store.set('skyforge_save_v1', '{ not valid json');
    const blob = saveData.load();
    expect(blob.version).toBe(2);
    expect(blob.highScore).toBe(0);
  });

  it('rejects wrong-typed and out-of-range stored settings', () => {
    store.set(
      'skyforge_save_v1',
      JSON.stringify({
        settings: {
          masterVolume: 900,
          musicVolume: 0.25,
          reducedParticles: 'sometimes',
          difficulty: 'impossible',
        },
      }),
    );
    const blob = saveData.load();
    expect(blob.settings.masterVolume).toBeCloseTo(0.8);
    expect(blob.settings.musicVolume).toBeCloseTo(0.25);
    expect(blob.settings.reducedParticles).toBe(false);
    expect(blob.settings.difficulty).toBe('normal');
  });

  it('reports whether a run set new records', () => {
    saveData.load();
    const first = saveData.recordRun(100, 20, 2);
    const tied = saveData.recordRun(100, 25, 2);
    expect(first.newHighScore).toBe(true);
    expect(tied.newHighScore).toBe(false);
  });

  it('migrates a partial blob, filling missing fields', () => {
    store.set('skyforge_save_v1', JSON.stringify({ highScore: 999 }));
    const blob = saveData.load();
    expect(blob.highScore).toBe(999);
    expect(blob.settings.sfxVolume).toBeCloseTo(0.8); // filled from defaults
  });
});
