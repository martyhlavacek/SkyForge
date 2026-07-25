#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createLock, json, loadPackages, loadWorkspace } from './studio-release-lib.mjs';
const [, , workspaceArg, packageDirArg, outputArg] = process.argv;
if (!workspaceArg || !packageDirArg || !outputArg) {
  console.error(
    'Usage: node scripts/create-studio-lock.mjs <workspace.sfworkspace> <package-dir> <output.sflock>',
  );
  process.exit(2);
}
const workspace = await loadWorkspace(resolve(workspaceArg));
const packages = await loadPackages(resolve(packageDirArg));
const lock = createLock(workspace, packages);
await mkdir(dirname(resolve(outputArg)), { recursive: true });
await writeFile(resolve(outputArg), json(lock));
console.log(`Created ${outputArg} (${lock.fingerprint})`);
