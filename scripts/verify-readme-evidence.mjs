#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const reportPath = resolve(process.argv[2] ?? '.verification/vitest.json');
const report = JSON.parse(await readFile(reportPath, 'utf8'));
const testFiles = new Set((report.testResults ?? []).map((result) => result.name)).size;
const testCount = Number(report.numPassedTests ?? 0);
if (!report.success || testCount <= 0 || testFiles <= 0)
  throw new Error('Vitest report does not describe a successful run');

let e2eCount = 0;
for (const filename of (await readdir('e2e')).filter((name) => name.endsWith('.spec.ts'))) {
  const source = await readFile(resolve('e2e', filename), 'utf8');
  e2eCount += (source.match(/^test\(/gm) ?? []).length;
}
const readme = await readFile('README.md', 'utf8');
const expectedTests = `**${testCount} passing tests across ${testFiles} files**`;
const expectedE2E = `**${e2eCount} scenarios**`;
if (!readme.includes(expectedTests))
  throw new Error(`README evidence drift: expected ${expectedTests}`);
if (!readme.includes(expectedE2E))
  throw new Error(`README evidence drift: expected ${expectedE2E}`);
console.log(`README evidence verified: ${testCount} tests / ${testFiles} files / ${e2eCount} E2E scenarios.`);
