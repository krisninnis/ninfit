import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');

const screen = read('ui', 'screens', 'ActiveJourneyScreen.tsx');
const map = read('ui', 'components', 'ActiveJourneyMap.tsx');
const renderer = read('ui', 'components', 'JourneyRouteMap.tsx');
const presentation = read('ui', 'journeyMapPresentation.ts');

describe('Journey Live Map truth boundary', () => {
  it('renders the map from Active Journey while keeping Swim on the honest fallback', () => {
    expect(screen).toContain('<ActiveJourneyMap journey={journey} />');
    expect(screen).toContain('journeyUsesPhoneGps(journey.activityType)');
    expect(screen).toContain("active-journey__world--${usesPhoneGps ? 'map' : 'fallback'}");
  });

  it('does not own browser geolocation or the hardened watcher lifecycle', () => {
    for (const source of [map, renderer]) {
      expect(source).not.toContain('navigator.geolocation');
      expect(source).not.toContain('watchPosition(');
      expect(source).not.toContain('startForegroundJourneyGpsSession');
      expect(source).not.toContain('createActiveJourneyGpsSession');
    }
    expect(presentation).not.toContain('navigator.geolocation');
  });

  it('does not accept GPS, calculate distance, or alter recorder semantics', () => {
    for (const source of [map, renderer, presentation]) {
      expect(source).not.toContain('acceptJourneyGpsSample');
      expect(source).not.toContain('evaluateJourneySegment');
      expect(source).not.toContain('journeyDistanceM');
      expect(source).not.toContain('distanceAddedM');
      expect(source).not.toContain('recovery.');
    }
  });

  it('keeps private Journey truth outside the generic map renderer', () => {
    expect(map).toContain('journeyTrustedRouteSegments(journey)');
    expect(map).toContain('journeyLatestTrustedPoint(journey)');
    expect(renderer).not.toContain('JourneyRoute');
    expect(renderer).not.toContain('acceptedPoints');
    expect(renderer).not.toContain('segmentStarts');
    expect(renderer).not.toContain('rawPoints');
    expect(presentation).not.toContain('rawPoints');
  });

  it('uses an open, no-key basemap with visible OpenStreetMap attribution', () => {
    expect(renderer).toContain("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
    expect(renderer).toContain('&copy; OpenStreetMap contributors');
    expect(renderer).toContain('VITE_MAP_TILE_URL');
    expect(renderer).toContain('interactive: false');
  });

  it('keeps map-facing source text encoding-safe', () => {
    expect(renderer).not.toContain('Â');
    expect(screen).not.toContain('â');
  });

  it('contains map-renderer startup failure so recording UI can stay alive', () => {
    expect(renderer).toContain('try {');
    expect(renderer).toContain('setMapUnavailable(true)');
    expect(map).toContain('Your Journey recording continues safely.');
  });

  it('loads the heavyweight map presentation only when Active Journey needs it', () => {
    expect(screen).toContain("lazy(async () =>");
    expect(screen).toContain("import('../components/ActiveJourneyMap')");
    expect(screen).toContain('<Suspense');
  });

  it('keeps MapLibre as a presentation dependency rather than adding a React map wrapper', () => {
    expect(renderer).toContain("from 'maplibre-gl'");
    expect(renderer).not.toContain('react-map-gl');
  });
});