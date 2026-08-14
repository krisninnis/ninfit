/**
 * Unit conversion and display formatting.
 *
 * Storage is metric, always. These helpers exist purely so the UI can show
 * stone/pounds and inches without ever writing imperial values into the data.
 */

const POUNDS_PER_KILOGRAM = 2.20462262185;
const POUNDS_PER_STONE = 14;
const CENTIMETRES_PER_INCH = 2.54;
const INCHES_PER_FOOT = 12;

export interface StoneAndPounds {
  stone: number;
  pounds: number;
}

export interface FeetAndInches {
  feet: number;
  inches: number;
}

/**
 * Round for display.
 *
 * Shifting the decimal point via exponential notation rather than multiplying
 * avoids the usual float surprise: `1.005 * 100` is 100.49999999999999, which
 * would round 1.005 down to 1.00. Values already in exponential form fall back
 * to plain multiplication, where the precision is irrelevant anyway.
 */
export function roundTo(value: number, decimalPlaces = 1): number {
  if (!Number.isFinite(value)) return value;

  const asString = `${value}`;
  if (asString.includes('e') || asString.includes('E')) {
    const factor = 10 ** decimalPlaces;
    return Math.round(value * factor) / factor;
  }

  const shifted = Number(`${asString}e${decimalPlaces}`);
  if (!Number.isFinite(shifted)) return value;
  return Number(`${Math.round(shifted)}e${-decimalPlaces}`);
}

// --- Weight ---------------------------------------------------------------

export function kgToPounds(kg: number): number {
  return kg * POUNDS_PER_KILOGRAM;
}

export function poundsToKg(pounds: number): number {
  return pounds / POUNDS_PER_KILOGRAM;
}

/**
 * Splits a weight into whole stone plus remaining pounds.
 * Pounds are rounded to one decimal place, and a value that rounds up to a full
 * 14 lb is carried into the next stone so "10 st 14.0 lb" can never be displayed.
 */
export function kgToStoneAndPounds(kg: number): StoneAndPounds {
  const totalPounds = kgToPounds(kg);
  let stone = Math.floor(totalPounds / POUNDS_PER_STONE);
  let pounds = roundTo(totalPounds - stone * POUNDS_PER_STONE, 1);
  if (pounds >= POUNDS_PER_STONE) {
    stone += 1;
    pounds = roundTo(pounds - POUNDS_PER_STONE, 1);
  }
  return { stone, pounds };
}

export function stoneAndPoundsToKg(stone: number, pounds = 0): number {
  return poundsToKg(stone * POUNDS_PER_STONE + pounds);
}

// --- Length ---------------------------------------------------------------

export function cmToInches(cm: number): number {
  return cm / CENTIMETRES_PER_INCH;
}

export function inchesToCm(inches: number): number {
  return inches * CENTIMETRES_PER_INCH;
}

export function cmToFeetAndInches(cm: number): FeetAndInches {
  const totalInches = cmToInches(cm);
  let feet = Math.floor(totalInches / INCHES_PER_FOOT);
  let inches = roundTo(totalInches - feet * INCHES_PER_FOOT, 1);
  if (inches >= INCHES_PER_FOOT) {
    feet += 1;
    inches = roundTo(inches - INCHES_PER_FOOT, 1);
  }
  return { feet, inches };
}

export function feetAndInchesToCm(feet: number, inches = 0): number {
  return inchesToCm(feet * INCHES_PER_FOOT + inches);
}

// --- Display --------------------------------------------------------------

export function formatKg(kg: number, decimalPlaces = 1): string {
  return `${roundTo(kg, decimalPlaces)} kg`;
}

export function formatStoneAndPounds(kg: number): string {
  const { stone, pounds } = kgToStoneAndPounds(kg);
  const wholePounds = roundTo(pounds, 1);
  return wholePounds === 0 ? `${stone} st` : `${stone} st ${wholePounds} lb`;
}

export function formatWeight(kg: number, unit: 'kg' | 'stone_lb'): string {
  return unit === 'kg' ? formatKg(kg) : formatStoneAndPounds(kg);
}

export function formatCm(cm: number, decimalPlaces = 1): string {
  return `${roundTo(cm, decimalPlaces)} cm`;
}

export function formatInches(cm: number, decimalPlaces = 1): string {
  return `${roundTo(cmToInches(cm), decimalPlaces)} in`;
}

export function formatLength(cm: number, unit: 'cm' | 'in'): string {
  return unit === 'cm' ? formatCm(cm) : formatInches(cm);
}

export function formatHeight(cm: number, unit: 'cm' | 'in'): string {
  if (unit === 'cm') return formatCm(cm, 0);
  const { feet, inches } = cmToFeetAndInches(cm);
  return `${feet} ft ${Math.round(inches)} in`;
}
