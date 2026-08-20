export const COMPANION_PRESENTATION = {
  id: 'opal',
  name: 'Opal',
  description: 'Your friendly NinFit companion.',
  ariaLabel: 'Opal, your NinFit companion',
} as const;

export type CompanionPresentation =
  typeof COMPANION_PRESENTATION;
