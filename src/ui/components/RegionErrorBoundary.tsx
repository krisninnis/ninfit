import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** What to show instead of the region. Must make sense on its own. */
  fallback: ReactNode;
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * A part of a screen that is allowed to fail without taking the screen with it.
 *
 * The concrete reason this exists: every map on NinFit is a lazily imported chunk,
 * and so is the NinFit ID auth client. A deployment can move while a phone still has
 * the previous build running, and a lazy import that resolves to a chunk the
 * deployment no longer serves rejects. Without a boundary here that rejection travels
 * up to the screen boundary and removes the whole screen - including, on the Active
 * Journey screen, the controls for a Journey that is recording right now.
 *
 * Scope is the point. This never touches storage, never retries by itself, and never
 * reloads the document: it swaps one region for an honest message and leaves
 * everything else - including a running Journey - alone.
 */
export class RegionErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('NinFit region failed', error, info);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
