// Minimal esbuild bundler for the extension.
// Outputs dist/ that can be loaded as an unpacked Chrome extension.
import { build, context } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const watch = process.argv.includes('--watch');
const outdir = 'dist';

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

const common = {
  bundle: true,
  format: 'esm',
  target: 'es2022',
  platform: 'browser',
  sourcemap: true,
  logLevel: 'info'
};

const entries = [
  { in: 'src/background/index.ts', out: 'background' },
  { in: 'src/popup/popup.ts', out: 'popup' }
];

async function copyStatic() {
  await cp('manifest.json', path.join(outdir, 'manifest.json'));
  await cp('src/popup/popup.html', path.join(outdir, 'popup.html'));
  await cp('src/popup/popup.css', path.join(outdir, 'popup.css'));
  if (existsSync('icons')) {
    await cp('icons', path.join(outdir, 'icons'), { recursive: true });
  }
}

if (watch) {
  const ctx = await context({ ...common, entryPoints: entries, outdir });
  await ctx.watch();
  await copyStatic();
  console.log('watching...');
} else {
  await build({ ...common, entryPoints: entries, outdir });
  await copyStatic();
  console.log('build complete -> dist/');
}
