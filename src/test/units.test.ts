import { describe, expect, it } from 'vitest';
import {
  cmToFeetAndInches,
  cmToInches,
  feetAndInchesToCm,
  formatCm,
  formatHeight,
  formatInches,
  formatKg,
  formatLength,
  formatStoneAndPounds,
  formatWeight,
  inchesToCm,
  kgToPounds,
  kgToStoneAndPounds,
  poundsToKg,
  roundTo,
  stoneAndPoundsToKg,
} from '../domain/units';
import { SEED_HEIGHT_CM, SEED_WAIST_CM, SEED_WEIGHT_KG } from '../domain/defaults';

describe('roundTo', () => {
  it('rounds to the requested precision', () => {
    expect(roundTo(1.2345, 2)).toBe(1.23);
    expect(roundTo(69.85, 0)).toBe(70);
    expect(roundTo(-1.26, 1)).toBe(-1.3);
    expect(roundTo(4500, 0)).toBe(4500);
  });

  it('rounds a decimal half up, despite float representation', () => {
    // 1.005 * 100 is 100.49999999999999 in binary floating point, so the naive
    // implementation rounds this down to 1. Exponential shifting gets it right.
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(2.675, 2)).toBe(2.68);
    expect(roundTo(0.145, 2)).toBe(0.15);
  });

  it('passes through values it cannot meaningfully round', () => {
    expect(roundTo(Number.NaN, 2)).toBeNaN();
    expect(roundTo(Infinity, 2)).toBe(Infinity);
    expect(roundTo(1e-7, 2)).toBe(0);
  });
});

describe('weight conversion', () => {
  it('converts kilograms to pounds and back', () => {
    expect(kgToPounds(1)).toBeCloseTo(2.20462, 4);
    expect(poundsToKg(kgToPounds(69.9))).toBeCloseTo(69.9, 9);
  });

  it('splits the seeded weight into 11 stone', () => {
    expect(kgToStoneAndPounds(SEED_WEIGHT_KG)).toEqual({ stone: 11, pounds: 0.1 });
  });

  it('converts stone and pounds back to kilograms', () => {
    expect(stoneAndPoundsToKg(11)).toBeCloseTo(69.85, 2);
    expect(stoneAndPoundsToKg(11, 0.1)).toBeCloseTo(69.9, 2);
  });

  it('round-trips through stone and pounds', () => {
    for (const kg of [50, 63.4, 69.9, 82.15, 101]) {
      const { stone, pounds } = kgToStoneAndPounds(kg);
      expect(stoneAndPoundsToKg(stone, pounds)).toBeCloseTo(kg, 1);
    }
  });

  it('carries into the next stone rather than showing 14 pounds', () => {
    const justUnderTheNextStone = poundsToKg(153.99);
    expect(kgToStoneAndPounds(justUnderTheNextStone)).toEqual({ stone: 11, pounds: 0 });
  });

  it('handles exact stone boundaries', () => {
    expect(kgToStoneAndPounds(stoneAndPoundsToKg(10))).toEqual({ stone: 10, pounds: 0 });
  });
});

describe('length conversion', () => {
  it('converts the seeded waist to exactly 30 inches', () => {
    expect(cmToInches(SEED_WAIST_CM)).toBeCloseTo(30, 9);
    expect(inchesToCm(30)).toBeCloseTo(SEED_WAIST_CM, 9);
  });

  it('converts the seeded height to 5 ft 11 in', () => {
    expect(cmToFeetAndInches(SEED_HEIGHT_CM)).toEqual({ feet: 5, inches: 11 });
  });

  it('converts feet and inches back to centimetres', () => {
    expect(feetAndInchesToCm(5, 11)).toBeCloseTo(180.34, 2);
    expect(feetAndInchesToCm(6)).toBeCloseTo(182.88, 2);
  });

  it('carries into the next foot rather than showing 12 inches', () => {
    expect(cmToFeetAndInches(inchesToCm(71.97))).toEqual({ feet: 6, inches: 0 });
  });
});

describe('display formatting', () => {
  it('formats weights', () => {
    expect(formatKg(SEED_WEIGHT_KG)).toBe('69.9 kg');
    expect(formatStoneAndPounds(SEED_WEIGHT_KG)).toBe('11 st 0.1 lb');
    expect(formatStoneAndPounds(stoneAndPoundsToKg(11))).toBe('11 st');
    expect(formatWeight(SEED_WEIGHT_KG, 'kg')).toBe('69.9 kg');
    expect(formatWeight(SEED_WEIGHT_KG, 'stone_lb')).toBe('11 st 0.1 lb');
  });

  it('formats lengths', () => {
    expect(formatCm(SEED_WAIST_CM)).toBe('76.2 cm');
    expect(formatInches(SEED_WAIST_CM)).toBe('30 in');
    expect(formatLength(SEED_WAIST_CM, 'cm')).toBe('76.2 cm');
    expect(formatLength(SEED_WAIST_CM, 'in')).toBe('30 in');
  });

  it('formats height in whole units', () => {
    expect(formatHeight(SEED_HEIGHT_CM, 'in')).toBe('5 ft 11 in');
    expect(formatHeight(SEED_HEIGHT_CM, 'cm')).toBe('180 cm');
  });
});
