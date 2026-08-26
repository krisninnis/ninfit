import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { PRIMARY_NAV } from '../ui/tabs';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');

const layout = read('styles', 'layout.css');
const nav = read('styles', 'components', 'nav.css');
const scales = read('styles', 'tokens', 'scales.css');
const tabBar = read('ui', 'components', 'TabBar.tsx');
const app = read('App.tsx');

function desktopBlock(source: string): string {
  const at = source.indexOf('@media (min-width: 900px)');
  return at === -1 ? '' : source.slice(at);
}

function mobileBaseline(source: string): string {
  const at = source.indexOf('@media (min-width: 900px)');
  return at === -1 ? source : source.slice(0, at);
}

describe('one navigation, two compositions', () => {
  it('has exactly one navigation component', () => {
    expect(app).toContain('<TabBar');
    expect(app).toContain('current={currentNav}');
    expect([...app.matchAll(/<TabBar/g)]).toHaveLength(1);
    expect(app).not.toMatch(/SideNav|Sidebar|DesktopNav/);
  });

  it('renders the same primary destinations from the same source at every width', () => {
    expect(tabBar).toContain('PRIMARY_NAV.map');
    expect(PRIMARY_NAV.map((item) => item.id)).toEqual([
      'today',
      'week',
      'journey',
      'progress',
      'profile',
      'data',
    ]);
    expect(tabBar).not.toMatch(/matchMedia|innerWidth|isDesktop|min-width/);
  });

  it('marks the current destination once, for both compositions', () => {
    expect(tabBar).toContain("aria-current={isCurrent ? 'page' : undefined}");
    expect([...tabBar.matchAll(/aria-current/g)]).toHaveLength(1);
  });
});

describe('every area stays reachable at every width', () => {
  it('never hides the navigation', () => {
    for (const [name, source] of [
      ['nav.css', nav],
      ['layout.css', layout],
    ] as const) {
      expect(source, `${name} hides the tab bar`).not.toMatch(
        /\.tabbar[^{]*\{[^}]*display:\s*none/,
      );
    }
  });

  it('keeps the bottom bar as the mobile-first baseline', () => {
    const baseline = mobileBaseline(nav);
    expect(baseline).toContain('.tabbar {');
    expect(baseline).toContain('display: flex');
    expect(baseline).toContain('env(safe-area-inset-bottom)');
  });

  it('leaves tablets on the bottom bar', () => {
    expect(nav).toContain('@media (min-width: 900px)');
    expect(nav).not.toContain('@media (min-width: 600px)');
  });
});

describe('desktop is composed, not stretched', () => {
  it('turns the bar into a vertical rail', () => {
    const desktop = desktopBlock(nav);
    expect(desktop).toContain('flex-direction: column');
    expect(desktop).toContain('flex-direction: row');
  });

  it('gives the shell a sidebar column beside the content', () => {
    const desktop = desktopBlock(layout);
    expect(desktop).toContain('grid-template-columns: var(--ft-sidenav-width) minmax(0, 1fr)');
    expect(desktop).toContain('grid-column: 2');
    expect(desktopBlock(nav)).toContain('grid-column: 1');
  });

  it('does not widen the reading column to pay for the sidebar', () => {
    expect(scales).toContain('--ft-content-max-wide: 720px');
    expect(scales).toContain(
      '--ft-shell-max: calc(var(--ft-sidenav-width) + var(--ft-content-max-wide) + 96px)',
    );
    expect(desktopBlock(layout)).toContain('max-width: var(--ft-shell-max)');
  });

  it('distinguishes the current destination more strongly on a rail', () => {
    const desktop = desktopBlock(nav);
    expect(desktop).toContain("[aria-current='page']");
    expect(desktop).toContain('background: var(--ft-accent-soft)');
  });

  it('introduces no colour of its own', () => {
    const desktop = desktopBlock(nav);
    expect(desktop).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\brgb\(|\bhsl\(|\boklch\(/);
  });
});

describe('it disturbs nothing already working', () => {
  it('leaves the single path activation point alone', () => {
    expect([...app.matchAll(/data-path=/g)]).toHaveLength(1);
  });

  it('leaves the backdrop and its computed contrast figure alone', () => {
    expect(app).toContain('<PageBackdrop');
    expect(layout).toContain(
      'color-mix(in oklab, var(--ft-surface-page) 95%, transparent)',
    );
  });

  it('leaves the startup cinematic outside the shell', () => {
    expect(app).toContain('<StartupCinematic');
    const shell = app.slice(app.indexOf('if (!introDone)'), app.indexOf('game.needsOnboarding'));
    expect(shell).not.toContain('TabBar');
  });

  it('keeps only primary destinations chromed', () => {
    expect(app).toContain("const showPrimaryNav = route.kind === 'tab' || showJourneyHome;");
    expect(app).toContain("route.kind === 'account'");
    expect(app).toContain("route.kind === 'journey-active'");
  });

  it('adds no navigation library and no new routing dependency', () => {
    expect(app).toContain('parseRouteFromHash');
    expect(app).toContain('routeAfterHashChange');
    const pkg = readFileSync(join(SRC, '..', 'package.json'), 'utf8');
    expect(pkg).not.toMatch(/react-router|wouter|@tanstack\/router/);
  });
});
