import type { ThemePreference } from '../domain/game/types';

export interface ThemeRoot {
  readonly dataset: DOMStringMap;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

/**
 * Apply the persisted preference through the theme engine's one existing hook.
 *
 * System is represented by no attribute at all. That deliberately hands control
 * back to the `prefers-color-scheme` rules in semantic.css rather than trying to
 * reproduce media-query behaviour in JavaScript.
 */
export function applyThemePreference(
  preference: ThemePreference,
  root: ThemeRoot = document.documentElement,
): void {
  if (preference === 'system') {
    root.removeAttribute('data-theme');
    return;
  }

  root.setAttribute('data-theme', preference);
}
