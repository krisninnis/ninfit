export type CssColourResolver = (value: string) => string | undefined;

export interface JourneyMapPaintColours {
  routeCasing: string;
  routeLine: string;
  positionFill: string;
  positionStroke: string;
}

const MAPLIBRE_HEX_COLOUR = /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i;
const RGB_CHANNEL = String.raw`(?:\d+(?:\.\d+)?|\.\d+)%?`;
const MAPLIBRE_RGB_COLOUR = new RegExp(
  String.raw`^rgb\(\s*${RGB_CHANNEL}\s*,\s*${RGB_CHANNEL}\s*,\s*${RGB_CHANNEL}\s*\)$`,
  'i',
);
const MAPLIBRE_RGBA_COLOUR = new RegExp(
  String.raw`^rgba\(\s*${RGB_CHANNEL}\s*,\s*${RGB_CHANNEL}\s*,\s*${RGB_CHANNEL}\s*,\s*${RGB_CHANNEL}\s*\)$`,
  'i',
);

/** MapLibre's style validator accepts these CSS colour forms. */
export function isMapLibreCompatibleColour(value: string): boolean {
  const colour = value.trim();
  return MAPLIBRE_HEX_COLOUR.test(colour)
    || MAPLIBRE_RGB_COLOUR.test(colour)
    || MAPLIBRE_RGBA_COLOUR.test(colour);
}

/**
 * Resolve any browser-supported CSS colour into the sRGB bytes MapLibre renders.
 *
 * CSSOM may preserve modern syntax such as `oklch(...)`, so reading computed style
 * from a temporary element is not enough. A one-pixel canvas performs the browser's
 * real colour conversion and `getImageData()` gives a stable classic RGB value.
 */
export function resolveCssColourToRgb(value: string): string | undefined {
  if (
    typeof document === 'undefined'
    || typeof CSS === 'undefined'
    || typeof CSS.supports !== 'function'
    || !CSS.supports('color', value)
  ) return undefined;

  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (context === null) return undefined;

  context.fillStyle = '#010203';
  context.fillStyle = value;
  if (context.fillStyle === '#010203') return undefined;

  context.clearRect(0, 0, 1, 1);
  context.fillRect(0, 0, 1, 1);

  const pixel = context.getImageData(0, 0, 1, 1).data;
  const red = pixel[0] ?? 0;
  const green = pixel[1] ?? 0;
  const blue = pixel[2] ?? 0;
  const alpha = pixel[3] ?? 0;

  if (alpha === 255) return `rgb(${red}, ${green}, ${blue})`;

  const opacity = (alpha / 255)
    .toFixed(3)
    .replace(/0+$/, '')
    .replace(/\.$/, '');
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

/** Return a non-empty colour that MapLibre can validate. */
export function mapLibreColour(
  value: string,
  fallback: string,
  resolve: CssColourResolver = resolveCssColourToRgb,
): string {
  const colour = value.trim();
  if (isMapLibreCompatibleColour(colour)) return colour;

  const resolved = colour === '' ? undefined : resolve(colour)?.trim();
  if (resolved !== undefined && isMapLibreCompatibleColour(resolved)) return resolved;

  const fallbackColour = fallback.trim();
  if (isMapLibreCompatibleColour(fallbackColour)) return fallbackColour;

  const resolvedFallback = resolve(fallbackColour)?.trim();
  if (
    resolvedFallback !== undefined
    && isMapLibreCompatibleColour(resolvedFallback)
  ) return resolvedFallback;

  throw new Error('MapLibre colour fallback must be a non-empty hex, rgb or rgba value');
}

/** Resolve the two theme tokens once and share them across all four paint slots. */
export function journeyMapPaintColours(
  readToken: (token: string) => string,
  resolve: CssColourResolver = resolveCssColourToRgb,
): JourneyMapPaintColours {
  const surfaceRaised = mapLibreColour(
    readToken('--ft-surface-raised'),
    '#ffffff',
    resolve,
  );
  const accent = mapLibreColour(readToken('--ft-accent'), '#4f8065', resolve);

  return {
    routeCasing: surfaceRaised,
    routeLine: accent,
    positionFill: accent,
    positionStroke: surfaceRaised,
  };
}
