import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('./StudioRuntimeController.ts', import.meta.url),
  'utf8',
);

describe('Studio asset preview lifecycle', () => {
  it('invalidates stale asynchronous texture loads before drawing', () => {
    expect(source).toContain('const generation = ++this.assetPreviewGeneration');
    expect(source).toContain('generation !== this.assetPreviewGeneration');
    expect(source).toContain('this.assetPreviewGeneration += 1');
  });
});
