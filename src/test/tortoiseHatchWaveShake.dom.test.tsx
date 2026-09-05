// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { HatchCompanionMedia } from '../ui/components/HatchCompanionMedia';
import { EggArt } from '../ui/components/EggArt';
import { mascotStageArt } from '../ui/mascotStageArt';

const styles = readFileSync(join('src', 'styles', 'components', 'egg.css'), 'utf8');
const appSource = readFileSync(join('src', 'App.tsx'), 'utf8');
const onboardingSource = readFileSync(join('src', 'ui', 'screens', 'OnboardingScreen.tsx'), 'utf8');
const gameHeaderSource = readFileSync(join('src', 'ui', 'components', 'GameHeader.tsx'), 'utf8');
const todaySource = readFileSync(join('src', 'ui', 'screens', 'TodayScreen.tsx'), 'utf8');

const STANDING = '/mascots/tortoise/tortoise-starter-idle-v1.png';
const DEFECTIVE_WAVE = '/mascots/tortoise/tortoise-starter-wave-v1.webm';
const FUTURE_REVIEWED_MOTION = '/mascots/tortoise/future-reviewed-motion.webm';

afterEach(() => cleanup());

describe('questionnaire crack motion', () => {
  it('marks every cracked production stage for motion while stage zero stays calm', () => {
    const { rerender } = render(<EggArt crackStage={0} />);
    expect(document.querySelector('.egg__art--cracked')).toBeNull();

    for (const stage of [1, 2, 3, 4, 5]) {
      rerender(<EggArt crackStage={stage} />);
      const egg = document.querySelector('.egg');
      const active = document.querySelector('.egg__art--cracked');
      expect(egg?.getAttribute('data-egg-visible-stage')).toBe(String(stage));
      expect(active?.getAttribute('data-egg-art-stage')).toBe(String(stage));
    }
  });

  it('scales the shake by crack stage and disables it for reduced motion', () => {
    for (const stage of [2, 3, 4, 5]) {
      expect(styles).toContain(`.egg[data-egg-visible-stage='${stage}'] .egg__art--cracked`);
    }
    expect(styles).toContain('@keyframes egg-stage-shake');
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.egg__art--cracked[\s\S]*animation: none/);
  });
});

describe('Starter Tortoise motion removal', () => {
  it('keeps the reviewed standing and idle assets but exposes no wave motion at runtime', () => {
    const art = mascotStageArt('tortoise', 'starter');
    expect(art?.src).toBe(STANDING);
    expect(art?.idleSrc).toBe('/mascots/tortoise/tortoise-starter-idle-v1.webm');
    expect(art?.motionSrc).toBeUndefined();
    expect(JSON.stringify(art)).not.toContain(DEFECTIVE_WAVE);
  });

  it('does not mount motion during the full hatch reveal when the registry supplies none', () => {
    const art = mascotStageArt('tortoise', 'starter');
    const { rerender } = render(
      <HatchCompanionMedia
        phase="flash"
        standingSrc={art?.src}
        motionSrc={art?.motionSrc}
        fallbackMark="T"
      />,
    );
    expect(document.querySelector('video')).toBeNull();
    expect(document.querySelector('.egg-hatch__companion')?.getAttribute('src')).toBe(STANDING);

    for (const phase of ['emerging', 'settling', 'landing'] as const) {
      rerender(
        <HatchCompanionMedia
          phase={phase}
          standingSrc={art?.src}
          motionSrc={art?.motionSrc}
          fallbackMark="T"
        />,
      );
      expect(document.querySelector('video')).toBeNull();
      expect(document.querySelector('.egg-hatch__companion')?.getAttribute('src')).toBe(STANDING);
      expect(document.querySelector('.egg-hatch__companion--under-wave')).toBeNull();
    }
  });

  it('preserves the generic media-failure fallback for a future reviewed motion master', () => {
    render(
      <HatchCompanionMedia
        phase="emerging"
        standingSrc={STANDING}
        motionSrc={FUTURE_REVIEWED_MOTION}
        fallbackMark="T"
      />,
    );
    const video = document.querySelector('video');
    expect(video?.getAttribute('src')).toBe(FUTURE_REVIEWED_MOTION);

    act(() => {
      video?.dispatchEvent(new Event('error', { bubbles: false }));
    });

    expect(document.querySelector('video')).toBeNull();
    expect(document.querySelector('.egg-hatch__companion')?.getAttribute('src')).toBe(STANDING);
  });

  it('leaves the generic motion boundary wired for a future reviewed master', () => {
    expect(appSource).toContain('companionMotionSrc={revealedArt?.motionSrc}');
    expect(onboardingSource).toContain('motionSrc={companionMotionSrc}');
    expect(gameHeaderSource).toContain('motionSrc={standingArt?.motionSrc}');
    expect(onboardingSource).not.toMatch(/tortoise-starter-wave/i);
    expect(gameHeaderSource).not.toMatch(/tortoise-starter-wave/i);
  });

  it('keeps Today idle-capable while disabling tap-to-wave when motionSrc is absent', () => {
    expect(todaySource).toContain("todayMascotArt?.idleSrc !== undefined && !reducedMotion");
    expect(todaySource).toContain("todayMascotArt?.motionSrc !== undefined && !reducedMotion");
    expect(mascotStageArt('tortoise', 'starter')?.idleSrc).toBeDefined();
    expect(mascotStageArt('tortoise', 'starter')?.motionSrc).toBeUndefined();
  });
});
