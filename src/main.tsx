import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { registerServiceWorker } from './pwa/registerServiceWorker';
import { getAppContext } from './app/bootstrap';
import { installCapacitorJourneyDurableQueueBridge } from './app/journeyCapacitorDurableQueueBridge';
import { installCapacitorJourneyLockScreenBridge } from './app/journeyCapacitorLockScreenBridge';
import { installInjectedNativeJourneyBridge } from './app/journeyNativeBootstrap';
import { installInjectedNativeJourneyDurableQueue } from './app/journeyNativeDurableQueueRuntime';
import { startNativeJourneyLockScreenStatusRuntime } from './app/journeyNativeLockScreenStatusRuntime';
import { applyThemePreference } from './ui/theme';
import './styles/index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root was not found in index.html');
}

/*
 * The installed Android shell exposes its concrete durable queue and lock-screen status
 * surface through Capacitor. Install those adapters before React so the vendor-independent
 * Journey runtime can discover them immediately. Web/PWA is a no-op here.
 *
 * The location provider remains independently injectable because native GPS transport and
 * system status presentation are deliberately separate boundaries.
 */
installCapacitorJourneyDurableQueueBridge();
installCapacitorJourneyLockScreenBridge();
installInjectedNativeJourneyBridge();
installInjectedNativeJourneyDurableQueue();
startNativeJourneyLockScreenStatusRuntime(getAppContext().adapter);

applyThemePreference(getAppContext().repository.getGameSettings()?.theme ?? 'system');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerServiceWorker();
