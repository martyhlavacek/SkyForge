import { describe, expect, it } from 'vitest';
import { ProjectHistory } from './ProjectHistory';

describe('ProjectHistory', () => {
  it('supports immutable undo and redo', () => {
    const history = new ProjectHistory({ value: 1 });
    history.commit({ value: 2 });
    expect(history.undo()).toEqual({ value: 1 });
    expect(history.redo()).toEqual({ value: 2 });
  });
});
