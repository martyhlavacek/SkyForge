#!/usr/bin/env node
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = new URL('../dist/', import.meta.url);
const rootPath = root.pathname;
const files = [];
async function walk(dir) {
  for (const name of await readdir(dir)) {
    const path = join(dir, name);
    const info = await stat(path);
    if (info.isDirectory()) await walk(path);
    else files.push(path);
  }
}
await walk(rootPath);
const assets = [];
for (const path of files) {
  const bytes = await readFile(path);
  assets.push({
    file: relative(rootPath, path),
    bytes: bytes.byteLength,
    gzipBytes: ['.js', '.css', '.html', '.json'].some((ext) => path.endsWith(ext))
      ? gzipSync(bytes).byteLength
      : undefined,
  });
}
const js = assets.filter((item) => item.file.endsWith('.js'));
const css = assets.filter((item) => item.file.endsWith('.css'));
const totalJs = js.reduce((sum, item) => sum + item.bytes, 0);
const totalJsGzip = js.reduce((sum, item) => sum + (item.gzipBytes ?? 0), 0);
const totalCss = css.reduce((sum, item) => sum + item.bytes, 0);
const failures = [];
if (totalJs > 3_200_000) failures.push(`total JS ${totalJs} exceeds 3,200,000 bytes`);
if (totalJsGzip > 900_000)
  failures.push(`gzipped JS ${totalJsGzip} exceeds 900,000 bytes`);
if (totalCss > 500_000) failures.push(`CSS ${totalCss} exceeds 500,000 bytes`);
for (const item of js) {
  const limit = item.file.includes('vendor-phaser') ? 1_650_000 : 800_000;
  if (item.bytes > limit)
    failures.push(`${item.file} ${item.bytes} exceeds ${limit} bytes`);
}
const report = {
  generatedAt: new Date().toISOString(),
  budgets: {
    totalJsBytes: 3_200_000,
    totalJsGzipBytes: 900_000,
    totalCssBytes: 500_000,
    phaserChunkBytes: 1_650_000,
    otherChunkBytes: 800_000,
  },
  totals: { totalJs, totalJsGzip, totalCss },
  largest: [...js].sort((a, b) => b.bytes - a.bytes).slice(0, 12),
  failures,
};
await writeFile(
  join(rootPath, 'build-budget-report.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
