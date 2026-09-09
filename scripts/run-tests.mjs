/**
 * Minimal test runner: bundle every tests/**\/*.test.ts with esbuild
 * (already a dependency), then hand the output to node:test.
 *
 * Deliberately dependency-free — no vitest/jest. Only the pure domain
 * layer is under test, which by architecture rule never touches
 * chrome.*, so no browser mocks are needed.
 */
import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { glob, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';

const outdir = '.test-build';

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

const entryPoints = [];
for await (const file of glob('tests/**/*.test.ts')) entryPoints.push(file);

if (entryPoints.length === 0) {
  console.error('no test files found under tests/');
  process.exit(1);
}

await build({
  entryPoints,
  outdir,
  outbase: 'tests',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  sourcemap: 'inline',
  external: ['node:*'],
  outExtension: { '.js': '.mjs' },
  logLevel: 'warning'
});

// Pass explicit files: `node --test <dir>` treats the argument as a
// single module rather than a directory to scan.
const built = entryPoints.map((f) =>
  path.resolve(outdir, path.relative('tests', f).replace(/\.ts$/, '.mjs'))
);

const child = spawn(process.execPath, ['--test', ...built], { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 1));
