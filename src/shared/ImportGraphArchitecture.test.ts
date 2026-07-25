import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    if (!['.ts', '.tsx'].includes(extname(path)) || path.includes('.test.')) return [];
    return [resolve(path)];
  });
}

function resolveImport(
  from: string,
  specifier: string,
  files: Set<string>,
): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = resolve(dirname(from), specifier);
  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ])
    if (existsSync(candidate) && files.has(candidate)) return candidate;
  return null;
}

function graphCycles(): string[][] {
  const root = resolve(process.cwd(), 'src');
  const nodes = sourceFiles(root);
  const files = new Set(nodes);
  const graph = new Map<string, string[]>();
  for (const file of nodes) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const dependencies: string[] = [];
    source.forEachChild((node) => {
      if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) return;
      const module = node.moduleSpecifier;
      if (!module || !ts.isStringLiteral(module)) return;
      const dependency = resolveImport(file, module.text, files);
      if (dependency) dependencies.push(dependency);
    });
    graph.set(file, dependencies);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  const walk = (node: string): void => {
    if (visited.has(node)) return;
    if (visiting.has(node)) {
      const start = stack.indexOf(node);
      cycles.push(
        [...stack.slice(start), node].map((path) => path.slice(root.length + 1)),
      );
      return;
    }
    visiting.add(node);
    stack.push(node);
    graph.get(node)?.forEach(walk);
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  };
  nodes.forEach(walk);
  return cycles;
}

describe('production import graph', () => {
  it('contains no circular source dependencies', () => {
    expect(graphCycles()).toEqual([]);
  });
});
