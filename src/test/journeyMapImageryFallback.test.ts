import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const read = (path: string) => readFileSync(join(repoRoot, path), 'utf8');

const map = read('src/ui/components/JourneyRouteMap.tsx');
const activeJourneyCss = read('src/styles/screens/active-journey.css');
const code = map.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

describe('Journey map base imagery failure', () => {
  it('watches the base imagery source rather than trusting the load event', () => {
    expect(code).toContain("const BASE_IMAGERY_SOURCE = 'osm'");
    expect(code).toContain("map.on('error', onMapError)");
    expect(code).toContain("map.on('data', onTileData)");
    expect(code).toContain('setBaseImageryUnavailable(true)');
  });

  it('does not call one failed tile an outage', () => {
    const threshold = code.match(/const BASE_IMAGERY_FAILURE_THRESHOLD = (\d+);/);
    expect(threshold).not.toBeNull();
    expect(Number(threshold?.[1])).toBeGreaterThan(1);
  });

  it('clears the notice as soon as imagery arrives', () => {
    expect(code).toContain('setBaseImageryUnavailable(false)');
    const arrival = code.indexOf('detail.sourceId === BASE_IMAGERY_SOURCE && detail.tile');
    const clear = code.indexOf('setBaseImageryUnavailable(false)');
    expect(arrival).toBeGreaterThan(-1);
    expect(clear).toBeGreaterThan(arrival);
  });

  it('keeps the map mounted so the recorded route is still drawn', () => {
    const noticeAt = code.indexOf('active-journey__map-imagery-note');
    const canvasAt = code.indexOf('className="active-journey__map"');
    expect(noticeAt).toBeGreaterThan(-1);
    expect(canvasAt).toBeGreaterThan(noticeAt);
    expect(code).toContain("data-base-imagery={baseImageryUnavailable ? 'unavailable' : 'available'}");
  });

  it('detaches its listeners when the map is torn down', () => {
    expect(code).toContain("map.off('data', onTileData)");
    expect(code).toContain("map.off('error', onMapError)");
  });

  it('says only what is true, and never that fitness truth is affected', () => {
    expect(map).toContain('Map images could not load.');
    expect(map).toContain('<span>{unavailableMessage}</span>');
    expect(activeJourneyCss).toContain('.active-journey__map-imagery-note');
  });
});
