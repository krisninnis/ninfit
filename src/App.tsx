import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { TabBar } from './ui/components/TabBar';
import { OnboardingScreen } from './ui/screens/OnboardingScreen';
import { NinFitIdScreen } from './ui/screens/NinFitIdScreen';
import { DataScreen } from './ui/screens/DataScreen';
import { ProfileScreen } from './ui/screens/ProfileScreen';
import { ProgressScreen } from './ui/screens/ProgressScreen';
import { TodayScreen } from './ui/screens/TodayScreen';
import { WeekScreen } from './ui/screens/WeekScreen';
import { PageBackdrop } from './ui/components/PageBackdrop';
import { StartupCinematic } from './ui/screens/StartupCinematic';
import { BACKDROP_FOR_TAB } from './ui/backgrounds/registry';
import { getAppContext } from './app/bootstrap';
import { hasSeenIntro, markIntroSeen, shouldPlayIntro } from './ui/startup/introState';
import { useGame } from './ui/hooks/useGame';
import { visibleMascotFamily } from './domain/game/mascot';
import {
  ACCOUNT_HASH,
  hashForTab,
  parseRouteFromHash,
  routeAfterHashChange,
  type AppRoute,
  type TabId,
} from './ui/tabs';

const SCREENS: Record<TabId, ComponentType> = {
  today: TodayScreen,
  week: WeekScreen,
  progress: ProgressScreen,
  profile: ProfileScreen,
  data: DataScreen,
};

export default function App() {
  // One navigation source of truth: the URL hash. The dedicated NinFit ID experience
  // is a route rather than a piece of component state, so the phone's back button
  // moves through it like anywhere else and a confirmation email can link into it.
  const [route, setRoute] = useState<AppRoute>(() =>
    parseRouteFromHash(window.location.hash),
  );
  const mainRef = useRef<HTMLElement>(null);
  const game = useGame();
  // "Not now" hides onboarding for this session only. Nothing is written, and the
  // tracker is fully usable without ever answering a question.
  const [dismissedOnboarding, setDismissedOnboarding] = useState(false);
  /*
   * The first-run journey now ends with the hatch and the companion reveal, both of
   * which happen AFTER onboarding has been recorded. Recording it flips
   * `needsOnboarding` to false, which would unmount the screen mid-cinematic, so
   * this keeps it mounted until the user has actually met their companion.
   */
  const [revealingCompanion, setRevealingCompanion] = useState(false);

  // The startup cinematic, decided once on mount. `useState` with an initialiser
  // rather than an effect, so a returning user never gets a frame of it.
  const store = useMemo(() => getAppContext().adapter, []);
  const [introDone, setIntroDone] = useState(
    () =>
      !shouldPlayIntro({
        seen: hasSeenIntro(store),
        onboardingComplete: !game.needsOnboarding,
      }),
  );

  // Keep state in step with the URL so the phone's back button works.
  //
  // `routeAfterHashChange` rather than a bare parse: auth-js clears the fragment
  // after it has consumed a confirmation token, which fires `hashchange`, and that
  // one event must not be mistaken for the user leaving the account flow.
  useEffect(() => {
    const syncFromHash = () =>
      setRoute((current) => routeAfterHashChange(current, window.location.hash));
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  // Switching screens should start at the top of the new one, not mid-scroll.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [route]);

  // Setting the hash normally fires `hashchange`, but not when the hash is already
  // the requested one. Updating state here as well keeps the two in step regardless.
  const navigate = (hash: string) => {
    window.location.hash = hash;
    setRoute(parseRouteFromHash(hash));
  };

  // The opening, before anything else can render. Decided once per mount from the
  // stored flag and whether onboarding has already happened, so a returning user
  // never sees it and nobody is asked to sign in to get past it.
  if (!introDone) {
    return (
      <StartupCinematic
        onComplete={() => {
          markIntroSeen(store);
          setIntroDone(true);
        }}
      />
    );
  }

  if ((game.needsOnboarding || revealingCompanion) && !dismissedOnboarding) {
    // No data-path here, deliberately. Onboarding is where a path is chosen, so
    // there is nothing to theme yet, and tinting the chooser in one path's colour
    // would quietly argue for that path.
    return (
      <div className="app">
        <main className="app__main" ref={mainRef}>
          <OnboardingScreen
            /*
             * Two writes, in this order, both real. `completeOnboarding` records the
             * FINAL chosen path and readies the egg; `hatch` is the single domain
             * mutation that opens it. Neither grants XP, a trophy or any activity -
             * hatching is the start of the journey, not a fitness reward.
             */
            onStartJourney={(input) => {
              game.completeOnboarding(input);
              game.hatch();
              setRevealingCompanion(true);
            }}
            onFinished={() => {
              setRevealingCompanion(false);
              navigate(ACCOUNT_HASH);
            }}
            onDismiss={() => setDismissedOnboarding(true)}
            // Undefined until the egg is genuinely hatched; the domain decides.
            companionName={visibleMascotFamily(game.state.mascot)?.name}
          />
        </main>
      </div>
    );
  }

  const showNinFitId = route.kind === 'account';
  const tab: TabId = route.kind === 'tab' ? route.tab : 'today';
  const CurrentScreen = SCREENS[tab];

  return (
    <>
      {/*
       * The world the user is standing in. Decorative and sibling to the shell, so
       * it can be fixed behind everything without any screen owning it.
       *
       * Deliberately NOT shown on the NinFit ID flow: that screen is a decision
       * point rather than a place, and it brings its own hero treatment.
       *
       * The region comes from the route. It has nothing to do with `data-path`
       * below, which is the fitness path and is set from game state.
       */}
      {!showNinFitId ? <PageBackdrop id={BACKDROP_FOR_TAB[tab]} /> : null}

      {/*
       * The single place a path becomes visible. Every accent in the app resolves
       * from this attribute (see styles/tokens/paths.css), so no component needs to
       * know which path is active. Undefined when no path has been chosen - the
       * attribute is then absent and the neutral sage accent applies.
       */}
      <div className="app" data-path={game.state.pathId}>
        <main className="app__main" ref={mainRef}>
          {showNinFitId ? (
            <NinFitIdScreen
              returningFromConfirmation={route.confirmed}
              onSkip={() => navigate(hashForTab('today'))}
            />
          ) : (
            <CurrentScreen />
          )}
        </main>

        {!showNinFitId ? (
          <TabBar current={tab} onSelect={(id) => setRoute({ kind: 'tab', tab: id })} />
        ) : null}
      </div>
    </>
  );
}
