import { useEffect, useRef, useState, type ComponentType } from 'react';
import { TabBar } from './ui/components/TabBar';
import { OnboardingScreen } from './ui/screens/OnboardingScreen';
import { NinFitIdScreen } from './ui/screens/NinFitIdScreen';
import { DataScreen } from './ui/screens/DataScreen';
import { ProfileScreen } from './ui/screens/ProfileScreen';
import { ProgressScreen } from './ui/screens/ProgressScreen';
import { TodayScreen } from './ui/screens/TodayScreen';
import { WeekScreen } from './ui/screens/WeekScreen';
import { useGame } from './ui/hooks/useGame';
import { parseTabFromHash, type TabId } from './ui/tabs';

const SCREENS: Record<TabId, ComponentType> = {
  today: TodayScreen,
  week: WeekScreen,
  progress: ProgressScreen,
  profile: ProfileScreen,
  data: DataScreen,
};

export default function App() {
  const [tab, setTab] = useState<TabId>(() => parseTabFromHash(window.location.hash));
  const mainRef = useRef<HTMLElement>(null);
  const game = useGame();
  // "Not now" hides onboarding for this session only. Nothing is written, and the
  // tracker is fully usable without ever answering a question.
  const [dismissedOnboarding, setDismissedOnboarding] = useState(false);
  const [showNinFitId, setShowNinFitId] = useState(false);

  // Keep state in step with the URL so the phone's back button moves between tabs.
  useEffect(() => {
    const syncFromHash = () => setTab(parseTabFromHash(window.location.hash));
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  // Switching tabs should start at the top of the new screen, not mid-scroll.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [tab]);

  if (game.needsOnboarding && !dismissedOnboarding) {
    // No data-path here, deliberately. Onboarding is where a path is chosen, so
    // there is nothing to theme yet, and tinting the chooser in one path's colour
    // would quietly argue for that path.
    return (
      <div className="app">
        <main className="app__main" ref={mainRef}>
          <OnboardingScreen
            onComplete={(input) => {
              game.completeOnboarding(input);
              setShowNinFitId(true);
            }}
            onDismiss={() => setDismissedOnboarding(true)}
          />
        </main>
      </div>
    );
  }

  const CurrentScreen = SCREENS[tab];

  return (
    // The single place a path becomes visible. Every accent in the app resolves
    // from this attribute (see styles/tokens/paths.css), so no component needs to
    // know which path is active. Undefined when no path has been chosen - the
    // attribute is then absent and the neutral sage accent applies.
    <div className="app" data-path={game.state.pathId}>
      <main className="app__main" ref={mainRef}>
        {showNinFitId ? (
          <NinFitIdScreen
            onContinueWithEmail={() => {
              window.location.hash = '#/profile';
              setShowNinFitId(false);
            }}
            onSkip={() => {
              window.location.hash = '#/today';
              setShowNinFitId(false);
            }}
          />
        ) : (
          <CurrentScreen />
        )}
      </main>

      {!showNinFitId ? (
        <TabBar current={tab} onSelect={setTab} />
      ) : null}
    </div>
  );
}
