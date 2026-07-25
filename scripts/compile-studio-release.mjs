#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { compileRelease, loadPackages, loadWorkspace } from './studio-release-lib.mjs';
const [, , workspaceArg, packageDirArg, lockArg, outputArg, publicArg = 'public'] =
  process.argv;
if (!workspaceArg || !packageDirArg || !lockArg || !outputArg) {
  console.error(
    'Usage: node scripts/compile-studio-release.mjs <workspace> <package-dir> <lock> <output-dir> [public-dir]',
  );
  process.exit(2);
}
const workspace = await loadWorkspace(resolve(workspaceArg));
const packages = await loadPackages(resolve(packageDirArg));
const lock = JSON.parse(await readFile(resolve(lockArg), 'utf8'));
const manifest = await compileRelease({
  workspace,
  packages,
  lock,
  output: resolve(outputArg),
  publicDir: resolve(publicArg),
});
console.log(`Compiled ${manifest.resources.length} resources to ${outputArg}`);
console.log(`Fingerprint: ${manifest.contentFingerprint}`);
