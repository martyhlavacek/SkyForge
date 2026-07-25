import type { StudioPackage, StudioReviewComment } from '../schemas/studioPackageSchema';
import { stableStringify } from './PackageCodec';
import { packageTypeOf } from './PackageTypes';

export interface PackageChange {
  path: string;
  kind: 'added' | 'removed' | 'changed';
  before?: unknown;
  after?: unknown;
}

const IGNORED_PATHS = new Set(['/manifest/updatedAt', '/manifest/contentRevision']);

function escapePointer(value: string): string {
  return value.replace(/~/g, '~0').replace(/\//g, '~1');
}

function walk(
  before: unknown,
  after: unknown,
  path: string,
  changes: PackageChange[],
): void {
  if (IGNORED_PATHS.has(path)) return;
  if (stableStringify(before) === stableStringify(after)) return;
  if (before === undefined) {
    changes.push({ path, kind: 'added', after });
    return;
  }
  if (after === undefined) {
    changes.push({ path, kind: 'removed', before });
    return;
  }
  const beforeObject = before && typeof before === 'object';
  const afterObject = after && typeof after === 'object';
  if (!beforeObject || !afterObject || Array.isArray(before) !== Array.isArray(after)) {
    changes.push({ path, kind: 'changed', before, after });
    return;
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    const max = Math.max(before.length, after.length);
    for (let index = 0; index < max; index += 1)
      walk(before[index], after[index], `${path}/${index}`, changes);
    return;
  }
  const left = before as Record<string, unknown>;
  const right = after as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
  keys.forEach((key) =>
    walk(left[key], right[key], `${path}/${escapePointer(key)}`, changes),
  );
}

export function diffStudioPackages(
  before: StudioPackage,
  after: StudioPackage,
): PackageChange[] {
  if (
    packageTypeOf(before) !== packageTypeOf(after) ||
    before.manifest.id !== after.manifest.id
  )
    throw new Error('Package comparison requires matching package type and ID');
  const changes: PackageChange[] = [];
  walk(before, after, '', changes);
  return changes.sort((a, b) => a.path.localeCompare(b.path));
}

export function createReviewComment(input: {
  id: string;
  author: string;
  body: string;
  targetPath?: string;
  severity?: StudioReviewComment['severity'];
  createdAt?: string;
}): StudioReviewComment {
  return {
    id: input.id,
    author: input.author,
    body: input.body,
    targetPath: input.targetPath ?? '/',
    severity: input.severity ?? 'note',
    status: 'open',
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export function withReviewComment(
  pkg: StudioPackage,
  comment: StudioReviewComment,
): StudioPackage {
  if (pkg.reviewComments.some((existing) => existing.id === comment.id))
    throw new Error(`Review comment ${comment.id} already exists`);
  return {
    ...structuredClone(pkg),
    reviewComments: [...pkg.reviewComments, structuredClone(comment)],
    manifest: {
      ...pkg.manifest,
      contentRevision: pkg.manifest.contentRevision + 1,
      updatedAt: comment.createdAt,
    },
  } as StudioPackage;
}

export function resolveReviewComment(
  pkg: StudioPackage,
  commentId: string,
  updatedAt = new Date().toISOString(),
): StudioPackage {
  let found = false;
  const reviewComments = pkg.reviewComments.map((comment) => {
    if (comment.id !== commentId) return comment;
    found = true;
    return { ...comment, status: 'resolved' as const, updatedAt };
  });
  if (!found) throw new Error(`Review comment ${commentId} was not found`);
  return {
    ...structuredClone(pkg),
    reviewComments,
    manifest: {
      ...pkg.manifest,
      contentRevision: pkg.manifest.contentRevision + 1,
      updatedAt,
    },
  } as StudioPackage;
}

function formatValue(value: unknown): string {
  if (value === undefined) return '—';
  const text = JSON.stringify(value);
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

export function packageReviewMarkdown(
  before: StudioPackage,
  after: StudioPackage,
): string {
  const changes = diffStudioPackages(before, after);
  const open = after.reviewComments.filter((comment) => comment.status === 'open');
  const lines = [
    `# ${after.manifest.name} change review`,
    '',
    `- Package: \`${packageTypeOf(after)}:${after.manifest.id}\``,
    `- Version: ${before.manifest.version} → ${after.manifest.version}`,
    `- Content revision: ${before.manifest.contentRevision} → ${after.manifest.contentRevision}`,
    `- Changes: ${changes.length}`,
    `- Open review comments: ${open.length}`,
    '',
    '## Deterministic changes',
    '',
  ];
  if (!changes.length) lines.push('No material content changes.');
  changes.forEach((change) => {
    lines.push(`- **${change.kind}** \`${change.path || '/'}\``);
    if (change.kind !== 'added')
      lines.push(`  - before: \`${formatValue(change.before)}\``);
    if (change.kind !== 'removed')
      lines.push(`  - after: \`${formatValue(change.after)}\``);
  });
  lines.push('', '## Open review comments', '');
  if (!open.length) lines.push('No open comments.');
  open.forEach((comment) =>
    lines.push(
      `- **${comment.severity}** \`${comment.targetPath}\` — ${comment.body} _(${comment.author})_`,
    ),
  );
  return `${lines.join('\n')}\n`;
}
