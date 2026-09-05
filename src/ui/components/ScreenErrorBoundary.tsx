import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Screen } from './Screen';

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * A primary tab must never be able to collapse the entire NinFit shell.
 *
 * This is deliberately local to the current screen. Fitness data is not repaired,
 * cleared or mutated here; navigation remains available so the user can leave the
 * failed screen safely.
 */
export class ScreenErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('NinFit screen render failed', error, info);
  }

  render() {
    if (this.state.failed) {
      return (
        <Screen title="This screen couldn't open">
          <section className="card card--attention" role="alert">
            <p>Your data has not been changed.</p>
            <p>You can use another tab and try this screen again.</p>
          </section>
        </Screen>
      );
    }

    return this.props.children;
  }
}
