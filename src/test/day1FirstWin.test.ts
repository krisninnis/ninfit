import { describe, expect, it } from 'vitest';
import { selectDay1FirstWin, tinyDurationFor } from '../domain/day1FirstWin';
import type { OnboardingAnswers } from '../domain/game/types';
import type { PlannedActivity } from '../domain/types';

function activity(
  id: string,
  type: PlannedActivity['type'],
  durationMinutes: number,
  label = type,
): PlannedActivity {
  return {
    id,
    type,
    label,
    durationMinutes,
    intensity: 'very_light',
  };
}

describe('Day 1 first-win selector', () => {
  const yoga = activity('yoga-1', 'yoga', 10, 'beginner yoga');
  const walk = activity('walk-1', 'walk', 5, 'easy walk');

  it('uses an explicit supported preference when that activity already exists in the plan', () => {
    const answers: OnboardingAnswers = { preferredActivities: ['walking'] };

    const result = selectDay1FirstWin([yoga, walk], answers);

    expect(result).toEqual({
      activityId: 'walk-1',
      explanation:
        'You picked walking as something you enjoy, so we’re starting with the walk already in today’s plan.',
      alternativeActivityIds: ['yoga-1'],
    });
  });

  it('respects the order of supported preferences deterministically', () => {
    const answers: OnboardingAnswers = { preferredActivities: ['yoga', 'walking'] };

    expect(selectDay1FirstWin([walk, yoga], answers)?.activityId).toBe('yoga-1');
    expect(selectDay1FirstWin([yoga, walk], answers)?.activityId).toBe('yoga-1');
  });

  it('does not invent mappings for strength, cycling or swimming preferences', () => {
    const generic = activity('other-1', 'other', 8, 'general movement');
    const answers: OnboardingAnswers = {
      preferredActivities: ['cycling', 'strength', 'swimming'],
    };

    const result = selectDay1FirstWin([yoga, generic, walk], answers);

    expect(result?.activityId).toBe('yoga-1');
    expect(result?.explanation).toContain('first activity already in today’s plan');
  });

  it('prefers an existing activity that fits stated available time when no supported preference matches', () => {
    const longerYoga = activity('yoga-20', 'yoga', 20, 'yoga');
    const shortWalk = activity('walk-10', 'walk', 10, 'walk');
    const answers: OnboardingAnswers = {
      preferredActivities: ['cycling'],
      availableMinutes: 10,
    };

    const result = selectDay1FirstWin([longerYoga, shortWalk], answers);

    expect(result?.activityId).toBe('walk-10');
    expect(result?.explanation).toBe(
      'This 10-minute step fits within the time you said you can usually give it.',
    );
  });

  it('falls back to stable programme order instead of fabricating a shorter main activity', () => {
    const first = activity('first', 'yoga', 20);
    const second = activity('second', 'walk', 15);

    const result = selectDay1FirstWin([first, second], { availableMinutes: 10 });

    expect(result?.activityId).toBe('first');
    expect(result?.tinyDurationMinutes).toBe(10);
    expect(first.durationMinutes).toBe(20);
  });

  it('keeps alternatives in authoritative plan order and excludes the selected activity', () => {
    const first = activity('a', 'walk', 10);
    const second = activity('b', 'yoga', 10);
    const third = activity('c', 'other', 10);

    const result = selectDay1FirstWin([first, second, third], {
      preferredActivities: ['yoga'],
    });

    expect(result?.activityId).toBe('b');
    expect(result?.alternativeActivityIds).toEqual(['a', 'c']);
  });

  it('returns no recommendation for a rest-only or empty session', () => {
    expect(selectDay1FirstWin([], {})).toBeUndefined();
    expect(selectDay1FirstWin([activity('rest', 'rest', 0)], {})).toBeUndefined();
  });

  it('derives only bounded, strictly smaller five-minute Tiny alternatives', () => {
    expect(tinyDurationFor(5)).toBeUndefined();
    expect(tinyDurationFor(9)).toBeUndefined();
    expect(tinyDurationFor(10)).toBe(5);
    expect(tinyDurationFor(15)).toBe(10);
    expect(tinyDurationFor(20)).toBe(10);
    expect(tinyDurationFor(30)).toBe(15);
    expect(tinyDurationFor(45)).toBe(25);
    expect(tinyDurationFor(Number.NaN)).toBeUndefined();
  });

  it('does not mutate the authoritative planned activities', () => {
    const planned = [activity('a', 'walk', 10), activity('b', 'yoga', 15)];
    const before = JSON.stringify(planned);

    selectDay1FirstWin(planned, {
      preferredActivities: ['yoga'],
      availableMinutes: 10,
      confidence: 'low',
    });

    expect(JSON.stringify(planned)).toBe(before);
  });
});
