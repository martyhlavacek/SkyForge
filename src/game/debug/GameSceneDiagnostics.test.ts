import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('./GameSceneDiagnostics.ts', import.meta.url),
  'utf8',
);

describe('GameScene diagnostics lifecycle', () => {
  it('owns and removes every registered keyboard callback', () => {
    expect(source).toContain('handlers.push({ event, callback })');
    expect(source).toContain('keyboard?.off(event, callback)');
    expect(source).toContain('keyboard?.removeCapture(demo.key)');
  });
});
