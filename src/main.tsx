import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { registerServiceWorker } from './pwa/registerServiceWorker';
import { getAppContext } from './app/bootstrap';
import { installInjectedNativeJourneyBridge } from './app/journeyNativeBootstrap';
import { applyThemePreference } from './ui/theme';
import './styles/index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root was not found in index.html');
}

/*
 * Native shells inject their Journey bridge before this bundle executes. Web/PWA has
 * no bridge and therefore stays on the foreground-only browser provider. Registering
 * here guarantees provider selection is settled before the first Journey can start.
 */
installInjectedNativeJourneyBridge();

applyThemePreference(getAppContext().repository.getGameSettings()?.theme ?? 'system');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerServiceWorker();
