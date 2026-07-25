import type { TuningStudioPackage } from '../../schemas/studioPackageSchema';

export interface TuningDifference {
  path: string;
  before: number | string | boolean | null;
  after: number | string | boolean | null;
  delta?: number;
  percent?: number;
}

function isScalar(value: unknown): value is number | string | boolean | null {
  return value === null || ['number', 'string', 'boolean'].includes(typeof value);
}

function walk(
  before: unknown,
  after: unknown,
  path: string,
  result: TuningDifference[],
): void {
  if (isScalar(before) && isScalar(after)) {
    if (Object.is(before, after)) return;
    const diff: TuningDifference = { path, before, after };
    if (typeof before === 'number' && typeof after === 'number') {
      diff.delta = after - before;
      if (Math.abs(before) > 1e-9)
        diff.percent = ((after - before) / Math.abs(before)) * 100;
    }
    result.push(diff);
    return;
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    const max = Math.max(before.length, after.length);
    for (let i = 0; i < max; i++) walk(before[i], after[i], `${path}/${i}`, result);
    return;
  }
  if (
    before &&
    after &&
    typeof before === 'object' &&
    typeof after === 'object' &&
    !Array.isArray(before) &&
    !Array.isArray(after)
  ) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    [...keys]
      .sort()
      .forEach((key) =>
        walk(
          (before as Record<string, unknown>)[key],
          (after as Record<string, unknown>)[key],
          `${path}/${key}`,
          result,
        ),
      );
    return;
  }
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    result.push({
      path,
      before: isScalar(before) ? before : JSON.stringify(before),
      after: isScalar(after) ? after : JSON.stringify(after),
    });
  }
}

export function diffTuningPackages(
  baseline: TuningStudioPackage,
  candidate: TuningStudioPackage,
): TuningDifference[] {
  const result: TuningDifference[] = [];
  walk(baseline.payload, candidate.payload, '/payload', result);
  return result;
}

export function tuningReviewMarkdown(
  baseline: TuningStudioPackage,
  candidate: TuningStudioPackage,
  differences = diffTuningPackages(baseline, candidate),
): string {
  const lines = [
    '# Skyforge Tuning Review',
    '',
    `- Baseline: ${baseline.manifest.name} ${baseline.manifest.version}`,
    `- Candidate: ${candidate.manifest.name} ${candidate.manifest.version}`,
    `- Changed scalar values: ${differences.length}`,
    '',
    '| Path | Before | After | Delta |',
    '|---|---:|---:|---:|',
  ];
  differences.forEach((change) => {
    const delta =
      change.delta === undefined
        ? '—'
        : `${change.delta >= 0 ? '+' : ''}${change.delta.toFixed(3)}${change.percent === undefined ? '' : ` (${change.percent >= 0 ? '+' : ''}${change.percent.toFixed(1)}%)`}`;
    lines.push(
      `| \`${change.path}\` | ${String(change.before)} | ${String(change.after)} | ${delta} |`,
    );
  });
  if (differences.length === 0) lines.push('| _No changes_ | — | — | — |');
  lines.push('');
  return `${lines.join('\n')}\n`;
}
