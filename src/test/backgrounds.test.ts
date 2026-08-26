import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  BACKDROPS,
  BACKDROP_FOR_TAB,
  BACKDROP_IDS,
  backdrop,
  MIN_VEIL,
  backdropAssetDir,
  hasArtwork,
  type BackdropId,
} from '../ui/backgrounds/registry';
import { TABS, type TabId } from '../ui/tabs';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const ROOT = join(SRC, '..');

const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

function openingTagContaining(source: string, needle: string): string {
  const at = source.indexOf(needle);
  if (at === -1) return '';
  const start = source.lastIndexOf('<', at);
  const end = source.indexOf('>', at);
  return start === -1 || end === -1 ? '' : source.slice(start, end + 1);
}

const app = read('App.tsx');
const primitive = read('ui', 'components', 'PageBackdrop.tsx');
const backdropCss = read('styles', 'components', 'backdrop.css');

/** The repository's directory-walk idiom: always `withFileTypes`, recurse by hand. */
function entryNames(dir: string, match: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && match.test(entry.name))
    .map((entry) => entry.name);
}

function directoryNames(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

/**
 * Every reference sheet, at any depth, as a path relative to the reference root.
 *
 * Recursive rather than a flat read of one directory, because the reference library
 * is organised into subfolders as it grows and a flat read fails the moment a sheet
 * is filed somewhere sensible. That has already happened once: this suite went red
 * when the Opal sheet moved into `mascots/`, reporting correct housekeeping as a
 * code defect. Paths are returned relative so a test can assert WHERE something is
 * filed as well as that it exists.
 */
function referenceArtwork(dir: string, prefix = ''): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) found.push(...referenceArtwork(join(dir, entry.name), relative));
    else if (entry.isFile() && /\.png$/i.test(entry.name)) found.push(relative);
  }
  return found;
}

const fileName = (path: string) => path.split('/').pop() ?? '';

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...sourceFiles(full));
    else if (entry.isFile() && /\.tsx?$/.test(entry.name)) found.push(full);
  }
  return found;
}

const screenFiles = entryNames(join(SRC, 'ui', 'screens'), /\.tsx$/).map((name) => ({
  name,
  source: read('ui', 'screens', name),
}));

const componentFiles = entryNames(join(SRC, 'ui', 'components'), /\.tsx$/).map((name) => ({
  name,
  source: read('ui', 'components', name),
}));

/**
 * The world layer.
 *
 * The thing most worth defending here is not that a background appears - it is that
 * the background stays decorative. Artwork that starts carrying meaning, or that
 * starts deciding a fitness path, is how this feature would quietly damage both
 * accessibility and the theme engine.
 */

// ---------------------------------------------------------------------------

describe('the registry', () => {
  it('gives every region a stable, unique, url-safe id', () => {
    expect(new Set(BACKDROP_IDS).size).toBe(BACKDROP_IDS.length);
    for (const id of BACKDROP_IDS) {
      expect(id, `${id} is not url-safe`).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it('keys every entry by its own id, so lookup cannot drift', () => {
    for (const id of BACKDROP_IDS) {
      expect(BACKDROPS[id].id, `${id} is filed under the wrong key`).toBe(id);
      expect(backdrop(id).id).toBe(id);
    }
  });

  it('covers every region named in the product direction', () => {
    const expected: BackdropId[] = [
      'today',
      'week',
      'progress',
      'adventures',
      'zen',
      'flow',
      'trail',
      'forge',
      'pulse',
      'flex',
      'trophy-vault',
      'shop',
      'journey-wall',
      'crews',
      'profile',
      'settings',
      'data',
    ];
    expect([...BACKDROP_IDS].sort()).toEqual([...expected].sort());
  });

  it('describes every region in words as well as pictures', () => {
    for (const id of BACKDROP_IDS) {
      expect(backdrop(id).label.length, `${id} has no label`).toBeGreaterThan(0);
      expect(backdrop(id).brief.length, `${id} has no art brief`).toBeGreaterThan(0);
    }
  });

  it('keeps every focal point inside the image', () => {
    for (const id of BACKDROP_IDS) {
      const { x, y } = backdrop(id).focal;
      expect(x, `${id} focal x`).toBeGreaterThanOrEqual(0);
      expect(x, `${id} focal x`).toBeLessThanOrEqual(1);
      expect(y, `${id} focal y`).toBeGreaterThanOrEqual(0);
      expect(y, `${id} focal y`).toBeLessThanOrEqual(1);
    }
  });

  it('never veils below the computed accessibility floor', () => {
    for (const id of BACKDROP_IDS) {
      const { light, dark } = backdrop(id).veil;
      expect(light, `${id} light veil`).toBeGreaterThanOrEqual(MIN_VEIL.light);
      expect(light, `${id} light veil`).toBeLessThanOrEqual(1);
      expect(dark, `${id} dark veil`).toBeGreaterThanOrEqual(MIN_VEIL.dark);
      expect(dark, `${id} dark veil`).toBeLessThanOrEqual(1);
    }
  });

  it('derives asset directories from the id rather than storing a path twice', () => {
    for (const id of BACKDROP_IDS) {
      expect(backdropAssetDir(id)).toBe(`/backgrounds/${id}`);
    }
  });

  it('reports missing artwork honestly instead of substituting something else', () => {
    for (const id of BACKDROP_IDS) {
      const art = backdrop(id).art;
      expect(hasArtwork(id)).toBe(art !== undefined);
      if (art) {
        expect(art.mobile, `${id} mobile art`).toContain(`/backgrounds/${id}/`);
        expect(art.desktop, `${id} desktop art`).toContain(`/backgrounds/${id}/`);
      }
    }
  });
});

// ---------------------------------------------------------------------------

describe('screens name a region, never a file', () => {
  it('maps every existing tab to a region', () => {
    for (const tab of TABS) {
      const id = BACKDROP_FOR_TAB[tab.id as TabId];
      expect(id, `${tab.id} has no backdrop`).toBeDefined();
      expect(BACKDROP_IDS).toContain(id);
    }
  });

  it('resolves the region in one place, from the route', () => {
    expect(app).toContain('BACKDROP_FOR_TAB[tab]');
    expect(app).toContain('<PageBackdrop id={');
  });

  it('lets no screen hard-code a background url or image', () => {
    for (const { name, source } of screenFiles) {
      const stripped = code(source).replace(
        /^import\s+\w+\s+from\s+'[^']*assets\/brand\/[\w-]+\.svg';?$/gm,
        '',
      );

      expect(stripped, `${name} references an image url`).not.toMatch(
        /url\(|\.(png|jpe?g|webp|avif|svg)\b/i,
      );
      expect(stripped, `${name} sets a background`).not.toMatch(/backgroundImage|background:/);
      expect(stripped, `${name} reaches into the background asset tree`).not.toContain(
        'backgrounds/',
      );
    }
  });

  it('lets no component outside the primitive set a page background image', () => {
    for (const { name, source } of componentFiles) {
      if (name === 'PageBackdrop.tsx') continue;
      expect(code(source), `${name} sets a background image`).not.toContain('backgroundImage');
    }
  });

  it('keeps background urls out of the domain and game layers', () => {
    for (const file of sourceFiles(join(SRC, 'domain'))) {
      const source = readFileSync(file, 'utf8');
      expect(source, `${file} mentions backgrounds`).not.toMatch(/backgrounds\/|backdrop/i);
    }
  });
});

// ---------------------------------------------------------------------------

describe('artwork stays decorative', () => {
  it('hides the backdrop from assistive technology', () => {
    expect(primitive).toContain('aria-hidden="true"');
  });

  it('gives it no alt text, label or role', () => {
    expect(code(primitive)).not.toContain('alt=');
    expect(code(primitive)).not.toContain('aria-label');
    expect(code(primitive)).not.toContain('role=');
  });

  it('never renders the registry label or brief as content', () => {
    expect(primitive).not.toContain('{definition.label}');
    expect(primitive).not.toContain('{definition.brief}');
  });

  it('does not intercept taps meant for the app', () => {
    expect(backdropCss).toContain('pointer-events: none');
  });

  it('leaves every screen stating its own meaning in text', () => {
    for (const { name, source } of screenFiles) {
      if (!source.includes('<Screen')) continue;
      expect(source, `${name} has no title`).toMatch(/title=/);
    }
  });
});

// ---------------------------------------------------------------------------

describe('backgrounds are not a second path system', () => {
  it('keeps exactly one data-path activation point on the app root', () => {
    const occurrences = [...app.matchAll(/data-path=/g)];
    const rootTag = openingTagContaining(app, 'data-path={game.state.pathId}');
    expect(occurrences).toHaveLength(1);
    expect(rootTag).toContain('className=');
    expect(rootTag).toContain('app');
    expect(rootTag).toContain('data-path={game.state.pathId}');
  });

  it('never lets the backdrop read or write the fitness path', () => {
    expect(code(primitive)).not.toContain('data-path');
    expect(code(primitive)).not.toContain('pathId');
    const registry = read('ui', 'backgrounds', 'registry.ts');
    expect(code(registry)).not.toContain('pathId');
    expect(code(registry)).not.toContain('FitnessPath');
  });

  it('sets a distinct attribute, so the two can never be confused', () => {
    expect(primitive).toContain('data-backdrop=');
    expect(backdropCss).not.toContain('data-path');
  });

  it('takes the region from the route and the accent from game state', () => {
    expect(app).toContain('BACKDROP_FOR_TAB[tab]');
    expect(app).toContain('data-path={game.state.pathId}');
  });
});

// ---------------------------------------------------------------------------

describe('the veil holds WCAG AA over artwork that does not exist yet', () => {
  const hex = (value: string): [number, number, number] => {
    const h = value.replace('#', '');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [
      number,
      number,
      number,
    ];
  };
  const channel = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = ([r, g, b]: [number, number, number]) =>
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  const contrast = (a: [number, number, number], b: [number, number, number]) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
    return (hi + 0.05) / (lo + 0.05);
  };
  const over = (
    fg: [number, number, number],
    alpha: number,
    bg: [number, number, number],
  ): [number, number, number] => [
    fg[0] * alpha + bg[0] * (1 - alpha),
    fg[1] * alpha + bg[1] * (1 - alpha),
    fg[2] * alpha + bg[2] * (1 - alpha),
  ];

  const PAGE = { light: hex('#f7f6f3'), dark: hex('#16181a') };
  const TEXT = {
    light: { primary: hex('#2b2b28'), secondary: hex('#55554d'), tertiary: hex('#6e6d64') },
    dark: { primary: hex('#e9e7e1'), secondary: hex('#a5a49d'), tertiary: hex('#8e8e86') },
  };
  const EXTREMES: Array<[number, number, number]> = [
    [0, 0, 0],
    [1, 1, 1],
  ];
  const AA_BODY = 4.5;

  const worstCase = (mode: 'light' | 'dark', role: keyof typeof TEXT.light, alpha: number) =>
    Math.min(
      ...EXTREMES.map((art) => contrast(TEXT[mode][role], over(PAGE[mode], alpha, art))),
    );

  for (const mode of ['light', 'dark'] as const) {
    for (const role of ['primary', 'secondary', 'tertiary'] as const) {
      it(`keeps ${mode} ${role} text at AA on mobile, over any artwork`, () => {
        const alpha = MIN_VEIL[mode];
        const ratio = worstCase(mode, role, alpha);
        expect(
          ratio,
          `${mode} ${role} over worst-case artwork at veil ${alpha} is ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(AA_BODY);
      });
    }
  }

  it('proves the floor is actually necessary', () => {
    expect(worstCase('light', 'tertiary', 0.85)).toBeLessThan(AA_BODY);
    expect(worstCase('dark', 'secondary', 0.67)).toBeLessThan(AA_BODY);
  });

  it('keeps desktop safe through the content column, not the veil', () => {
    const COLUMN = 0.95;
    for (const mode of ['light', 'dark'] as const) {
      const veil = MIN_VEIL[mode] * (mode === 'light' ? 0.4 : 0.42);
      for (const art of EXTREMES) {
        const column = over(PAGE[mode], COLUMN, over(PAGE[mode], veil, art));
        for (const role of ['secondary', 'tertiary'] as const) {
          const ratio = contrast(TEXT[mode][role], column);
          expect(ratio, `desktop ${mode} ${role} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
            AA_BODY,
          );
        }
      }
    }
  });

  it('makes the CSS fallback default the floor, not something softer', () => {
    expect(backdropCss).toContain(`--backdrop-veil-light: ${MIN_VEIL.light}`);
    expect(backdropCss).toContain(`--backdrop-veil-dark: ${MIN_VEIL.dark}`);
  });

  it('pins the desktop column opacity the calculation depends on', () => {
    expect(read('styles', 'layout.css')).toContain(
      'color-mix(in oklab, var(--ft-surface-page) 95%, transparent)',
    );
  });

  it('keeps the mobile veil flat, so there is no weak band to fall through', () => {
    const veilRule = backdropCss.slice(
      backdropCss.indexOf('.backdrop__veil {'),
      backdropCss.indexOf('@media (min-width: 900px)'),
    );
    expect(veilRule).not.toContain('linear-gradient');
    expect(veilRule).toContain('color-mix');
  });
});

describe('readability', () => {
  it('layers art, then veil, then content', () => {
    const artAt = primitive.indexOf('backdrop__art');
    const veilAt = primitive.indexOf('backdrop__veil');
    expect(artAt).toBeGreaterThan(-1);
    expect(veilAt).toBeGreaterThan(artAt);
  });

  it('always renders the veil, whether or not artwork exists', () => {
    const veils = [...primitive.matchAll(/backdrop__veil/g)];
    expect(veils).toHaveLength(1);
    expect(primitive).not.toContain('? <div className="backdrop__veil"');
  });

  it('keeps the world layer behind the app shell', () => {
    expect(backdropCss).toContain('z-index: 0');
    expect(read('styles', 'layout.css')).toContain('z-index: 1');
  });

  it('introduces no raw colour of its own', () => {
    expect(backdropCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(backdropCss).not.toMatch(/\brgb\(|\bhsl\(/);
    expect(backdropCss).toContain('var(--ft-surface-page)');
  });

  it('treats light and dark by strength rather than by a separate palette', () => {
    expect(backdropCss).toContain('--backdrop-veil-light');
    expect(backdropCss).toContain('--backdrop-veil-dark');
    expect(backdropCss).toContain("[data-theme='dark']");
    expect(backdropCss).toContain('prefers-color-scheme: dark');
  });
});

// ---------------------------------------------------------------------------

describe('responsive shell', () => {
  it('keeps the bottom navigation on mobile', () => {
    expect(app).toContain('<TabBar current={tab}');
    const nav = read('styles', 'components', 'nav.css');
    expect(nav).toContain('.tabbar');
  });

  it('reaches every existing area from the desktop shell too', () => {
    const layout = read('styles', 'layout.css');
    expect(layout).not.toMatch(/\.tabbar\s*\{[^}]*display:\s*none/);
    const nav = read('styles', 'components', 'nav.css');
    expect(nav).not.toMatch(/min-width:\s*900px[\s\S]{0,200}display:\s*none/);
    expect(Object.keys(BACKDROP_FOR_TAB).sort()).toEqual(TABS.map((t) => t.id).sort());
  });

  it('crops for narrow screens using the focal point, not a hard centre', () => {
    expect(backdropCss).toContain('var(--backdrop-focal-x) var(--backdrop-focal-y)');
    expect(backdropCss).toContain('background-size: cover');
  });

  it('lets the artwork breathe on desktop instead of stretching the phone layout', () => {
    expect(backdropCss).toContain('@media (min-width: 900px)');
    expect(backdropCss).toContain('var(--backdrop-art-desktop)');
    expect(read('styles', 'layout.css')).toContain('max-width: var(--ft-shell-max)');
  });
});

// ---------------------------------------------------------------------------

describe('performance', () => {
  it('imports no image into the bundle', () => {
    for (const source of [app, primitive, read('ui', 'backgrounds', 'registry.ts')]) {
      expect(source).not.toMatch(/^import .*\.(png|jpe?g|webp|avif)/m);
    }
  });

  it('fetches only the region on screen', () => {
    const mounts = [...app.matchAll(/<PageBackdrop/g)];
    expect(mounts).toHaveLength(1);
  });

  it('requests nothing at all while a region has no artwork', () => {
    expect(primitive).toContain('definition.art');
    expect(primitive).toContain("data-artwork={definition.art ? 'production' : 'placeholder'}");
    expect(backdropCss).toContain("[data-artwork='production']");
  });

  it('respects a request for reduced data', () => {
    expect(backdropCss).toContain('prefers-reduced-data: reduce');
  });

  it('keeps the account feature lazily loaded', () => {
    expect(code(app)).not.toContain('data/supabase');
    expect(read('ui', 'screens', 'ProfileScreen.tsx')).toContain('lazy(() =>');
  });
});

// ---------------------------------------------------------------------------

describe('assets on disk', () => {
  const REFERENCE_ROOT = join(ROOT, 'docs', 'brand', 'reference');

  it('has a folder for every region', () => {
    const dirs = directoryNames(join(ROOT, 'public', 'backgrounds'));
    expect(dirs.sort()).toEqual([...BACKDROP_IDS].sort());
  });

  it('documents what still has to be drawn', () => {
    const readme = readFileSync(join(ROOT, 'public', 'backgrounds', 'README.md'), 'utf8');
    expect(readme).toContain('No production background artwork exists yet');
    expect(readme).toContain('reference only');
  });

  it('keeps the generated sheets in the reference library, wherever they are filed', () => {
    const names = referenceArtwork(REFERENCE_ROOT).map(fileName);
    expect(names).toContain('ninfit-page-backgrounds-concept-v1.png');
    expect(names).toContain('ninfit-opal-mascot-reference-v1.png');
  });

  it('files mascot sheets under mascots/, however many there are', () => {
    const mascotSheets = referenceArtwork(REFERENCE_ROOT).filter((path) =>
      /mascot/i.test(path),
    );

    expect(mascotSheets.length).toBeGreaterThan(0);
    for (const path of mascotSheets) {
      expect(path, `${path} should be filed under mascots/`).toMatch(/^mascots\//);
    }
  });

  it('never uses a reference sheet as production background artwork', () => {
    const names = referenceArtwork(REFERENCE_ROOT).map(fileName);
    expect(names.length).toBeGreaterThan(0);

    for (const id of BACKDROP_IDS) {
      const art = backdrop(id).art;
      if (!art) continue;

      for (const url of [art.mobile, art.desktop]) {
        expect(url).not.toMatch(/concept|reference|sheet/i);
        for (const name of names) {
          expect(url, `${id} points at reference sheet ${name}`).not.toContain(name);
        }
        expect(url).not.toMatch(/docs\//);
        expect(url).toContain(`/backgrounds/${id}/`);
      }
    }
  });
});
