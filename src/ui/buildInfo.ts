export type BuildChannel = 'production' | 'preview' | 'local' | 'web';

export interface AppBuildInfo {
  readonly version: string;
  readonly channel: BuildChannel;
  readonly fingerprint: string;
}

export function buildChannelForHostname(hostname: string): BuildChannel {
  if (hostname === 'ninfit.vercel.app') return 'production';
  if (hostname.endsWith('.vercel.app')) return 'preview';
  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'local';
  return 'web';
}

export function buildFingerprintFromAssetUrls(urls: readonly string[]): string {
  const parts = urls
    .map((url) => {
      try {
        const pathname = new URL(url, 'https://ninfit.invalid').pathname;
        const file = pathname.split('/').pop() ?? '';
        const match = file.match(/-([a-zA-Z0-9_-]{6,})\.(?:js|css)$/);
        return match?.[1];
      } catch {
        return undefined;
      }
    })
    .filter((value): value is string => value !== undefined);

  const unique = [...new Set(parts)];
  return unique.length > 0 ? unique.join('.') : 'unavailable';
}

export function documentAssetUrls(doc: Document): string[] {
  return [
    ...Array.from(doc.scripts, (script) => script.src),
    ...Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'), (link) => link.href),
  ].filter((url) => url.length > 0);
}

/**
 * The entry assets, read once while the document still contains only them.
 *
 * WHY A SNAPSHOT. Route chunks are loaded lazily, and Vite injects their stylesheets
 * into the document when they arrive. Reading the asset list at render time therefore
 * produced a fingerprint that depended on which screens the session had already
 * opened: the same deployment showed `index.index-css` before the Adventure Map had
 * been opened and `index.index-css.map-css` afterwards. A build identifier that two
 * phones on one deployment can disagree about is worse than none, because the whole
 * point of the field is comparing two phones.
 *
 * This module is imported by Settings, which App imports directly, so the snapshot is
 * taken during application start-up, before any lazy chunk can be requested.
 */
const ENTRY_ASSET_URLS: readonly string[] =
  typeof document === 'undefined' ? [] : documentAssetUrls(document);

export function currentAppBuildInfo(
  doc: Document = document,
  assetUrls: readonly string[] = ENTRY_ASSET_URLS,
): AppBuildInfo {
  return {
    version: __APP_VERSION__,
    channel: buildChannelForHostname(doc.location.hostname),
    fingerprint: buildFingerprintFromAssetUrls(assetUrls),
  };
}
