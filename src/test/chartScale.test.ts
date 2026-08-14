import { describe, expect, it } from 'vitest';
import { MIN_SPAN, computeScale, scalePosition } from '../domain/chartScale';

describe('computeScale', () => {
  it('has nothing to say about no data', () => {
    expect(computeScale([])).toBeUndefined();
    expect(computeScale([Number.NaN, Infinity])).toBeUndefined();
  });

  it('centres a single reading instead of implying a trend', () => {
    const scale = computeScale([69.9], { minSpan: MIN_SPAN.weightKg });
    if (!scale) throw new Error('expected a scale');

    expect(scalePosition(69.9, scale)).toBeCloseTo(0.5, 6);
    expect(scale.span).toBeGreaterThanOrEqual(MIN_SPAN.weightKg);
  });

  it('does not exaggerate a small weight change', () => {
    // 69.9 to 70.1 is 0.2 kg. On a tightly fitted axis it would span the full height.
    const scale = computeScale([69.9, 70.1], { minSpan: MIN_SPAN.weightKg });
    if (!scale) throw new Error('expected a scale');

    const movement = scalePosition(70.1, scale) - scalePosition(69.9, scale);
    expect(movement).toBeGreaterThan(0);
    // Well under a fifth of the chart height: visible, but plainly small.
    expect(movement).toBeLessThan(0.2);
  });

  it('still shows a genuinely large change clearly', () => {
    const scale = computeScale([69.9, 63.0], { minSpan: MIN_SPAN.weightKg });
    if (!scale) throw new Error('expected a scale');

    const movement = scalePosition(69.9, scale) - scalePosition(63.0, scale);
    expect(movement).toBeGreaterThan(0.7);
  });

  it('does not flatten a resting heart rate change by anchoring at zero', () => {
    const scale = computeScale([72, 69], { minSpan: MIN_SPAN.restingHeartRateBpm });
    if (!scale) throw new Error('expected a scale');

    expect(scale.min).toBeGreaterThan(0);
    const movement = scalePosition(72, scale) - scalePosition(69, scale);
    expect(movement).toBeGreaterThan(0.15);
  });

  it('starts counts at zero when asked', () => {
    const scale = computeScale([3000, 5000], { includeZero: true });
    if (!scale) throw new Error('expected a scale');
    expect(scale.min).toBe(0);
  });

  it('keeps identical readings on a flat line rather than dividing by zero', () => {
    const scale = computeScale([70, 70, 70], { minSpan: MIN_SPAN.weightKg });
    if (!scale) throw new Error('expected a scale');

    expect(scale.span).toBeGreaterThan(0);
    expect(scalePosition(70, scale)).toBeCloseTo(0.5, 6);
  });

  it('keeps every reading inside the chart', () => {
    const values = [37, 41, 33, 52];
    const scale = computeScale(values, { minSpan: MIN_SPAN.hrvMs });
    if (!scale) throw new Error('expected a scale');

    for (const value of values) {
      const position = scalePosition(value, scale);
      expect(position).toBeGreaterThanOrEqual(0);
      expect(position).toBeLessThanOrEqual(1);
    }
  });

  it('never lets a count scale drop below zero', () => {
    const scale = computeScale([1], { includeZero: true, minSpan: 100 });
    if (!scale) throw new Error('expected a scale');
    expect(scale.min).toBe(0);
  });
});
