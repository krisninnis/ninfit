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
