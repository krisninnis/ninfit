import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const read = (path: string) => readFileSync(join(repoRoot, path), 'utf8');

function sourceFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(join(repoRoot, directory), { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      found.push(...sourceFiles(path));
      continue;
    }
    if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) found.push(path);
  }
  return found;
}

describe('screen failure isolation', () => {
  it('wraps the whole route switch, not only the primary tabs', () => {
    const app = read('src/App.tsx');

    expect(app).toContain("import { ScreenErrorBoundary } from './ui/components/ScreenErrorBoundary'");
    expect(app).toContain('<ScreenErrorBoundary key={screenKey}');

    const opens = app.indexOf('<ScreenErrorBoundary key={screenKey}');
    const closes = app.indexOf('</ScreenErrorBoundary>');
    expect(opens).toBeGreaterThan(-1);
    expect(closes).toBeGreaterThan(opens);

    // Every route-level screen must sit inside that one boundary. These are exactly
    // the screens that previously had nothing beneath them: a render failure there
    // unmounted the whole application and left a blank page with no way back.
    const contained = app.slice(opens, closes);
    for (const screen of [
      '<NinFitIdScreen',
      '<DataScreen',
      '<ActiveJourneyScreen',
      '<JourneyCompletionScreen',
      '<JourneyDetailScreen',
      '<JourneyPostcardScreen',
      '<JourneyLaunchScreen',
      '<JourneyScreen',
      '<PassportScreen',
      '<SettingsScreen',
      '<CurrentScreen',
    ]) {
      expect(contained).toContain(screen);
    }
  });

  it('keeps a way out in the fallback even where there is no tab bar', () => {
    const boundary = read('src/ui/components/ScreenErrorBoundary.tsx');

    expect(boundary).toContain('static getDerivedStateFromError()');
    expect(boundary).toContain("This screen couldn't open");
    expect(boundary).toContain('Your data has not been changed.');
    expect(boundary).toContain('href={this.props.homeHash}');
    // The fallback must not promise a repair it does not perform, nor perform one.
    expect(boundary).not.toContain('localStorage.clear');
    expect(boundary).not.toContain('window.location.reload');
  });

  it('remounts the boundary per destination so leaving and returning is a real retry', () => {
    const app = read('src/App.tsx');
    expect(app).toContain("const screenKey = route.kind === 'tab' ? `tab:${route.tab}` : route.kind;");
  });
});

describe('lazy chunk failure isolation', () => {
  /**
   * Every lazily imported module is a separate hashed file. A deployment can move
   * while a phone is still running the previous build, and the import then rejects.
   * That must degrade one region, never a whole screen and never the application -
   * so the rule is general, not a list of the modules that have already bitten us.
   */
  it('gives every lazy call site a region boundary in the same file', () => {
    const offenders = sourceFiles('src/ui').filter((path) => {
      const source = read(path);
      return /\blazy\(/.test(source) && !source.includes('RegionErrorBoundary');
    });

    expect(offenders).toEqual([]);
  });

  it('does not repair, clear or reload anything when a region fails', () => {
    const boundary = read('src/ui/components/RegionErrorBoundary.tsx');
    expect(boundary).toContain('static getDerivedStateFromError()');
    expect(boundary).not.toContain('localStorage');
    expect(boundary).not.toContain('window.location');
  });

  it('keeps a recording Journey alive when its map chunk cannot load', () => {
    const screen = read('src/ui/screens/ActiveJourneyScreen.tsx');
    const boundaryAt = screen.indexOf('<RegionErrorBoundary');
    const mapAt = screen.indexOf('<ActiveJourneyMap');
    expect(boundaryAt).toBeGreaterThan(-1);
    expect(boundaryAt).toBeLessThan(mapAt);
    expect(screen).toContain(
      'This Journey is still recording and your distance is still being saved.',
    );
  });
});
