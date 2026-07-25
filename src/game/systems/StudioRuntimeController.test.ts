import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('./StudioRuntimeController.ts', import.meta.url),
  'utf8',
);

describe('StudioRuntimeController boundaries', () => {
  it('owns arena initialization and safe fallback behavior', () => {
    expect(source).toContain('SimulationArenaConfigSchema.safeParse');
    expect(source).toContain('this.useLevelArena(levelId)');
    expect(source).toContain("requestedArena === 'weapon'");
  });

  it('owns snapshot, preview, and simulation lifecycle outside GameScene', () => {
    for (const behavior of [
      'captureSnapshot()',
      'restoreSnapshot(snapshot',
      'renderAssetPreview()',
      'updateArena(dt',
      'sample(dt',
    ])
      expect(source).toContain(behavior);
  });
});
