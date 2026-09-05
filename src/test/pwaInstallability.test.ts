import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (path: string) =>
  readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8');

describe('PWA installability', () => {
  it('links the web app manifest from index.html', () => {
    const html = read('index.html');
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('/manifest.webmanifest');
  });

  it('declares NinFit as a standalone app using the canonical generated icons', () => {
    const manifest = JSON.parse(read('public/manifest.webmanifest')) as {
      name: string;
      short_name: string;
      start_url: string;
      scope: string;
      display: string;
      icons: Array<{ src: string; sizes: string }>;
    };

    expect(manifest.name).toBe('NinFit');
    expect(manifest.short_name).toBe('NinFit');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: '/icons/icon-192.png', sizes: '192x192' }),
        expect.objectContaining({ src: '/icons/icon-512.png', sizes: '512x512' }),
      ]),
    );
  });

  it('registers a same-origin service worker without changing app behaviour when unsupported', () => {
    const main = read('src/main.tsx');
    const registration = read('src/pwa/registerServiceWorker.ts');

    expect(main).toContain('registerServiceWorker();');
    expect(registration).toContain("'serviceWorker' in navigator");
    expect(registration).toContain("register('/sw.js', { updateViaCache: 'none' })");
    expect(registration).toContain('registration.update()');
    expect(registration).toContain("document.visibilityState === 'visible'");
    expect(registration).not.toContain('window.location.reload');
  });

  it('keeps navigation network-first while caching the exact Vite build for offline boot', () => {
    const worker = read('public/sw.js');
    const viteConfig = read('vite.config.ts');
    const packageJson = read('package.json');
    const offlineBuild = read('scripts/prepare-offline-boot.mjs');

    expect(worker).toContain("event.request.method !== 'GET'");
    expect(worker).toContain('requestUrl.origin !== self.location.origin');
    expect(worker).toContain("event.request.mode === 'navigate'");
    expect(worker).toContain('networkFirstNavigation(event.request)');
    expect(worker).toContain("fetch(request, { cache: 'no-store' })");
    expect(worker).toContain("const OFFLINE_ASSET_MANIFEST = '/offline-assets.json'");
    expect(worker).toContain('await cache.addAll(assets)');
    expect(worker).toContain("cache.put('/', rootResponse.clone())");
    expect(worker).toContain("const CACHE_VERSION = 'ninfit-shell-v3'");

    expect(viteConfig).toContain('manifest: true');
    expect(packageJson).toContain('node scripts/prepare-offline-boot.mjs');
    expect(offlineBuild).toContain("'.vite', 'manifest.json'");
    expect(offlineBuild).toContain("'offline-assets.json'");
    expect(offlineBuild).toContain('manifest references missing build asset');
  });
});
