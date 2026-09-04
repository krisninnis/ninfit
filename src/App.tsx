import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { TabBar } from './ui/components/TabBar';
import { OnboardingScreen } from './ui/screens/OnboardingScreen';
import { NinFitIdScreen } from './ui/screens/NinFitIdScreen';
import { DataScreen } from './ui/screens/DataScreen';
import { SettingsScreen } from './ui/screens/SettingsScreen';
import { ProfileScreen } from './ui/screens/ProfileScreen';
import { ProgressScreen } from './ui/screens/ProgressScreen';
import { TodayScreen } from './ui/screens/TodayScreen';
import { WeekScreen } from './ui/screens/WeekScreen';
import { JourneyScreen } from './ui/screens/JourneyScreen';
import { JourneyLaunchScreen } from './ui/screens/JourneyLaunchScreen';
import { ActiveJourneyScreen } from './ui/screens/ActiveJourneyScreen';
import { JourneyCompletionScreen } from './ui/screens/JourneyCompletionScreen';
import { JourneyDetailScreen } from './ui/screens/JourneyDetailScreen';
import { JourneyPostcardScreen } from './ui/screens/JourneyPostcardScreen';
import { PassportScreen } from './ui/screens/PassportScreen';
import { PageBackdrop } from './ui/components/PageBackdrop';
import { StartupCinematic } from './ui/screens/StartupCinematic';
import { BACKDROP_FOR_TAB } from './ui/backgrounds/registry';
import { getAppContext } from './app/bootstrap';
import { hasSeenIntro, markIntroSeen, shouldPlayIntro } from './ui/startup/introState';
import { useGame } from './ui/hooks/useGame';
import { visibleMascotFamily } from './domain/game/mascot';
import { mascotStageArt } from './ui/mascotStageArt';
import { applyThemePreference } from './ui/theme';
import {
  ACCOUNT_HASH,
  DATA_HASH,
  JOURNEY_HASH,
  hashForPrimaryNav,
  hashForTab,
  journeyCompleteHash,
  journeyDetailHash,
  journeyPostcardHash,
  parseRouteFromHash,
  routeAfterHashChange,
  type AppRoute,
  type PrimaryNavId,
  type TabId,
} from './ui/tabs';

const SCREENS: Record<Exclude<TabId, 'settings'>, ComponentType> = {
  today: TodayScreen,
  week: WeekScreen,
  progress: ProgressScreen,
  profile: ProfileScreen,
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

  useEffect(() => {
    applyThemePreference(game.settings.theme);
  }, [game.settings.theme]);

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
    const visibleFamily = visibleMascotFamily(game.state.mascot);
    const revealedArt = visibleFamily
      ? mascotStageArt(visibleFamily.id, game.state.mascot.stage)
      : undefined;
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
            companionName={visibleFamily?.name}
            companionArtSrc={revealedArt?.src}
            companionMotionSrc={revealedArt?.motionSrc}
          />
        </main>
      </div>
    );
  }

  const showNinFitId = route.kind === 'account';
  const showData = route.kind === 'data';
  const showJourneyHome = route.kind === 'journey-home';
  const showActiveJourney = route.kind === 'journey-active';
  const showJourneyLaunch = route.kind === 'journey-launch';
  const showJourneyComplete = route.kind === 'journey-complete';
  const showJourneyDetail = route.kind === 'journey-detail';
  const showJourneyPostcard = route.kind === 'journey-postcard';
  const showPassport = route.kind === 'passport';
  const screenTab: TabId = route.kind === 'tab' ? route.tab : 'today';
  const CurrentScreen = screenTab === 'settings' ? undefined : SCREENS[screenTab];
  const tab: PrimaryNavId = showData
    ? 'settings'
    : showJourneyHome || showJourneyDetail || showJourneyPostcard
    || showJourneyLaunch || showJourneyComplete
    ? 'journey'
    : showPassport
      ? 'profile'
      : screenTab;
  const showPrimaryNav = route.kind === 'tab' || showJourneyHome || showData;
  const backdropId = showData
    ? 'data'
    : tab === 'journey'
      ? 'journey-wall'
      : BACKDROP_FOR_TAB[tab];

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
          ) : showData ? (
            <DataScreen onClose={() => navigate(hashForTab('settings'))} />
          ) : showActiveJourney ? (
            <ActiveJourneyScreen
              onClose={() => navigate(JOURNEY_HASH)}
              onCompleted={(journeyId) => navigate(journeyCompleteHash(journeyId))}
            />
          ) : showJourneyComplete ? (
            <JourneyCompletionScreen
              journeyId={route.journeyId}
              onViewJourney={() => navigate(journeyDetailHash(route.journeyId))}
              onClose={() => navigate(JOURNEY_HASH)}
            />
          ) : showJourneyDetail ? (
            <JourneyDetailScreen
              journeyId={route.journeyId}
              onClose={() => navigate(JOURNEY_HASH)}
              onPreviewPostcard={() => navigate(journeyPostcardHash(route.journeyId))}
            />
          ) : showJourneyPostcard ? (
            <JourneyPostcardScreen
              journeyId={route.journeyId}
              onClose={() => navigate(journeyDetailHash(route.journeyId))}
            />
          ) : showJourneyLaunch ? (
            <JourneyLaunchScreen
              family={route.family}
              onClose={() => navigate(JOURNEY_HASH)}
            />
          ) : showJourneyHome ? (
            <JourneyScreen />
          ) : showPassport ? (
            <PassportScreen onClose={() => navigate(hashForTab('profile'))} />
          ) : screenTab === 'settings' ? (
            <SettingsScreen
              settings={game.settings}
              onSettingsChange={game.updateSettings}
              onOpenData={() => navigate(DATA_HASH)}
            />
          ) : (
            CurrentScreen ? <CurrentScreen /> : null
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
