// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { HatchCompanionMedia } from '../ui/components/HatchCompanionMedia';
import { EggArt } from '../ui/components/EggArt';

const styles = readFileSync(join('src', 'styles', 'components', 'egg.css'), 'utf8');
const appSource = readFileSync(join('src', 'App.tsx'), 'utf8');
const onboardingSource = readFileSync(join('src', 'ui', 'screens', 'OnboardingScreen.tsx'), 'utf8');
const gameHeaderSource = readFileSync(join('src', 'ui', 'components', 'GameHeader.tsx'), 'utf8');

const STANDING = '/mascots/tortoise/tortoise-starter-idle-v1.png';
const WAVE = '/mascots/tortoise/tortoise-starter-wave-v1.webm';

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

describe('post-break Starter Tortoise wave', () => {
  it('does not mount motion during flash or reduced motion, but does during full reveal', () => {
    const { rerender } = render(
      <HatchCompanionMedia phase="flash" standingSrc={STANDING} motionSrc={WAVE} fallbackMark="T" />,
    );
    expect(document.querySelector('video')).toBeNull();
    expect(document.querySelector('.egg-hatch__companion')?.getAttribute('src')).toBe(STANDING);

    rerender(
      <HatchCompanionMedia phase="emerging" standingSrc={STANDING} motionSrc={WAVE} fallbackMark="T" />,
    );
    const video = document.querySelector('video');
    expect(video?.getAttribute('src')).toBe(WAVE);
    expect(video?.hasAttribute('autoplay')).toBe(true);
    expect(video?.hasAttribute('playsinline')).toBe(true);
    expect(video?.hasAttribute('loop')).toBe(false);
    expect(document.querySelector('.egg-hatch__companion--under-wave')).toBeTruthy();

    rerender(
      <HatchCompanionMedia phase="reduced-meet" standingSrc={STANDING} motionSrc={WAVE} fallbackMark="T" />,
    );
    expect(document.querySelector('video')).toBeNull();
    expect(document.querySelector('.egg-hatch__companion')?.getAttribute('src')).toBe(STANDING);
  });

  it('falls back immediately to the reviewed standing frame if motion media fails', () => {
    render(
      <HatchCompanionMedia phase="emerging" standingSrc={STANDING} motionSrc={WAVE} fallbackMark="T" />,
    );
    const video = document.querySelector('video');
    expect(video).toBeTruthy();

    act(() => {
      video?.dispatchEvent(new Event('error', { bubbles: false }));
    });

    expect(document.querySelector('video')).toBeNull();
    expect(document.querySelector('.egg-hatch__companion')?.getAttribute('src')).toBe(STANDING);
  });

  it('wires the same motion asset boundary through onboarding and Today without pre-break preload logic', () => {
    expect(appSource).toContain('companionMotionSrc={revealedArt?.motionSrc}');
    expect(onboardingSource).toContain('motionSrc={companionMotionSrc}');
    expect(gameHeaderSource).toContain('motionSrc={standingArt?.motionSrc}');
    expect(onboardingSource).not.toMatch(/tortoise-starter-wave/i);
    expect(gameHeaderSource).not.toMatch(/tortoise-starter-wave/i);
    expect(styles).toContain('never crops, masks or obscures it.');
  });
});
