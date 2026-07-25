import { describe, expect, it, vi } from 'vitest';
import type { LevelDef } from '../../schemas/levelSchema';
import type { EncounterRunner } from './EncounterRunner';
import type { ScrollController } from './ScrollController';
import type { WorldScroll } from './WorldScroll';
import { LevelTimeline } from './LevelTimeline';

function makeLevel(events: LevelDef['events']): LevelDef {
  return {
    formatVersion: '1.0',
    id: 'timeline_test',
    displayName: 'Timeline Test',
    music: 'none',
    durationTarget: 120,
    baseScrollSpeed: 100,
    events,
    groundObjects: [],
  };
}

function makeHarness(events: LevelDef['events']) {
  const runner = {
    start: vi.fn(),
    clearAll: vi.fn(),
  } as unknown as EncounterRunner;
  const scroll = { scrollSpeedMultiplier: 1 } as ScrollController;
  const world = {
    update: vi.fn(),
    recompute: vi.fn(),
  } as unknown as WorldScroll;
  const hardClear = vi.fn();
  const terrainHooks = {
    setState: vi.fn(),
    reset: vi.fn(),
  };
  const timeline = new LevelTimeline(
    'timeline_test',
    runner,
    scroll,
    world,
    hardClear,
    makeLevel(events),
    terrainHooks,
  );
  return { timeline, runner, scroll, world, hardClear, terrainHooks };
}

describe('LevelTimeline terrain state integration', () => {
  it('fires terrain state events once when the timeline crosses their time', () => {
    const { timeline, terrainHooks, world } = makeHarness([
      { at: 2, type: 'terrainState', target: 'gate_alpha', state: 'open' },
      { at: 5, type: 'terrainState', target: 'gate_alpha', state: 'closed' },
    ]);

    timeline.update(1.9);
    expect(terrainHooks.setState).not.toHaveBeenCalled();

    timeline.update(0.2);
    expect(terrainHooks.setState).toHaveBeenCalledTimes(1);
    expect(terrainHooks.setState).toHaveBeenLastCalledWith('gate_alpha', 'open');

    timeline.update(3);
    expect(terrainHooks.setState).toHaveBeenCalledTimes(2);
    expect(terrainHooks.setState).toHaveBeenLastCalledWith('gate_alpha', 'closed');

    timeline.update(1);
    expect(terrainHooks.setState).toHaveBeenCalledTimes(2);
    expect(world.update).toHaveBeenCalledTimes(4);
  });

  it('advances the Studio clock without firing authored events', () => {
    const { timeline, runner, terrainHooks, world } = makeHarness([
      { at: 1, encounter: 'encounter_test' },
      { at: 1.5, type: 'terrainState', target: 'gate_alpha', state: 'open' },
    ]);

    timeline.advanceClockOnly(2);

    expect(timeline.levelTime).toBe(2);
    expect(runner.start).not.toHaveBeenCalled();
    expect(terrainHooks.setState).not.toHaveBeenCalled();
    expect(world.update).toHaveBeenCalledWith(2, 2);
  });

  it('reconstructs the latest terrain state deterministically when seeking', () => {
    const { timeline, terrainHooks, runner, hardClear, world } = makeHarness([
      { at: 2, type: 'terrainState', target: 'gate_alpha', state: 'open' },
      { at: 5, type: 'terrainState', target: 'barrier_beta', state: 'destroyed' },
      { at: 7, type: 'terrainState', target: 'gate_alpha', state: 'closed' },
    ]);

    timeline.seekTo(6);

    expect(hardClear).toHaveBeenCalledOnce();
    expect(runner.clearAll).toHaveBeenCalledWith(false);
    expect(terrainHooks.reset).toHaveBeenCalledOnce();
    expect(terrainHooks.setState.mock.calls).toEqual([
      ['gate_alpha', 'open'],
      ['barrier_beta', 'destroyed'],
    ]);
    expect(world.recompute).toHaveBeenCalledWith(6);
  });

  it('resets terrain before reconstructing an earlier seek position', () => {
    const { timeline, terrainHooks } = makeHarness([
      { at: 2, type: 'terrainState', target: 'gate_alpha', state: 'open' },
      { at: 7, type: 'terrainState', target: 'gate_alpha', state: 'closed' },
    ]);

    timeline.seekTo(8);
    timeline.seekTo(3);

    expect(terrainHooks.reset).toHaveBeenCalledTimes(2);
    expect(terrainHooks.setState.mock.calls).toEqual([
      ['gate_alpha', 'open'],
      ['gate_alpha', 'closed'],
      ['gate_alpha', 'open'],
    ]);
  });
});
