import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { createBuiltInStudioPackages } from './BuiltInPackages';
import {
  safeOutputPath,
  sanitizeResourceFilename,
  unpackPackage,
} from '../../scripts/studio-folder';

async function fixture(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'skyforge-folder-security-'));
}

describe('Studio folder security', () => {
  it.each([
    '../escape.json',
    '../../escape.json',
    '/absolute.json',
    'payload/../../../escape.json',
    'C:\\escape.json',
  ])('rejects an output path outside the selected root: %s', (path) => {
    expect(() => safeOutputPath('/tmp/skyforge-root', path)).toThrow(/Unsafe package path/);
  });

  it('normalizes harmless filenames and rejects dot-only names', () => {
    expect(sanitizeResourceFilename('fighter / alpha.png')).toBe('fighter-alpha.png');
    expect(() => sanitizeResourceFilename('../')).toThrow();
  });

  it('rejects a malicious authored ID before creating the target directory', async () => {
    const root = await fixture();
    const source = join(root, 'malicious.sflevelpack');
    const target = join(root, 'target');
    const escaped = join(root, 'escaped.json');
    const pkg = structuredClone(createBuiltInStudioPackages()[0]!);
    if (pkg.format !== 'skyforge-level-pack') throw new Error('unexpected package');
    pkg.payload.maps[0]!.id = '../../../escaped';
    await writeFile(source, JSON.stringify(pkg));

    await expect(unpackPackage(source, target)).rejects.toThrow();
    await expect(readFile(escaped, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readFile(join(target, 'skyforge.package.json'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });


  it('rejects traversal in an embedded resource filename before creating output', async () => {
    const root = await fixture();
    const source = join(root, 'malicious-resource.sfassetpack');
    const target = join(root, 'target');
    const pkg = structuredClone(
      createBuiltInStudioPackages().find((item) => item.format === 'skyforge-asset-pack'),
    );
    if (!pkg || pkg.format !== 'skyforge-asset-pack') throw new Error('asset package missing');
    pkg.resources.push({
      id: 'unsafe_resource',
      uri: 'unsafe.png',
      filename: '../../../escaped.png',
      mediaType: 'image/png',
      embeddedData: 'AA==',
      bytes: 1,
      sha256: '6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d',
    });
    await writeFile(source, JSON.stringify(pkg));

    await expect(unpackPackage(source, target)).rejects.toThrow(/unsafe/i);
    await expect(readFile(join(root, 'escaped.png'))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readFile(join(target, 'skyforge.package.json'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('rejects resource filenames that normalize to the same output path', async () => {
    const root = await fixture();
    const source = join(root, 'duplicate-resource.sfassetpack');
    const target = join(root, 'target');
    const pkg = structuredClone(
      createBuiltInStudioPackages().find((item) => item.format === 'skyforge-asset-pack'),
    );
    if (!pkg || pkg.format !== 'skyforge-asset-pack') throw new Error('asset package missing');
    pkg.resources.push(
      {
        id: 'resource_one',
        uri: 'one.png',
        filename: 'Fighter Alpha.png',
        mediaType: 'image/png',
        embeddedData: 'AA==',
        bytes: 1,
        sha256: '6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d',
      },
      {
        id: 'resource_two',
        uri: 'two.png',
        filename: 'fighter-alpha.png',
        mediaType: 'image/png',
        embeddedData: 'AA==',
        bytes: 1,
        sha256: '6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d',
      },
    );
    await writeFile(source, JSON.stringify(pkg));

    await expect(unpackPackage(source, target)).rejects.toThrow(/Duplicate normalized/);
  });

  it('does not delete a non-empty target without an explicit force option', async () => {
    const root = await fixture();
    const source = join(root, 'valid.sfassetpack');
    const target = join(root, 'target');
    const sentinel = join(target, 'keep.txt');
    const pkg = createBuiltInStudioPackages().find(
      (item) => item.format === 'skyforge-asset-pack',
    );
    if (!pkg) throw new Error('asset package missing');
    await writeFile(source, JSON.stringify(pkg));
    await mkdir(target);
    await writeFile(sentinel, 'keep');

    await expect(unpackPackage(source, target)).rejects.toThrow(/not empty/);
    await expect(readFile(sentinel, 'utf8')).resolves.toBe('keep');
  });

  it('allows replacement only when force is explicit and input is valid', async () => {
    const root = await fixture();
    const source = join(root, 'valid.sfassetpack');
    const target = join(root, 'target');
    const pkg = createBuiltInStudioPackages().find(
      (item) => item.format === 'skyforge-asset-pack',
    );
    if (!pkg) throw new Error('asset package missing');
    await writeFile(source, JSON.stringify(pkg));
    await mkdir(target);
    await writeFile(join(target, 'old.txt'), 'old');

    await unpackPackage(source, target, { force: true });
    await expect(readFile(join(target, 'skyforge.package.json'), 'utf8')).resolves.toContain(
      'skyforge-asset-pack',
    );
  });
});
