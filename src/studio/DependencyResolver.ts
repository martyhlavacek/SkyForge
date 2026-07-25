import type {
  StudioPackage,
  StudioPackageDependency,
  StudioPackageType,
  StudioWorkspace,
} from '../schemas/studioPackageSchema';
import { studioPackageKey } from './PackageCodec';
import { packageTypeOf } from './PackageTypes';

export interface StudioResolutionIssue {
  severity: 'error' | 'warning';
  code:
    | 'duplicate-package'
    | 'missing-package'
    | 'version-mismatch'
    | 'dependency-cycle'
    | 'workspace-type-mismatch';
  packageKey?: string;
  message: string;
}

export interface StudioResolutionResult {
  ordered: StudioPackage[];
  issues: StudioResolutionIssue[];
}

interface VersionTriple {
  major: number;
  minor: number;
  patch: number;
}

function parseVersion(version: string): VersionTriple | null {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  return match
    ? { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) }
    : null;
}

function compareVersion(a: VersionTriple, b: VersionTriple): number {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

export function satisfiesVersion(version: string, range: string): boolean {
  if (range === '*' || range === 'latest') return true;
  const actual = parseVersion(version);
  if (!actual) return false;
  if (range.startsWith('>=')) {
    const required = parseVersion(range.slice(2));
    return Boolean(required && compareVersion(actual, required) >= 0);
  }
  if (range.startsWith('^')) {
    const required = parseVersion(range.slice(1));
    return Boolean(
      required &&
      actual.major === required.major &&
      compareVersion(actual, required) >= 0,
    );
  }
  const exact = parseVersion(range);
  return Boolean(exact && compareVersion(actual, exact) === 0);
}

function dependencyKey(dependency: StudioPackageDependency): string {
  return `${dependency.type}:${dependency.id}`;
}

function workspaceReferences(
  workspace: StudioWorkspace,
): [StudioPackageType, string, string][] {
  return (Object.keys(workspace.packages) as StudioPackageType[]).map((type) => {
    const reference = workspace.packages[type];
    return [type, reference.id, reference.version];
  });
}

export function resolveStudioWorkspace(
  workspace: StudioWorkspace,
  packages: StudioPackage[],
): StudioResolutionResult {
  const issues: StudioResolutionIssue[] = [];
  const byKey = new Map<string, StudioPackage>();

  for (const pkg of packages) {
    const key = studioPackageKey(pkg);
    if (byKey.has(key)) {
      issues.push({
        severity: 'error',
        code: 'duplicate-package',
        packageKey: key,
        message: `duplicate package ${key}`,
      });
      continue;
    }
    byKey.set(key, pkg);
  }

  for (const [type, id, version] of workspaceReferences(workspace)) {
    const key = `${type}:${id}`;
    const pkg = byKey.get(key);
    if (!pkg) {
      issues.push({
        severity: 'error',
        code: 'missing-package',
        packageKey: key,
        message: `workspace requires missing package ${key}`,
      });
      continue;
    }
    if (packageTypeOf(pkg) !== type) {
      issues.push({
        severity: 'error',
        code: 'workspace-type-mismatch',
        packageKey: key,
        message: `${key} has an unexpected package type`,
      });
    }
    if (pkg.manifest.version !== version) {
      issues.push({
        severity: 'error',
        code: 'version-mismatch',
        packageKey: key,
        message: `workspace pins ${key}@${version}, but ${pkg.manifest.version} is loaded`,
      });
    }
  }

  for (const pkg of packages) {
    const owner = studioPackageKey(pkg);
    for (const dependency of pkg.manifest.dependencies) {
      const key = dependencyKey(dependency);
      const target = byKey.get(key);
      if (!target) {
        issues.push({
          severity: dependency.optional ? 'warning' : 'error',
          code: 'missing-package',
          packageKey: owner,
          message: `${owner} requires ${key} ${dependency.versionRange}`,
        });
        continue;
      }
      if (!satisfiesVersion(target.manifest.version, dependency.versionRange)) {
        issues.push({
          severity: dependency.optional ? 'warning' : 'error',
          code: 'version-mismatch',
          packageKey: owner,
          message: `${owner} requires ${key} ${dependency.versionRange}, loaded ${target.manifest.version}`,
        });
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const ordered: StudioPackage[] = [];

  const visit = (key: string, trail: string[]) => {
    if (visited.has(key)) return;
    if (visiting.has(key)) {
      issues.push({
        severity: 'error',
        code: 'dependency-cycle',
        packageKey: key,
        message: `dependency cycle: ${[...trail, key].join(' -> ')}`,
      });
      return;
    }
    const pkg = byKey.get(key);
    if (!pkg) return;
    visiting.add(key);
    for (const dependency of pkg.manifest.dependencies) {
      visit(dependencyKey(dependency), [...trail, key]);
    }
    visiting.delete(key);
    visited.add(key);
    ordered.push(pkg);
  };

  for (const [type, id] of workspaceReferences(workspace)) visit(`${type}:${id}`, []);

  return { ordered, issues };
}
