import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';

const root = process.cwd();
const distRoot = join(root, 'dist');
const viteManifestPath = join(distRoot, '.vite', 'manifest.json');
const indexPath = join(distRoot, 'index.html');
const outputPath = join(distRoot, 'offline-assets.json');
const stablePublicDirs = ['mascots', 'egg'];

function fail(message) {
  throw new Error(`[offline-boot] ${message}`);
}

function addDirectoryFiles(directory, assetPaths) {
  if (!existsSync(directory)) return;

  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    const info = statSync(fullPath);
    if (info.isDirectory()) {
      addDirectoryFiles(fullPath, assetPaths);
      continue;
    }
    if (!info.isFile()) continue;

    const relativePath = relative(distRoot, fullPath).split(sep).join('/');
    assetPaths.add(`/${posix.normalize(relativePath)}`);
  }
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

for (const directory of stablePublicDirs) {
  addDirectoryFiles(join(distRoot, directory), assetPaths);
}

const assets = [...assetPaths].sort();
if (assets.length === 0) fail('offline manifest produced no assets');

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
  `${JSON.stringify({ version: 2, assets }, null, 2)}\n`,
  'utf8',
);

console.log(`Offline asset manifest: ${assets.length} asset(s)`);
for (const asset of assets) console.log(`  ${asset}`);
