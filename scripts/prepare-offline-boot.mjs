import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';

const root = process.cwd();
const distRoot = join(root, 'dist');
const viteManifestPath = join(distRoot, '.vite', 'manifest.json');
const indexPath = join(distRoot, 'index.html');
const outputPath = join(distRoot, 'offline-assets.json');
const stablePublicDirs = ['mascots', 'egg'];

/**
 * Only real runtime artwork belongs in the offline set.
 *
 * `public/mascots` and `public/egg` are working directories: they carry a README
 * describing the asset contracts and `.gitkeep` placeholders. Those were being
 * precached onto every device as though they were app artwork, which spends cache
 * budget and copies internal notes into the browser cache for no reason. Anything
 * the UI cannot render is skipped and reported rather than silently shipped.
 */
const STABLE_ASSET_EXTENSIONS = new Set([
  '.avif',
  '.gif',
  '.jpeg',
  '.jpg',
  '.mp4',
  '.png',
  '.svg',
  '.webm',
  '.webp',
]);

const skippedStableFiles = [];

function fail(message) {
  throw new Error(`[offline-boot] ${message}`);
}

function isStableRuntimeAsset(fileName) {
  if (fileName.startsWith('.')) return false;
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0) return false;
  return STABLE_ASSET_EXTENSIONS.has(fileName.slice(dot).toLowerCase());
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
    const assetPath = `/${posix.normalize(relativePath)}`;

    if (!isStableRuntimeAsset(entry)) {
      skippedStableFiles.push(assetPath);
      continue;
    }

    assetPaths.add(assetPath);
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

if (skippedStableFiles.length > 0) {
  console.log(`Skipped ${skippedStableFiles.length} non-runtime file(s) in stable art directories:`);
  for (const skipped of skippedStableFiles.sort()) console.log(`  ${skipped}`);
}
