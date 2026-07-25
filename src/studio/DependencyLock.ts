import {
  StudioDependencyLockSchema,
  type StudioDependencyLock,
  type StudioPackage,
  type StudioWorkspace,
} from '../schemas/studioPackageSchema';
import { contentFingerprint } from './PackageCodec';
import { packageTypeOf } from './PackageTypes';
import { resolveStudioWorkspace } from './DependencyResolver';

export interface LockValidationIssue {
  severity: 'error' | 'warning';
  message: string;
  packageKey?: string;
}

export function createDependencyLock(
  workspace: StudioWorkspace,
  packages: StudioPackage[],
  generatedAt = new Date().toISOString(),
): StudioDependencyLock {
  const resolution = resolveStudioWorkspace(workspace, packages);
  const errors = resolution.issues.filter((issue) => issue.severity === 'error');
  if (errors.length) throw new Error(errors.map((issue) => issue.message).join('; '));
  const packageLocks = resolution.ordered.map((pkg) => ({
    type: packageTypeOf(pkg),
    id: pkg.manifest.id,
    version: pkg.manifest.version,
    contentRevision: pkg.manifest.contentRevision,
    fingerprint: contentFingerprint(pkg),
    resources: pkg.resources
      .map((resource) => ({
        id: resource.id,
        sha256: resource.sha256,
        bytes: resource.bytes,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  }));
  const workspaceFingerprint = contentFingerprint(workspace);
  const lockBase = {
    format: 'skyforge-lock' as const,
    schemaVersion: 1 as const,
    workspace: {
      id: workspace.id,
      version: workspace.version,
      fingerprint: workspaceFingerprint,
    },
    packages: packageLocks,
    generatedAt,
  };
  return StudioDependencyLockSchema.parse({
    ...lockBase,
    fingerprint: contentFingerprint(lockBase),
  });
}

export function validateDependencyLock(
  lock: StudioDependencyLock,
  workspace: StudioWorkspace,
  packages: StudioPackage[],
): LockValidationIssue[] {
  const issues: LockValidationIssue[] = [];
  const parsed = StudioDependencyLockSchema.safeParse(lock);
  if (!parsed.success)
    return parsed.error.issues.map((issue) => ({
      severity: 'error',
      message: `${issue.path.join('.')}: ${issue.message}`,
    }));
  if (lock.workspace.id !== workspace.id || lock.workspace.version !== workspace.version)
    issues.push({ severity: 'error', message: 'lock targets a different workspace' });
  if (lock.workspace.fingerprint !== contentFingerprint(workspace))
    issues.push({
      severity: 'error',
      message: 'workspace fingerprint differs from lock',
    });

  const current = new Map(
    packages.map((pkg) => [`${packageTypeOf(pkg)}:${pkg.manifest.id}`, pkg]),
  );
  lock.packages.forEach((entry) => {
    const key = `${entry.type}:${entry.id}`;
    const pkg = current.get(key);
    if (!pkg) {
      issues.push({ severity: 'error', packageKey: key, message: `${key} is missing` });
      return;
    }
    if (pkg.manifest.version !== entry.version)
      issues.push({
        severity: 'error',
        packageKey: key,
        message: `${key} version ${pkg.manifest.version} differs from locked ${entry.version}`,
      });
    if (pkg.manifest.contentRevision !== entry.contentRevision)
      issues.push({
        severity: 'error',
        packageKey: key,
        message: `${key} content revision differs from lock`,
      });
    if (contentFingerprint(pkg) !== entry.fingerprint)
      issues.push({
        severity: 'error',
        packageKey: key,
        message: `${key} content changed`,
      });
    const resources = new Map(pkg.resources.map((resource) => [resource.id, resource]));
    entry.resources.forEach((lockedResource) => {
      const resource = resources.get(lockedResource.id);
      if (!resource) {
        issues.push({
          severity: 'error',
          packageKey: key,
          message: `${key} resource ${lockedResource.id} is missing`,
        });
        return;
      }
      if (lockedResource.sha256 && resource.sha256 !== lockedResource.sha256)
        issues.push({
          severity: 'error',
          packageKey: key,
          message: `${key} resource ${lockedResource.id} hash differs from lock`,
        });
      if (lockedResource.bytes !== undefined && resource.bytes !== lockedResource.bytes)
        issues.push({
          severity: 'error',
          packageKey: key,
          message: `${key} resource ${lockedResource.id} byte count differs from lock`,
        });
    });
  });
  const lockedKeys = new Set(lock.packages.map((entry) => `${entry.type}:${entry.id}`));
  current.forEach((_pkg, key) => {
    if (!lockedKeys.has(key))
      issues.push({
        severity: 'warning',
        packageKey: key,
        message: `${key} is not locked`,
      });
  });
  return issues;
}

export function serializeDependencyLock(lock: StudioDependencyLock): string {
  return `${JSON.stringify(lock, null, 2)}\n`;
}

export function parseDependencyLock(text: string): StudioDependencyLock {
  return StudioDependencyLockSchema.parse(JSON.parse(text) as unknown);
}
