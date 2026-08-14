import type { ReactNode } from 'react';

interface ScreenProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

/** Shared page frame: heading, optional standfirst, and a stacked body. */
export function Screen({ title, subtitle, children }: ScreenProps) {
  return (
    <>
      <header className="screen__header">
        <h1 className="screen__title">{title}</h1>
        {subtitle ? <p className="screen__subtitle">{subtitle}</p> : null}
      </header>
      <div className="screen__body">{children}</div>
    </>
  );
}

/** Marks a screen that is scaffolded but not yet implemented. */
export function Placeholder({ step, children }: { step: string; children: ReactNode }) {
  return (
    <section className="card">
      <span className="placeholder__step">{step}</span>
      <p className="placeholder">{children}</p>
    </section>
  );
}
