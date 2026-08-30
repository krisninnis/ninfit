import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  isMapLibreCompatibleColour,
  journeyMapPaintColours,
  mapLibreColour,
} from '../ui/mapLibreColour';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const renderer = readFileSync(join(SRC, 'ui', 'components', 'JourneyRouteMap.tsx'), 'utf8');
const helper = readFileSync(join(SRC, 'ui', 'mapLibreColour.ts'), 'utf8');

describe('Journey MapLibre colour compatibility boundary', () => {
  it('converts an OKLCH theme colour into a MapLibre-compatible RGB colour', () => {
    const resolve = vi.fn(() => 'rgb(70, 112, 71)');

    const colour = mapLibreColour('oklch(50.16% .078 145)', '#4f8065', resolve);

    expect(colour).toBe('rgb(70, 112, 71)');
    expect(isMapLibreCompatibleColour(colour)).toBe(true);
    expect(resolve).toHaveBeenCalledWith('oklch(50.16% .078 145)');
  });

  it.each([
    '#4f8065',
    '#fff',
    'rgb(70, 112, 71)',
    'rgba(70, 112, 71, 0.8)',
  ])('passes an already-compatible colour through unchanged: %s', (colour) => {
    const resolve = vi.fn();

    expect(mapLibreColour(colour, '#000000', resolve)).toBe(colour);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('uses converted theme colours for every Journey paint slot', () => {
    const tokens = {
      '--ft-accent': 'oklch(50.16% .078 145)',
      '--ft-surface-raised': 'oklch(100% 0 0)',
    } as const;
    const before = structuredClone(tokens);
    const resolve = vi.fn((colour: string) =>
      colour.includes('100%') ? 'rgb(255, 255, 255)' : 'rgb(70, 112, 71)');

    const colours = journeyMapPaintColours((token) =>
      tokens[token as keyof typeof tokens], resolve);

    expect(colours).toEqual({
      routeCasing: 'rgb(255, 255, 255)',
      routeLine: 'rgb(70, 112, 71)',
      positionFill: 'rgb(70, 112, 71)',
      positionStroke: 'rgb(255, 255, 255)',
    });
    expect(Object.values(colours).every(isMapLibreCompatibleColour)).toBe(true);
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(tokens).toEqual(before);
  });

  it('wires each MapLibre layer paint property to the converted boundary', () => {
    expect(renderer).toContain("'line-color': colours.routeCasing");
    expect(renderer).toContain("'line-color': colours.routeLine");
    expect(renderer).toContain("'circle-color': colours.positionFill");
    expect(renderer).toContain("'circle-stroke-color': colours.positionStroke");
    expect(renderer).not.toContain("'line-color': cssToken(");
    expect(renderer).not.toContain("'circle-color': cssToken(");
  });

  it('keeps colour conversion presentation-only and outside Journey truth', () => {
    expect(helper).not.toMatch(/domain\/|JourneyGpsPoint|acceptedPoints|rawPoints|distance/i);
    expect(helper).not.toMatch(/localStorage|sessionStorage|repository|save|update/i);
  });

  it('falls back safely instead of returning an empty or invalid colour', () => {
    expect(mapLibreColour('', '#ffffff')).toBe('#ffffff');
    expect(mapLibreColour('not-a-colour', '#4f8065', () => undefined)).toBe('#4f8065');
    expect(mapLibreColour('rgb()', '#4f8065', () => undefined)).toBe('#4f8065');
    expect(() => mapLibreColour('', '', () => undefined)).toThrow(
      'MapLibre colour fallback must be a non-empty hex, rgb or rgba value',
    );
  });
});
