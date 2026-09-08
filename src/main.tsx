import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { registerServiceWorker } from './pwa/registerServiceWorker';
import { getAppContext } from './app/bootstrap';
import { installCapacitorJourneyDurableQueueBridge } from './app/journeyCapacitorDurableQueueBridge';
import { installInjectedNativeJourneyBridge } from './app/journeyNativeBootstrap';
import { installInjectedNativeJourneyDurableQueue } from './app/journeyNativeDurableQueueRuntime';
import { applyThemePreference } from './ui/theme';
import './styles/index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root was not found in index.html');
}

/*
 * The installed Android shell exposes its concrete durable queue through Capacitor.
 * Install that adapter onto the same global boundary used by the vendor-independent
 * Journey runtime before the generic bootstrap inspects it. Web/PWA is a no-op here.
 *
 * The location provider remains independently injectable because the selected native
 * background-location plugin is still behind the provider boundary.
 */
installCapacitorJourneyDurableQueueBridge();
installInjectedNativeJourneyBridge();
installInjectedNativeJourneyDurableQueue();

applyThemePreference(getAppContext().repository.getGameSettings()?.theme ?? 'system');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerServiceWorker();
