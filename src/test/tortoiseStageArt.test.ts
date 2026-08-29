import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MASCOT_STAGE_ART, mascotStageArt } from '../ui/mascotStageArt';

describe('tortoise standing companion artwork', () => {
  it('registers the reviewed Starter artwork', () => {
    expect(mascotStageArt('tortoise', 'starter')).toEqual({
      src: '/mascots/tortoise/tortoise-starter-wave-rest-v1.png',
      motionSrc: '/mascots/tortoise/tortoise-starter-wave-v1.webm',
    });
  });

  it('ships the reviewed Starter wave alongside the standing artwork', () => {
    const art = mascotStageArt('tortoise', 'starter');

    expect(art?.motionSrc).toBe(
      '/mascots/tortoise/tortoise-starter-wave-v1.webm',
    );

    const diskPath = join('public', art!.motionSrc!.replace(/^\//, ''));
    const bytes = readFileSync(diskPath, 'latin1');

    expect(bytes.length).toBeGreaterThan(4);

    // EBML signature used by WebM.
    const signature = Array.from(bytes.slice(0, 4), (char) =>
      char.charCodeAt(0),
    );

    expect(signature).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
  });

  it('does not leak Starter artwork into later tortoise stages', () => {
    expect(mascotStageArt('tortoise', 'growing')).toBeUndefined();
    expect(mascotStageArt('tortoise', 'capable')).toBeUndefined();
    expect(mascotStageArt('tortoise', 'advanced')).toBeUndefined();
    expect(mascotStageArt('tortoise', 'elite')).toBeUndefined();
  });

  it('does not leak tortoise artwork into another current mascot family', () => {
    for (const family of ['bear', 'fox', 'otter', 'wolf'] as const) {
      expect(mascotStageArt(family, 'starter')).toBeUndefined();
    }
  });

  it('contains exactly one reviewed stage-art entry for now', () => {
    expect(Object.keys(MASCOT_STAGE_ART)).toEqual(['tortoise:starter']);
  });

  it('points at a real shipped PNG asset', () => {
    const art = mascotStageArt('tortoise', 'starter');
    expect(art).toBeDefined();

    const diskPath = join('public', art!.src.replace(/^\//, ''));
    const bytes = readFileSync(diskPath, 'latin1');

    expect(bytes.length).toBeGreaterThan(8);

    const signature = Array.from(bytes.slice(0, 8), (char) => char.charCodeAt(0));
    expect(signature).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
  });

  it('keeps GameHeader generic rather than hard-coding a tortoise asset path', () => {
    const source = readFileSync(
      join('src', 'ui', 'components', 'GameHeader.tsx'),
      'utf8',
    );

    expect(source).toContain('mascotStageArt(');
    expect(source).not.toContain('/mascots/tortoise/');
    expect(source).toContain('{family.glyph}');
  });

  it('renders reviewed art decoratively while retaining the glyph fallback', () => {
    const source = readFileSync(
      join('src', 'ui', 'components', 'GameHeader.tsx'),
      'utf8',
    );

    expect(source).toContain('standingArt !== undefined');
    expect(source).toContain('src={standingArt.src}');
    expect(source).toContain('alt=""');
    expect(source).toContain('aria-hidden="true"');
    expect(source).toContain('{family.glyph}');
  });

  it('gives Today a page-level companion above the shared screen header', () => {
    const header = readFileSync(
      join('src', 'ui', 'components', 'GameHeader.tsx'),
      'utf8',
    );
    const today = readFileSync(
      join('src', 'ui', 'screens', 'TodayScreen.tsx'),
      'utf8',
    );
    const todayCss = readFileSync(
      join('src', 'styles', 'screens', 'today.css'),
      'utf8',
    );

    expect(header).toContain("companionPlacement?: 'inline' | 'above'");
    expect(header).toContain(
      "companionPlacement === 'above' && standingArt !== undefined",
    );
    expect(header).not.toContain('className="companion-presence"');

    expect(today).toContain('visibleMascotFamily(game.state.mascot)');
    expect(today).toContain('mascotStageArt(visibleFamily.id, game.state.mascot.stage)');
    expect(today).toContain('className="today__top-companion"');
    expect(today).toContain('className="today__top-companion-art"');

    const mascotIndex = today.indexOf('className="today__top-companion"');
    const mainScreenIndex = today.lastIndexOf('<Screen title="Today"');

    expect(mascotIndex).toBeGreaterThan(-1);
    expect(mainScreenIndex).toBeGreaterThan(mascotIndex);

    expect(today).toContain('companionPlacement="above"');

    expect(todayCss).toContain('.today__top-companion {');
    expect(todayCss).toContain('justify-content: center');
    expect(todayCss).toContain('.today__top-companion-art {');
    // One box, whatever is in it. The still and the wave are the same canvas, so
    // neither element may be sized or transformed differently from the other.
    expect(todayCss).toContain('.today__top-companion-art {');
    expect(todayCss).not.toMatch(/video\.today__top-companion-art/);
    expect(todayCss).not.toMatch(/transform:\s*scale\(/);
  });
  it('lets the reviewed Today companion wave once and return to standing art', () => {
    const today = readFileSync(
      join('src', 'ui', 'screens', 'TodayScreen.tsx'),
      'utf8',
    );

    expect(today).toContain('const [isMascotWaving, setIsMascotWaving] = useState(false)');
    expect(today).toContain('aria-label="Wave to your companion"');
    /*
     * RE-POINTED, NOT WEAKENED. The "only wave when there is motion" test moved into
     * `canWave`, which now also carries the reduced-motion answer. The rule is
     * unchanged: no motion asset, no video element, no button.
     */
    expect(today).toContain('todayMascotArt?.motionSrc !== undefined');
    expect(today).toContain('src={todayMascotArt.motionSrc}');
    expect(today).toContain('autoPlay');
    expect(today).toContain('muted');
    expect(today).toContain('playsInline');
    expect(today).toContain('onEnded={() => setIsMascotWaving(false)}');

    /*
     * The poster closes the decode gap. A video paints nothing until its first frame
     * is ready, and the still it replaced would already be unmounted - a blank flash
     * exactly where the companion was. The poster is the resting still, which is this
     * video's own frame 0, so the two are the same pixels and the gap is invisible.
     */
    expect(today).toContain('poster={todayMascotArt.src}');
    expect(today).not.toContain('loop');
  });

  it('takes the resting still from the wave itself, so the swap cannot jump', () => {
    /*
     * THE POINT OF THIS WHOLE SLICE.
     *
     * A separately drawn still is what forced the old `transform: scale(1.08)`: the
     * two assets framed the character differently, and no single scale factor can
     * reconcile two different renders. Deriving the still from frame 0 of the video
     * makes them the same canvas, the same framing and the same character by
     * construction - so the guard is that they agree, not that a fudge factor exists.
     */
    const art = mascotStageArt('tortoise', 'starter');
    expect(art?.motionSrc).toBeDefined();

    const still = readFileSync(join('public', art!.src.replace(/^\//, '')), 'latin1');
    const byteAt = (index: number) => still.charCodeAt(index) & 0xff;
    const uint32At = (index: number) =>
      (byteAt(index) << 24) | (byteAt(index + 1) << 16)
      | (byteAt(index + 2) << 8) | byteAt(index + 3);

    // The wave is 608x608; the still must be that same canvas.
    expect(uint32At(16)).toBe(608);
    expect(uint32At(20)).toBe(608);
    expect(byteAt(25)).toBe(6); // RGBA - the transparency the wave also carries.

    // And it is named for the motion it came from, not for a separate drawing.
    expect(art!.src).toContain('wave-rest');
  });

  it('never scales one of the two presentations to match the other', () => {
    const todayCss = readFileSync(join('src', 'styles', 'screens', 'today.css'), 'utf8');
    expect(todayCss).not.toContain('scale(1.08)');
    expect(todayCss).not.toMatch(/transform-origin/);
  });

  it('respects the reduced-motion contract the rest of the app already uses', () => {
    const today = readFileSync(join('src', 'ui', 'screens', 'TodayScreen.tsx'), 'utf8');

    // The same guarded test the cinematics use, not a second opinion about it.
    expect(today).toContain("window.matchMedia('(prefers-reduced-motion: reduce)')");
    expect(today).toContain("typeof window.matchMedia !== 'function'");

    // And the consequence: no wave, and no button that would do nothing if pressed.
    expect(today).toContain('const canWave = todayMascotArt?.motionSrc !== undefined && !reducedMotion');
    expect(today).toContain('{canWave ? (');
  });

  it('keeps the companion decorative for assistive technology', () => {
    const today = readFileSync(join('src', 'ui', 'screens', 'TodayScreen.tsx'), 'utf8');
    // The picture is never announced; only the temporary control has a name.
    expect(today).not.toMatch(/alt="[^"]+"/);
    expect((today.match(/aria-label="Wave to your companion"/g) ?? []).length).toBe(1);
  });

  it('keeps the wave presentation-only', () => {
    const today = readFileSync(join('src', 'ui', 'screens', 'TodayScreen.tsx'), 'utf8');
    const start = today.indexOf('className="today__top-companion"');
    const end = today.indexOf('<Screen title="Today"', start);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);

    // Prose describing what the block must not do is not the block doing it.
    const block = today
      .slice(start, end)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\/[^\n]*/g, '');
    // Nothing in the companion block may touch truth of any kind.
    expect(block).not.toMatch(/grantRewards|syncGame|setGameState|xp|streak|evolve|hatch/i);
    expect(block).not.toMatch(/localStorage|repository|adapter|start\(/);
  });

  it('does not let Today learn an asset path', () => {
    const today = readFileSync(join('src', 'ui', 'screens', 'TodayScreen.tsx'), 'utf8');
    expect(today).not.toContain('/mascots/tortoise/');
    expect(today).not.toContain('.webm');
    expect(today).not.toContain('.png');
  });
});

/**
 * T0 - THE STARTER TORTOISE AS NINFIT'S PRESENTATION LANGUAGE.
 *
 * The tortoise is the first family drawn end to end, so how it is PRESENTED is the
 * template the other four inherit. These guards pin the two things that would
 * otherwise be re-decided per species: that a screen asks the registry rather than
 * learning a filename, and that the temporary letter stays load-bearing for every
 * species and stage that has not been drawn.
 *
 * They deliberately assert the declaration that carries each behaviour rather than
 * the presence of a selector - a stylesheet "containing" `.x` passes on an empty
 * block and on a commented-out rule.
 */

const strip = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/[^\n]*/g, '');

/** The declarations of one top-level CSS rule, by exact selector. */
function cssBlock(stylesheet: string, selector: string): string {
  const start = stylesheet.indexOf(`${selector} {`);
  expect(start, `${selector} is not declared`).toBeGreaterThan(-1);
  const end = stylesheet.indexOf('}', start);
  expect(end).toBeGreaterThan(start);
  return stylesheet.slice(start + selector.length + 2, end);
}

describe('the Journey Home companion strip shows the reviewed Starter Tortoise', () => {
  const journeyScreen = readFileSync(
    join('src', 'ui', 'screens', 'JourneyScreen.tsx'),
    'utf8',
  );
  const journeyCompanion = readFileSync(
    join('src', 'ui', 'components', 'JourneyCompanion.tsx'),
    'utf8',
  );
  const journeyCss = readFileSync(join('src', 'styles', 'screens', 'journey.css'), 'utf8');

  it('asks the central stage-art boundary rather than naming an asset', () => {
    const code = strip(journeyScreen);
    expect(code).toContain('mascotStageArt(mascot.id, gameState.mascot.stage)');
    // The one failure that would work perfectly today and block the next four species.
    expect(code).not.toMatch(/['"`]\/mascots\//);
    expect(code).not.toMatch(/\.webp['"`]|\.webm['"`]|\.png['"`]/);
  });

  it('declares no second registry: the art arrives resolved, and is never looked up', () => {
    const code = strip(journeyCompanion);
    expect(code).toContain('art?: MascotStageArt;');
    expect(code).toContain('src={art.src}');
    // The component may not resolve, map or store artwork of its own.
    expect(code).not.toContain('mascotStageArt(');
    expect(code).not.toMatch(/['"`]\/mascots\//);
    expect(code).not.toMatch(/MASCOT_STAGE_ART|MASCOT_ACTIVITY_ART/);
  });

  it('keeps the temporary letter load-bearing where there is no reviewed art', () => {
    const code = strip(journeyCompanion);
    // Presence AND absence together: a test that only forbids passes on an empty file.
    expect(code).toContain("data-art={art !== undefined ? 'true' : 'false'}");
    expect(code).toContain('{art !== undefined ? <img src={art.src} alt="" /> : presence.family.glyph}');

    // And the registry really does answer `undefined` for everything not yet drawn,
    // which is what makes that branch the ordinary path rather than a dead one.
    expect(mascotStageArt('tortoise', 'growing')).toBeUndefined();
    for (const family of ['bear', 'fox', 'otter', 'wolf'] as const) {
      expect(mascotStageArt(family, 'starter')).toBeUndefined();
    }
  });

  it('keeps the letter slot framed and drops the frame around real artwork', () => {
    // The letter needs its disc to read as a slot; reviewed art is a finished figure
    // and a ring behind it would be a frame around a picture.
    const letter = cssBlock(journeyCss, '.journey-home__companion-mark');
    expect(letter).toMatch(/border:\s*1px solid var\(--ft-border-subtle\)/);
    expect(letter).toMatch(/background:\s*var\(--ft-surface-sunken\)/);

    const withArt = cssBlock(journeyCss, ".journey-home__companion-mark[data-art='true']");
    expect(withArt).toMatch(/border:\s*0/);
    expect(withArt).toMatch(/background:\s*none/);
    expect(withArt).toMatch(/width:\s*var\(--ft-control-lg\)/);
  });

  it('grounds the strip companion the same way Today does', () => {
    const contact = cssBlock(journeyCss, ".journey-home__companion-mark[data-art='true']::before");
    expect(contact).toContain('radial-gradient');
    expect(contact).toContain('--ft-border-strong');
  });

  it('adds no motion to Journey Home, so reduced motion has nothing to collapse', () => {
    const code = strip(journeyCompanion);
    expect(code).not.toMatch(/motionSrc|<video|autoPlay|poster=|animation|transition/);
    expect(strip(journeyScreen)).not.toMatch(/motionSrc|<video|autoPlay/);
  });

  it('leaves the Walk/Run, Cycle and Swim medallions exactly as they were', () => {
    // A different registry, a different size, a different rule. The companion strip
    // must not have reached into any of them.
    const medallion = cssBlock(journeyCss, ".journey-home__activity-mark[data-art='true']");
    expect(medallion).toMatch(/width:\s*72px/);
    expect(medallion).toMatch(/aspect-ratio:\s*1/);
    expect(medallion).toMatch(/background:\s*none/);
    expect(strip(journeyScreen)).toContain('mascotActivityArt(mascot.id, family.id)');
  });

  it('cannot show a species before the egg is opened', () => {
    const code = strip(journeyScreen);
    // Art is derived from the visible family, which is undefined until hatch, and the
    // strip itself is absent for the same reason.
    expect(code).toContain('gameState === undefined || mascot === undefined');
    expect(code).toContain('{companion !== undefined ? (');
    expect(code).toContain('visibleMascotFamily(gameState.mascot)');
  });

  it('carries no fitness, progression, reward or storage logic into the strip', () => {
    for (const [name, source] of [
      ['JourneyCompanion.tsx', journeyCompanion],
      ['JourneyScreen.tsx', journeyScreen],
    ] as const) {
      const code = strip(source);
      expect(code, `${name} touches the game layer`).not.toMatch(
        /grantRewards|syncGame|useGame|saveGameState|deriveRewards|hatchEggNow|evolveMascotNow/,
      );
      expect(code, `${name} persists something`).not.toMatch(
        /localStorage|sessionStorage|indexedDB|repository\.save/,
      );
    }
  });
});

describe("Today's companion is a presence on the page, not a portrait in a box", () => {
  const todayCss = readFileSync(join('src', 'styles', 'screens', 'today.css'), 'utf8');

  it('gives the companion block no frame of its own', () => {
    // The complaint this slice exists to answer. Any of these turns the companion
    // back into a card, and a card is what read as a picture in a stark rectangle.
    const block = cssBlock(todayCss, '.today__top-companion');
    expect(block).not.toMatch(/(^|[\s;])border(-\w+)?:/);
    expect(block).not.toMatch(/box-shadow:/);
    expect(block).not.toMatch(/(^|[\s;])background(-\w+)?:/);
    expect(block).not.toMatch(/backdrop-filter:/);
  });

  it('sizes the block from the artwork so the presence layers can be placed on it', () => {
    const block = cssBlock(todayCss, '.today__top-companion');
    expect(block).toMatch(/position:\s*relative/);
    expect(block).toMatch(/width:\s*fit-content/);
    expect(block).toMatch(/min-height:\s*225px/);
  });

  it('grounds the character with a contact shadow that works in both themes', () => {
    const contact = cssBlock(todayCss, '.today__top-companion::after');
    expect(contact).toContain('radial-gradient');
    /*
     * NOT a `--ft-shadow-*` token. Those are `none` in dark mode by design, so the
     * character would have been grounded in one theme and floating in the other.
     * `--ft-border-strong` steps away from the page surface in the right direction
     * in both.
     */
    expect(contact).toContain('--ft-border-strong');
    expect(contact).not.toMatch(/--ft-shadow-/);
    expect(todayCss).not.toMatch(/\.today__top-companion::after[\s\S]{0,400}?--ft-text-primary/);
  });

  it('uses a tint, not a picture, for the presence behind the character', () => {
    const bloom = cssBlock(todayCss, '.today__top-companion::before');
    expect(bloom).toContain('radial-gradient');
    expect(bloom).toContain('--ft-accent-soft');
    // No scenery, ever: a background asset here would bake a place into the mascot.
    expect(bloom).not.toMatch(/url\(/);
    expect(todayCss).not.toMatch(/url\(/);
  });

  it('anchors the companion to the reading column once the column stops being the screen', () => {
    expect(todayCss).toContain('@media (min-width: 600px)');
    const desktop = todayCss.slice(todayCss.indexOf('@media (min-width: 600px)'));
    expect(desktop).toContain('margin-inline: 0');
  });

  it('still keeps the still and the wave in one identical box', () => {
    // Unchanged from the slice that produced the assets; restated because the block
    // around them moved.
    expect(todayCss).not.toMatch(/video\.today__top-companion-art/);
    expect(todayCss).not.toMatch(/transform:\s*scale\(/);
    expect(todayCss).not.toMatch(/transform-origin/);
    const art = cssBlock(todayCss, '.today__top-companion-art');
    expect(art).toMatch(/width:\s*225px/);
    expect(art).toMatch(/height:\s*225px/);
    expect(art).toMatch(/object-fit:\s*contain/);
  });
});
