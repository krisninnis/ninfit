import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');

const screen = read('ui', 'screens', 'ActiveJourneyScreen.tsx');
const map = read('ui', 'components', 'ActiveJourneyMap.tsx');
const presentation = read('ui', 'journeyMapPresentation.ts');

describe('Journey Live Map truth boundary', () => {
  it('renders the map from Active Journey while keeping Swim on the honest fallback', () => {
    expect(screen).toContain('<ActiveJourneyMap journey={journey} />');
    expect(screen).toContain('journeyUsesPhoneGps(journey.activityType)');
    expect(screen).toContain("active-journey__world--${usesPhoneGps ? 'map' : 'fallback'}");
  });

  it('does not own browser geolocation or the hardened watcher lifecycle', () => {
    expect(map).not.toContain('navigator.geolocation');
    expect(map).not.toContain('watchPosition(');
    expect(map).not.toContain('startForegroundJourneyGpsSession');
    expect(map).not.toContain('createActiveJourneyGpsSession');
    expect(presentation).not.toContain('navigator.geolocation');
  });

  it('does not accept GPS, calculate distance, or alter recorder semantics', () => {
    for (const source of [map, presentation]) {
      expect(source).not.toContain('acceptJourneyGpsSample');
      expect(source).not.toContain('evaluateJourneySegment');
      expect(source).not.toContain('journeyDistanceM');
      expect(source).not.toContain('distanceAddedM');
      expect(source).not.toContain('recovery.');
    }
  });

  it('consumes only accepted points plus explicit segment starts for route lines', () => {
    expect(presentation).toContain("journey.route?.acceptedPoints");
    expect(presentation).toContain("journey.route?.segmentStarts");
    expect(presentation).not.toContain('rawPoints');
  });

  it('uses an open, no-key basemap with visible OpenStreetMap attribution', () => {
    expect(map).toContain("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
    expect(map).toContain('&copy; OpenStreetMap contributors');
    expect(map).toContain('VITE_MAP_TILE_URL');
    expect(map).toContain('interactive: false');
  });

  it('keeps map-facing source text encoding-safe', () => {
    expect(map).not.toContain('Â');
    expect(screen).not.toContain('â');
  });

  it('loads the heavyweight map presentation only when Active Journey needs it', () => {
    expect(screen).toContain("lazy(async () =>");
    expect(screen).toContain("import('../components/ActiveJourneyMap')");
    expect(screen).toContain('<Suspense');
  });

  it('keeps MapLibre as a presentation dependency rather than adding a React map wrapper', () => {
    expect(map).toContain("from 'maplibre-gl'");
    expect(map).not.toContain('react-map-gl');
  });
});