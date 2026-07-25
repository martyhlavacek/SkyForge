import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createBuiltInStudioPackages, createBuiltInWorkspace } from './BuiltInPackages';
import { createDependencyLock, validateDependencyLock } from './DependencyLock';
import {
  studioPackageFromFolderFiles,
  studioPackageToFolderFiles,
} from './FolderProject';
import { migrateStudioPackage, migrateStudioWorkspace } from './PackageMigrations';
import {
  createReviewComment,
  diffStudioPackages,
  packageReviewMarkdown,
  withReviewComment,
} from './PackageReview';
import { compileProductionWorkspace } from './ProductionCompiler';

function legacyPackage(): unknown {
  const pkg = structuredClone(createBuiltInStudioPackages()[0]!);
  const record = pkg as unknown as Record<string, unknown>;
  record.schemaVersion = 1;
  delete record.reviewComments;
  const manifest = record.manifest as Record<string, unknown>;
  delete manifest.contentRevision;
  return record;
}

describe('Epoch 16 collaboration and production compiler', () => {
  it('migrates schema-v1 packages and workspaces to schema v2', () => {
    const migrated = migrateStudioPackage(legacyPackage());
    expect(migrated.migrated).toBe(true);
    expect(migrated.value.schemaVersion).toBe(2);
    expect(migrated.value.manifest.contentRevision).toBe(1);
    expect(migrated.value.reviewComments).toEqual([]);

    const workspace = structuredClone(createBuiltInWorkspace()) as unknown as Record<
      string,
      unknown
    >;
    workspace.schemaVersion = 1;
    delete workspace.reviewComments;
    const migratedWorkspace = migrateStudioWorkspace(workspace);
    expect(migratedWorkspace.value.schemaVersion).toBe(2);
    expect(migratedWorkspace.value.reviewComments).toEqual([]);
  });

  it('creates a deterministic lock and detects package drift', () => {
    const packages = createBuiltInStudioPackages();
    const workspace = createBuiltInWorkspace();
    const lock = createDependencyLock(workspace, packages, '2026-07-12T20:00:00.000Z');
    const second = createDependencyLock(workspace, packages, '2026-07-12T20:00:00.000Z');
    expect(lock).toEqual(second);
    expect(validateDependencyLock(lock, workspace, packages)).toEqual([]);

    const changed = structuredClone(packages);
    changed[0]!.manifest.contentRevision += 1;
    expect(
      validateDependencyLock(lock, workspace, changed).some(
        (issue) => issue.severity === 'error' && issue.message.includes('revision'),
      ),
    ).toBe(true);
  });

  it('round-trips every package through the unpacked Git folder representation', () => {
    createBuiltInStudioPackages().forEach((pkg) => {
      const files = studioPackageToFolderFiles(pkg);
      expect(files.some((file) => file.path === 'skyforge.package.json')).toBe(true);
      expect(studioPackageFromFolderFiles(files)).toEqual(pkg);
    });
  });

  it('produces deterministic change reports and persists review comments', () => {
    const before = createBuiltInStudioPackages()[1]!;
    const after = structuredClone(before);
    if (after.format !== 'skyforge-tuning-pack') throw new Error('unexpected package');
    after.payload.enemies[0]!.health += 5;
    after.manifest.updatedAt = '2026-07-12T21:00:00.000Z';
    after.manifest.contentRevision += 1;
    const changes = diffStudioPackages(before, after);
    expect(changes).toHaveLength(1);
    expect(changes[0]?.path).toContain('/payload/enemies/0/health');
    const commented = withReviewComment(
      after,
      createReviewComment({
        id: 'review-health',
        author: 'Marty',
        body: 'Confirm this change on hard difficulty.',
        targetPath: changes[0]!.path,
        createdAt: '2026-07-12T21:05:00.000Z',
      }),
    );
    expect(commented.reviewComments).toHaveLength(1);
    expect(packageReviewMarkdown(before, commented)).toContain('Confirm this change');
  });

  it('hashes live resources, removes dead resources, and enforces the lock', async () => {
    const packages = createBuiltInStudioPackages();
    const workspace = createBuiltInWorkspace();
    const asset = packages.find((pkg) => pkg.format === 'skyforge-asset-pack');
    if (!asset || asset.format !== 'skyforge-asset-pack')
      throw new Error('asset missing');
    asset.resources.push({
      id: 'unused-resource',
      uri: 'embedded/unused.png',
      mediaType: 'image/png',
      embeddedData: 'AQID',
      bytes: 3,
      sha256: '039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81',
    });
    const lock = createDependencyLock(workspace, packages, '2026-07-12T20:00:00.000Z');
    const result = await compileProductionWorkspace(workspace, packages, lock, {
      generatedAt: '2026-07-12T20:00:00.000Z',
      requireLock: true,
      fetchResource: async (uri) =>
        new Uint8Array(await readFile(`public/${uri.replace(/^\//, '')}`)),
    });
    expect(result.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(result.manifest?.removedResources).toContainEqual({
      packageKey: 'asset:skyforge-placeholder-assets',
      resourceId: 'unused-resource',
      reason: 'unreferenced by compiled package content',
    });
    expect(
      result.manifest?.resources.every((resource) => resource.sha256.length === 64),
    ).toBe(true);
  });

  it('blocks production compilation when a blocking review comment remains open', async () => {
    const packages = createBuiltInStudioPackages();
    packages[0] = withReviewComment(
      packages[0]!,
      createReviewComment({
        id: 'block-release',
        author: 'Reviewer',
        body: 'Route validation needs approval.',
        severity: 'blocking',
        createdAt: '2026-07-12T20:00:00.000Z',
      }),
    );
    const result = await compileProductionWorkspace(
      createBuiltInWorkspace(),
      packages,
      undefined,
      { fetchResource: async () => new Uint8Array([1]) },
    );
    expect(result.manifest).toBeUndefined();
    expect(result.issues.some((issue) => issue.message.includes('blocking review'))).toBe(
      true,
    );
  });
});
