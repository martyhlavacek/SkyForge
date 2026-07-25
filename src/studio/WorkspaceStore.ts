import type { StudioPackage, StudioWorkspace } from '../schemas/studioPackageSchema';
import { migrateStudioPackage, migrateStudioWorkspace } from './PackageMigrations';

const WORKSPACE_KEY = 'skyforge_studio_workspace_v2';
const PACKAGES_KEY = 'skyforge_studio_packages_v2';
const LEGACY_WORKSPACE_KEY = 'skyforge_studio_workspace_v1';
const LEGACY_PACKAGES_KEY = 'skyforge_studio_packages_v1';

export function saveStudioWorkspace(workspace: StudioWorkspace): void {
  try {
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
  } catch {
    // Local storage is optional; exported workspace files remain authoritative.
  }
}

export function loadStudioWorkspace(): StudioWorkspace | null {
  try {
    const raw =
      localStorage.getItem(WORKSPACE_KEY) ?? localStorage.getItem(LEGACY_WORKSPACE_KEY);
    if (!raw) return null;
    const result = migrateStudioWorkspace(JSON.parse(raw));
    if (result.migrated) saveStudioWorkspace(result.value);
    return result.value;
  } catch {
    return null;
  }
}

export function saveStudioPackages(packages: StudioPackage[]): void {
  try {
    const lightweight = packages.map((pkg) => {
      if (pkg.format !== 'skyforge-asset-pack' && pkg.format !== 'skyforge-music-pack')
        return pkg;
      return {
        ...pkg,
        resources: pkg.resources.map(
          ({ embeddedData: _embeddedData, ...resource }) => resource,
        ),
      };
    });
    localStorage.setItem(PACKAGES_KEY, JSON.stringify(lightweight));
  } catch {
    // IndexedDB persists full asset and music packages. Other package exports remain authoritative.
  }
}

export function loadStudioPackages(): StudioPackage[] | null {
  try {
    const raw =
      localStorage.getItem(PACKAGES_KEY) ?? localStorage.getItem(LEGACY_PACKAGES_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const packages = parsed.map((candidate) => migrateStudioPackage(candidate).value);
    if (
      parsed.some(
        (candidate) =>
          Number((candidate as { schemaVersion?: number }).schemaVersion) < 2,
      )
    )
      saveStudioPackages(packages);
    return packages;
  } catch {
    return null;
  }
}
