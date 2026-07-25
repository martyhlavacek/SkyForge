import {
  type StudioPackage,
  type StudioPackageType,
  type StudioWorkspace,
} from '../schemas/studioPackageSchema';
import { validateStudioPackageSemantics } from './PackageValidation';
import { packageTypeOf } from './PackageTypes';
import { migrateStudioPackage, migrateStudioWorkspace } from './PackageMigrations';

const extensions: Record<StudioPackageType, string> = {
  level: '.sflevelpack',
  tuning: '.sftuning',
  music: '.sfmusic',
  asset: '.sfassetpack',
};

export function studioPackageKey(pkg: StudioPackage): string {
  return `${packageTypeOf(pkg)}:${pkg.manifest.id}`;
}

export function studioPackageFilename(pkg: StudioPackage): string {
  return `${pkg.manifest.id}-${pkg.manifest.version}${extensions[packageTypeOf(pkg)]}`;
}

export function serializeStudioPackage(pkg: StudioPackage): string {
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

export function parseStudioPackage(text: string): StudioPackage {
  const raw: unknown = JSON.parse(text);
  const pkg = migrateStudioPackage(raw).value;
  const issues = validateStudioPackageSemantics(pkg);
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
  }
  return pkg;
}

export function serializeStudioWorkspace(workspace: StudioWorkspace): string {
  return `${JSON.stringify(workspace, null, 2)}\n`;
}

export function parseStudioWorkspace(text: string): StudioWorkspace {
  const raw: unknown = JSON.parse(text);
  return migrateStudioWorkspace(raw).value;
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

/** Deterministic non-cryptographic fingerprint used for local build manifests. */
export function contentFingerprint(value: unknown): string {
  const text = stableStringify(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
