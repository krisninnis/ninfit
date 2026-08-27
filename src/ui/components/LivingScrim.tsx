import type { ReactNode } from 'react';

export type LivingScrimVariant = 'hero' | 'bridge';

interface LivingScrimProps {
  children: ReactNode;
  variant?: LivingScrimVariant;
  className?: string;
}

/**
 * Shared foreground protection for NinFit's Living Interface.
 *
 * This is presentation only. It does not know which screen, activity, path, mascot,
 * reward or fitness state it surrounds. The world artwork remains decorative behind
 * PageBackdrop; this layer simply gives real content a readable, atmospheric edge
 * instead of making every screen invent its own translucent panel.
 */
export function LivingScrim({
  children,
  variant = 'hero',
  className,
}: LivingScrimProps) {
  const classes = [
    'living-scrim',
    `living-scrim--${variant}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} data-living-scrim={variant}>
      <div className="living-scrim__content">{children}</div>
    </div>
  );
}
