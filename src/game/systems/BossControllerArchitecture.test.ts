import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./BossController.ts', import.meta.url), 'utf8');

describe('BossController lifecycle policy', () => {
  it('retains both projectile overlap handles for deterministic cleanup', () => {
    expect(source).toContain('this.createProjectileOverlap(this.playerBullets)');
    expect(source).toContain('this.createProjectileOverlap(this.missiles)');
    expect(source).toContain('collider.destroy()');
  });

  it('destroys the previous boss before replacement and after defeat', () => {
    expect(source).toMatch(/start\([\s\S]*?this\.destroy\(\)/);
    expect(source).toMatch(/completeDefeat\(\): void \{\s*this\.destroy\(\)/);
  });
});
