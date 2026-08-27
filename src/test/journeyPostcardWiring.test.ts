import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');

const app = read('App.tsx');
const detail = read('ui', 'screens', 'JourneyDetailScreen.tsx');
const postcard = read('ui', 'screens', 'JourneyPostcardScreen.tsx');
const postcardPresentation = read('ui', 'journeyPostcardPresentation.ts');
const renderer = read('ui', 'components', 'JourneyRouteMap.tsx');

describe('Journey Postcard disclosure boundary', () => {
  it('is an explicit preview route from completed Journey detail', () => {
    expect(detail).toContain('Preview Journey Postcard');
    expect(app).toContain("route.kind === 'journey-postcard'");
    expect(app).toContain('journeyPostcardHash(route.journeyId)');
  });

  it('builds postcard route geometry only through the privacy projection', () => {
    expect(postcardPresentation).toContain('projectJourneyRouteForDisclosure(journey)');
    expect(postcard).toContain('segments={postcard.route.segments}');
    expect(postcard).not.toContain('acceptedPoints');
    expect(postcard).not.toContain('segmentStarts');
    expect(postcard).not.toContain('rawPoints');
  });

  it('does not instantiate a map when the privacy projection has no route', () => {
    expect(postcard).toContain('const hasRoute = postcard.route.segments.length > 0');
    expect(postcard).toContain('{hasRoute ? (');
    expect(postcard).toContain('Route not shown');
  });

  it('keeps the generic renderer blind to Journey storage truth', () => {
    expect(renderer).not.toContain('acceptedPoints');
    expect(renderer).not.toContain('segmentStarts');
    expect(renderer).not.toContain('rawPoints');
    expect(renderer).not.toContain('loadJourneyHistory');
  });

  it('does not add sharing/export/network upload behavior in v1', () => {
    for (const source of [app, detail, postcard, postcardPresentation]) {
      expect(source).not.toContain('navigator.share');
      expect(source).not.toContain('toDataURL');
      expect(source).not.toContain('upload');
      expect(source).not.toContain('supabase');
    }
    expect(postcard).toContain('Sharing and export are not enabled yet.');
  });
});
