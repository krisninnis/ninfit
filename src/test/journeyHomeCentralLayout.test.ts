import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
  fileURLToPath(new URL('../styles/screens/journey-home-central.css', import.meta.url)),
  'utf8',
);

const indexCss = readFileSync(
  fileURLToPath(new URL('../styles/index.css', import.meta.url)),
  'utf8',
);

describe('Journey Home central launch layout', () => {
  it('loads the refinement immediately after the canonical Journey stylesheet', () => {
    expect(indexCss).toContain(
      "@import './screens/journey.css';\n@import './screens/journey-home-central.css';",
    );
  });

  it('keeps the three activity-family doors in one centred vertical column', () => {
    expect(css).toMatch(/\.journey-home__activities\s*\{[\s\S]*width:\s*min\(100%, 34rem\);/);
    expect(css).toMatch(/\.journey-home__activities\s*\{[\s\S]*justify-self:\s*center;/);
    expect(css).toMatch(/\.journey-home__activities\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\);/);
  });

  it('centres the Journey invitation while keeping each activity row readable', () => {
    expect(css).toMatch(/\.journey-home__header\s*\{[\s\S]*text-align:\s*center;/);
    expect(css).toMatch(/\.journey-home__activity\s*\{[\s\S]*grid-template-columns:\s*auto minmax\(0, 1fr\);/);
    expect(css).toMatch(/\.journey-home__activity\s*\{[\s\S]*min-height:\s*104px;/);
  });
});
