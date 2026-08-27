import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');

const app = read('App.tsx');
const active = read('ui', 'screens', 'ActiveJourneyScreen.tsx');
const detail = read('ui', 'screens', 'JourneyDetailScreen.tsx');
const home = read('ui', 'screens', 'JourneyScreen.tsx');

describe('Journey completion/detail wiring', () => {
  it('navigates a completed Journey to its durable history detail', () => {
    expect(active).toContain('onCompleted?.(next.id)');
    expect(app).toContain('journeyDetailHash(journeyId)');
  });

  it('opens recent Journey history through stable ids', () => {
    expect(home).toContain('journeyDetailHash(journey.id)');
    expect(detail).toContain('item.id === journeyId');
  });

  it('keeps exact route viewing explicitly private/local', () => {
    expect(detail).toContain('Private local view');
    expect(detail).toContain('private local Journey record');
    expect(detail).toContain('journeyTrustedRouteSegments');
  });

  it('does not calculate route distance from coordinates', () => {
    expect(detail).not.toContain('distanceBetween');
    expect(detail).not.toContain('haversine');
    expect(detail).not.toContain('rawPoints');
  });
});
