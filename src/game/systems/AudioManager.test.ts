import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioManager } from './AudioManager';

class FakeGain {
  gain = { value: 1 };
  connect(): void {}
  disconnect(): void {}
}

class FakeBuffer {
  private readonly data: Float32Array;
  constructor(length: number) {
    this.data = new Float32Array(length);
  }
  getChannelData(): Float32Array {
    return this.data;
  }
}

class FakeAudioContext {
  state: AudioContextState = 'suspended';
  readonly sampleRate = 48000;
  readonly destination = {};

  createGain(): FakeGain {
    return new FakeGain();
  }

  createBuffer(_channels: number, length: number): FakeBuffer {
    return new FakeBuffer(length);
  }

  async resume(): Promise<void> {
    await Promise.resolve();
    this.state = 'running';
  }

  async suspend(): Promise<void> {
    this.state = 'suspended';
  }
}

function installBrowserFakes(): void {
  vi.stubGlobal('window', {
    AudioContext: FakeAudioContext,
  });
  vi.stubGlobal('document', {
    hidden: false,
    addEventListener: vi.fn(),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AudioManager browser gate', () => {
  it('does not create an AudioContext before unlock', () => {
    installBrowserFakes();
    const manager = new AudioManager();
    expect(manager.context).toBeNull();
    expect(manager.isUnlocked).toBe(false);
  });

  it('creates and resumes one context, notifying listeners once', async () => {
    installBrowserFakes();
    const manager = new AudioManager();
    const listener = vi.fn();
    manager.onUnlocked(listener);

    const [first, second] = await Promise.all([manager.unlock(), manager.unlock()]);

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(manager.isUnlocked).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('retains category settings before and after unlock', async () => {
    installBrowserFakes();
    const manager = new AudioManager();
    manager.setVolumes({ master: 0.4, music: 0.3, sfx: 0.2 });
    await manager.unlock();
    expect(manager.getVolumes()).toEqual({ master: 0.4, music: 0.3, sfx: 0.2 });
  });
});
