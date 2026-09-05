import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Screen } from './Screen';

interface Props {
  children: ReactNode;
  /** Where the fallback's way out points. Hash routing, so a plain link is enough. */
  homeHash: string;
}

interface State {
  failed: boolean;
}

/**
 * No single screen may be able to collapse the entire NinFit shell.
 *
 * This wraps every route-level screen, not only the four primary tabs. The screens
 * with no tab bar - Journey launch, an active Journey, Journey detail, the postcard,
 * Data, the NinFit ID experience, Passport - are exactly the ones where an unhandled
 * render error had nothing beneath it, so the whole application unmounted and the
 * user was left on a blank page with no way back. Every one of them can reach a lazy
 * chunk, and a lazy chunk can be missing after a deployment moves.
 *
 * Because those screens have no tab bar, the fallback carries its own way out rather
 * than pointing at navigation that is not on screen.
 *
 * Deliberately local. Fitness data is not repaired, cleared or mutated here, nothing
 * reloads the document, and a Journey that was recording stays recorded - the screen
 * is what failed, not the record.
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
            <p>Anything you had already recorded is still saved on this device.</p>
            <p>
              <a className="btn btn--primary" href={this.props.homeHash}>
                Go to Today
              </a>
            </p>
          </section>
        </Screen>
      );
    }

    return this.props.children;
  }
}
