import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MASCOT_STAGE_ART, mascotStageArt } from '../ui/mascotStageArt';

describe('tortoise standing companion artwork', () => {
  it('registers the reviewed Starter artwork', () => {
    expect(mascotStageArt('tortoise', 'starter')).toEqual({
      src: '/mascots/tortoise/tortoise-starter-companion-v1.png',
    });
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
    expect(todayCss).toContain('width: 190px');
    expect(todayCss).toContain('height: 190px');
    expect(todayCss).toContain('width: 150px');
    expect(todayCss).toContain('height: 150px');
  });
});
