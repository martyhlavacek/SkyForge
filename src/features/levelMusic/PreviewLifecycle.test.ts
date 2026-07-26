import { describe, expect, it, vi } from 'vitest';
import { disposeMusicPreview } from './PreviewLifecycle';

function preview(url: string): HTMLAudioElement {
  return {
    src: url,
    pause: vi.fn(),
    removeAttribute: vi.fn(),
    load: vi.fn(),
  } as unknown as HTMLAudioElement;
}

describe('level-music preview lifecycle', () => {
  it('releases a rejected older preview without stopping its replacement', () => {
    const older = preview('blob:older');
    const replacement = preview('blob:replacement');
    const revoke = vi.fn();

    const current = disposeMusicPreview(replacement, older, revoke);

    expect(current).toBe(replacement);
    expect(older.pause).toHaveBeenCalledOnce();
    expect(replacement.pause).not.toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith('blob:older');
  });

  it('clears the identity when disposing the active preview', () => {
    const active = preview('blob:active');
    expect(disposeMusicPreview(active, active, vi.fn())).toBeNull();
  });
});
