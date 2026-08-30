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

export function currentAppBuildInfo(doc: Document = document): AppBuildInfo {
  const assetUrls = [
    ...Array.from(doc.scripts, (script) => script.src),
    ...Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'), (link) => link.href),
  ].filter((url) => url.length > 0);

  return {
    version: __APP_VERSION__,
    channel: buildChannelForHostname(doc.location.hostname),
    fingerprint: buildFingerprintFromAssetUrls(assetUrls),
  };
}
