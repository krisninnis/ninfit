import { useEffect, useRef, useState, type ComponentType } from 'react';
import { TabBar } from './ui/components/TabBar';
import { OnboardingScreen } from './ui/screens/OnboardingScreen';
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
    return (
      <div className="app">
        <main className="app__main" ref={mainRef}>
          <OnboardingScreen
            onComplete={(input) => game.completeOnboarding(input)}
            onDismiss={() => setDismissedOnboarding(true)}
          />
        </main>
      </div>
    );
  }

  const CurrentScreen = SCREENS[tab];

  return (
    <div className="app">
      <main className="app__main" ref={mainRef}>
        <CurrentScreen />
      </main>
      <TabBar current={tab} onSelect={setTab} />
    </div>
  );
}
