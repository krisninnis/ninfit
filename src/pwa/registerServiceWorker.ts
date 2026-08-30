export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        // Installed NinFit sessions are long-lived single-page clients. Ask for a
        // byte-level worker check on launch instead of waiting for browser timing.
        if (registration.active) return registration.update();
        return undefined;
      })
      .catch((error: unknown) => {
        console.warn('NinFit service worker registration failed.', error);
      });
  });
}
