import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { registerServiceWorker } from './pwa/registerServiceWorker';
import { getAppContext } from './app/bootstrap';
import { installInjectedNativeJourneyBridge } from './app/journeyNativeBootstrap';
import { installInjectedNativeJourneyDurableQueue } from './app/journeyNativeDurableQueueRuntime';
import { applyThemePreference } from './ui/theme';
import './styles/index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root was not found in index.html');
}

/*
 * Native shells inject their Journey location bridge and durable process queue before
 * this bundle executes. Web/PWA has neither and therefore stays on the foreground-only
 * browser provider with no native replay queue. Registering both here guarantees the
 * installed-shell transport boundary is settled before the first Journey can start.
 */
installInjectedNativeJourneyBridge();
installInjectedNativeJourneyDurableQueue();

applyThemePreference(getAppContext().repository.getGameSettings()?.theme ?? 'system');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerServiceWorker();
