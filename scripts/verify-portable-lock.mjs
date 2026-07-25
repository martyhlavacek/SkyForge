import { readFile } from 'node:fs/promises';

const lockText = await readFile(new URL('../package-lock.json', import.meta.url), 'utf8');
const forbiddenPatterns = [
  /(?:^|[./-])internal(?:[./-]|$)/i,
  /artifactory/i,
  /applied-caas-gateway/i,
];
const matches = forbiddenPatterns.filter((pattern) => pattern.test(lockText));

if (matches.length > 0) {
  console.error('Non-portable internal registry references found in package-lock.json.');
  process.exit(1);
}

const lock = JSON.parse(lockText);
const root = lock.packages?.[''];
if (!root || root.name !== lock.name || root.version !== lock.version) {
  console.error('package-lock.json root metadata is inconsistent.');
  process.exit(1);
}

console.log('Portable lockfile check passed.');
