import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

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
    expect(registration).toContain("register('/sw.js')");
  });

  it('keeps the service worker conservative: same-origin GETs only and network-first navigation', () => {
    const worker = read('public/sw.js');

    expect(worker).toContain("event.request.method !== 'GET'");
    expect(worker).toContain('requestUrl.origin !== self.location.origin');
    expect(worker).toContain("event.request.mode === 'navigate'");
    expect(worker).toContain('fetch(event.request).catch');
  });
});
