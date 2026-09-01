import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');

const home = read('ui', 'screens', 'JourneyScreen.tsx');
const panel = read('ui', 'components', 'AdventureMapPanel.tsx');
const projection = read('domain', 'adventureMap.ts');
const renderer = read('ui', 'components', 'JourneyRouteMap.tsx');

describe('Living Fitness Adventure Map v1 wiring', () => {
  it('derives the map from existing durable Journey history rather than a second store', () => {
    expect(home).toContain('const history = loadJourneyHistory(storage);');
    expect(home).toContain('const adventure = adventureMapSnapshot(history);');
    expect(projection).toContain('journeyTrustedRouteSegments(journey)');
    expect(projection).not.toContain('localStorage');
    expect(projection).not.toContain('storage.set');
  });

  it('opens from Journey Home only when the user asks to see it', () => {
    expect(home).toContain('showAdventureMap');
    expect(home).toContain('aria-expanded={showAdventureMap}');
    expect(home).toContain('{showAdventureMap ? <AdventureMapPanel snapshot={adventure} /> : null}');
  });

  it('passes trusted projected segments into the existing generic map renderer', () => {
    expect(panel).toContain('segments={snapshot.segments}');
    expect(panel).not.toContain('acceptedPoints');
    expect(panel).not.toContain('rawPoints');
    expect(renderer).not.toContain('loadJourneyHistory');
  });

  it('states the no-invented-route rule at the point where the combined map is shown', () => {
    expect(panel).toContain('Gaps stay gaps; NinFit does not guess where you went.');
  });

  it('adds no sharing, cloud sync, geocoding or background location behaviour', () => {
    for (const source of [home, panel, projection]) {
      expect(source).not.toContain('navigator.share');
      expect(source).not.toContain('supabase');
      expect(source).not.toContain('geocode');
      expect(source).not.toContain('watchPosition');
      expect(source).not.toContain('preciseRouteCloudSync = true');
    }
  });
});
