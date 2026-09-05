import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, posix } from 'node:path';

const root = process.cwd();
const distRoot = join(root, 'dist');
const viteManifestPath = join(distRoot, '.vite', 'manifest.json');
const indexPath = join(distRoot, 'index.html');
const outputPath = join(distRoot, 'offline-assets.json');

function fail(message) {
  throw new Error(`[offline-boot] ${message}`);
}

if (!existsSync(viteManifestPath)) fail('Vite build manifest is missing');
if (!existsSync(indexPath)) fail('dist/index.html is missing');

const viteManifest = JSON.parse(readFileSync(viteManifestPath, 'utf8'));
const assetPaths = new Set();

for (const entry of Object.values(viteManifest)) {
  if (entry === null || typeof entry !== 'object') continue;

  for (const candidate of [entry.file, ...(entry.css ?? []), ...(entry.assets ?? [])]) {
    if (typeof candidate !== 'string') continue;
    const normalized = candidate.replace(/^\.\//, '');
    if (!normalized.startsWith('assets/')) continue;
    assetPaths.add(`/${posix.normalize(normalized)}`);
  }
}

const assets = [...assetPaths].sort();
if (assets.length === 0) fail('Vite manifest produced no boot assets');

for (const asset of assets) {
  const diskPath = join(distRoot, asset.replace(/^\//, ''));
  if (!existsSync(diskPath)) fail(`manifest references missing build asset ${asset}`);
}

const indexHtml = readFileSync(indexPath, 'utf8');
const indexBootAssets = [...indexHtml.matchAll(/(?:src|href)=["']\.?(\/assets\/[^"']+)["']/g)]
  .map((match) => match[1]);

for (const asset of indexBootAssets) {
  if (!assetPaths.has(asset)) {
    fail(`index.html boot dependency is absent from offline asset manifest: ${asset}`);
  }
}

writeFileSync(
  outputPath,
  `${JSON.stringify({ version: 1, assets }, null, 2)}\n`,
  'utf8',
);

console.log(`Offline boot manifest: ${assets.length} built asset(s)`);
for (const asset of assets) console.log(`  ${asset}`);
