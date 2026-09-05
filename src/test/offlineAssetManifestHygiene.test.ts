import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const read = (path: string) => readFileSync(join(repoRoot, path), 'utf8');

const generator = read('scripts/prepare-offline-boot.mjs');

/** The extension allow-list as the build step actually declares it. */
function declaredStableExtensions(): string[] {
  const block = generator.match(
    /const STABLE_ASSET_EXTENSIONS = new Set\(\[([\s\S]*?)\]\);/,
  );
  if (!block?.[1]) throw new Error('The offline build step no longer declares an extension set');
  return [...block[1].matchAll(/'([^']+)'/g)].map((match) => match[1] as string);
}

function filesUnder(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(join(repoRoot, directory), { withFileTypes: true })) {
    if (entry.isDirectory()) {
      found.push(...filesUnder(`${directory}/${entry.name}`));
      continue;
    }
    if (entry.isFile()) found.push(entry.name);
  }
  return found;
}

function wouldBePrecached(fileName: string, extensions: string[]): boolean {
  if (fileName.startsWith('.')) return false;
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0) return false;
  return extensions.includes(fileName.slice(dot).toLowerCase());
}

describe('offline asset manifest hygiene', () => {
  it('filters the stable art directories before adding anything to the offline set', () => {
    expect(generator).toContain('const STABLE_ASSET_EXTENSIONS');
    expect(generator).toContain('function isStableRuntimeAsset(fileName)');
    // The guard must run before the path is added, not merely exist.
    expect(generator.indexOf('if (!isStableRuntimeAsset(entry))')).toBeLessThan(
      generator.indexOf('assetPaths.add(assetPath)'),
    );
    expect(generator).toContain('skippedStableFiles.push(assetPath)');
  });

  it('does not treat documentation or placeholders as renderable artwork', () => {
    const extensions = declaredStableExtensions();
    for (const notArtwork of ['.md', '.txt', '.json', '.html', '.mjs', '.ts']) {
      expect(extensions).not.toContain(notArtwork);
    }
  });

  it('excludes every working file that actually sits in the shipped art directories', () => {
    const extensions = declaredStableExtensions();

    // `public/mascots` is a working directory: it carries the asset-contract README
    // and `.gitkeep` placeholders. Those were being precached onto every device as
    // though they were app artwork, spending offline cache budget on internal notes.
    const excluded = ['mascots', 'egg']
      .flatMap((directory) => filesUnder(`public/${directory}`))
      .filter((fileName) => !wouldBePrecached(fileName, extensions));

    expect(excluded).toContain('README.md');
    expect(excluded).toContain('.gitkeep');
  });

  it('still precaches the artwork the offline UI renders', () => {
    const extensions = declaredStableExtensions();
    const mascotArtwork = filesUnder('public/mascots').filter((fileName) =>
      wouldBePrecached(fileName, extensions),
    );
    const eggArtwork = filesUnder('public/egg').filter((fileName) =>
      wouldBePrecached(fileName, extensions),
    );

    expect(mascotArtwork.length).toBeGreaterThan(0);
    expect(eggArtwork.length).toBeGreaterThan(0);
    expect(mascotArtwork.some((name) => name.endsWith('.webp'))).toBe(true);
    expect(eggArtwork.every((name) => name.endsWith('.svg'))).toBe(true);
  });
});
