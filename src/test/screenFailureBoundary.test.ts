import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (path: string) =>
  readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8');

describe('primary screen failure isolation', () => {
  it('wraps primary tab screens in a local error boundary', () => {
    const app = read('src/App.tsx');
    const boundary = read('src/ui/components/ScreenErrorBoundary.tsx');

    expect(app).toContain("import { ScreenErrorBoundary } from './ui/components/ScreenErrorBoundary'");
    expect(app).toContain('<ScreenErrorBoundary key={screenTab}>');
    expect(app).toContain('<CurrentScreen />');
    expect(boundary).toContain('static getDerivedStateFromError()');
    expect(boundary).toContain("This screen couldn't open");
    expect(boundary).toContain('Your data has not been changed.');
    expect(boundary).not.toContain('localStorage.clear');
    expect(boundary).not.toContain('window.location.reload');
  });
});
