import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { TabBar } from './ui/components/TabBar';
import { OnboardingScreen } from './ui/screens/OnboardingScreen';
import { NinFitIdScreen } from './ui/screens/NinFitIdScreen';
import { DataScreen } from './ui/screens/DataScreen';
import { ProfileScreen } from './ui/screens/ProfileScreen';
import { ProgressScreen } from './ui/screens/ProgressScreen';
import { TodayScreen } from './ui/screens/TodayScreen';
import { WeekScreen } from './ui/screens/WeekScreen';
import { JourneyScreen } from './ui/screens/JourneyScreen';
import { ActiveJourneyScreen } from './ui/screens/ActiveJourneyScreen';
import { JourneyDetailScreen } from './ui/screens/JourneyDetailScreen';
import { JourneyDetailScreen } from './ui/screens/JourneyDetailScreen';
import { PageBackdrop } from './ui/components/PageBackdrop';
import { StartupCinematic } from './ui/screens/StartupCinematic';
import { BACKDROP_FOR_TAB } from './ui/backgrounds/registry';
import { getAppContext } from './app/bootstrap';
import { hasSeenIntro, markIntroSeen, shouldPlayIntro } from './ui/startup/introState';
import { useGame } from './ui/hooks/useGame';
import { visibleMascotFamily } from './domain/game/mascot';
import {
  ACCOUNT_HASH,
  JOURNEY_HASH,
  hashForPrimaryNav,
  hashForTab,
  journeyDetailHash,
  journeyDetailHash,
  parseRouteFromHash,
  routeAfterHashChange,
  type AppRoute,
  type PrimaryNavId,
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
  const [route, setRoute] = useState<AppRoute>(() =>
    parseRouteFromHash(window.location.hash),
  );
  const mainRef = useRef<HTMLElement>(null);
  const game = useGame();
  const [dismissedOnboarding, setDismissedOnboarding] = useState(false);
  const [revealingCompanion, setRevealingCompanion] = useState(false);

  const store = useMemo(() => getAppContext().adapter, []);
  const [introDone, setIntroDone] = useState(
    () =>
      !shouldPlayIntro({
        seen: hasSeenIntro(store),
        onboardingComplete: !game.needsOnboarding,
      }),
  );

  useEffect(() => {
    const syncFromHash = () =>
      setRoute((current) => routeAfterHashChange(current, window.location.hash));
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [route]);

  const navigate = (hash: string) => {
    window.location.hash = hash;
    setRoute(parseRouteFromHash(hash));
  };

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
    return (
      <div className="app">
        <main className="app__main" ref={mainRef}>
          <OnboardingScreen
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
            companionName={visibleMascotFamily(game.state.mascot)?.name}
          />
        </main>
      </div>
    );
  }

  const showNinFitId = route.kind === 'account';
  const showJourneyHome = route.kind === 'journey-home';
  const showActiveJourney = route.kind === 'journey-active';
  const showJourneyDetail = route.kind === 'journey-detail';
  const showJourneyDetail = route.kind === 'journey-detail';
  const screenTab: TabId = route.kind === 'tab' ? route.tab : 'today';
  const CurrentScreen = SCREENS[screenTab];
  const tab: PrimaryNavId = showJourneyHome || showJourneyDetail ? 'journey' : screenTab;
  const showPrimaryNav = route.kind === 'tab' || showJourneyHome;
  const backdropId = tab === 'journey' ? 'journey-wall' : BACKDROP_FOR_TAB[tab];

  return (
    <>
      {!showNinFitId && !showActiveJourney ? <PageBackdrop id={backdropId} /> : null}

      <div className={`app${showActiveJourney ? ' app--journey' : ''}`} data-path={game.state.pathId}>
        <main className="app__main" ref={mainRef}>
          {showNinFitId ? (
            <NinFitIdScreen
              returningFromConfirmation={route.confirmed}
              onSkip={() => navigate(hashForTab('today'))}
            />
          ) : showActiveJourney ? (
            <ActiveJourneyScreen
              onClose={() => navigate(JOURNEY_HASH)}
              onCompleted={(journeyId) => navigate(journeyDetailHash(journeyId))}
            />
          ) : showJourneyDetail ? (
            <JourneyDetailScreen
              journeyId={route.journeyId}
              onClose={() => navigate(JOURNEY_HASH)}
            />
          ) : showJourneyHome ? (
            <JourneyScreen />
          ) : (
            <CurrentScreen />
          )}
        </main>

        {showPrimaryNav ? (
          <TabBar current={tab}
            onSelect={(id) => setRoute(parseRouteFromHash(hashForPrimaryNav(id)))}
          />
        ) : null}
      </div>
    </>
  );
}
